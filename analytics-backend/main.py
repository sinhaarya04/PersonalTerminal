"""
E[X] / Terminal analytics backend — FastAPI service on Fly.io.

Serves every /analytics/* endpoint the terminal frontend calls:
  montecarlo, technicals, forecast, backtest, factors,
  optimizer, portfolio, dcf, options

Price history comes from Yahoo Finance (same source the terminal already
uses). Fundamentals (for factors/dcf) come from Yahoo quoteSummary and
degrade gracefully to price-derived proxies when unavailable, so the panels
never 404 or crash.

Vercel rewrites `/analytics/(.*)` to `https://<app>.fly.dev/$1`, so this app
receives e.g. `/technicals`. Both the bare and `/analytics/`-prefixed paths
are registered on every route to be safe.
"""

import math
import os
import asyncio
import time
from datetime import datetime, timedelta

import numpy as np
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="EX Terminal Analytics")

# The terminal is a browser SPA on another origin, so allow cross-origin calls.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
YAHOO_QS_HOSTS = [
    "https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}",
    "https://query2.finance.yahoo.com/v10/finance/quoteSummary/{ticker}",
]
UA = {"User-Agent": "Mozilla/5.0"}
# A real browser UA is required for the crumb/cookie handshake below.
BROWSER_UA = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
}
RF = 0.02  # annual risk-free rate for Sharpe/Sortino

# Financial Modeling Prep — primary fundamentals source (works from any IP,
# unlike Yahoo quoteSummary which 429-blocks datacenter IPs). Key is a Fly
# secret; falls back to Yahoo crumb auth when unset.
FMP_KEY = os.environ.get("FMP_KEY", "")
FMP = "https://financialmodelingprep.com/stable"
_FUND_CACHE = {}     # ticker -> (fundamentals dict, ts)
_FUND_TTL = 3600.0   # cache fundamentals 1h to protect the 250/day free quota

# Cached Yahoo auth session (cookies + crumb). quoteSummary now gates
# fundamentals behind a rotating crumb, so we handshake once and reuse.
_YF = {"crumb": None, "cookies": None, "ts": 0.0, "fail_ts": 0.0}
_YF_TTL = 1800.0    # refresh a good crumb every 30 min
_YF_FAIL_TTL = 600.0  # after a failed handshake, don't retry for 10 min
                      # (Yahoo blocks datacenter IPs with 429 on the crumb
                      #  endpoint; caching the failure keeps panels fast)


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------
async def fetch_ohlcv(ticker: str, rng: str = "2y", interval: str = "1d") -> dict:
    """Daily OHLCV for a ticker from Yahoo Finance, aligned & null-stripped."""
    url = YAHOO_CHART.format(ticker=ticker)
    params = {"range": rng, "interval": interval}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, params=params, headers=UA)
            r.raise_for_status()
            payload = r.json()
    except Exception as e:  # network / upstream failure
        raise HTTPException(status_code=502, detail=f"price fetch failed for {ticker}: {e}")

    result = (payload.get("chart") or {}).get("result")
    if not result:
        raise HTTPException(status_code=404, detail=f"no data for '{ticker}'")
    res = result[0]
    ts = res.get("timestamp") or []
    quote = res["indicators"]["quote"][0]
    o, h, l, c = quote.get("open", []), quote.get("high", []), quote.get("low", []), quote.get("close", [])
    v = quote.get("volume", [])

    dates, op, hi, lo, cl, vol = [], [], [], [], [], []
    for i in range(len(ts)):
        if i >= len(c) or c[i] is None or o[i] is None or h[i] is None or l[i] is None:
            continue
        dates.append(datetime.utcfromtimestamp(ts[i]).strftime("%Y-%m-%d"))
        op.append(float(o[i])); hi.append(float(h[i])); lo.append(float(l[i])); cl.append(float(c[i]))
        vol.append(float(v[i]) if i < len(v) and v[i] is not None else 0.0)

    if len(cl) < 5:
        raise HTTPException(status_code=400, detail=f"not enough price history for {ticker}")
    return {"dates": dates, "open": op, "high": hi, "low": lo, "close": cl, "volume": vol}


async def fetch_closes(ticker: str, rng: str = "2y") -> list:
    return (await fetch_ohlcv(ticker, rng))["close"]


async def _yahoo_auth(force: bool = False):
    """Return (cookies_dict, crumb) for Yahoo, handshaking + caching as needed."""
    import time
    if not force and _YF["crumb"] and (time.time() - _YF["ts"]) < _YF_TTL:
        return _YF["cookies"], _YF["crumb"]
    if not force and (time.time() - _YF["fail_ts"]) < _YF_FAIL_TTL:
        raise RuntimeError("Yahoo crumb recently unavailable (cached)")
    def _valid(cr):
        return cr and len(cr) <= 20 and not any(ch.isspace() for ch in cr) and "<" not in cr

    crumb = None
    cookies = {}
    last = ""
    async with httpx.AsyncClient(timeout=15, headers=BROWSER_UA, follow_redirects=True) as c:
        # Warm up consent cookies from a few Yahoo surfaces.
        for warm in ("https://fc.yahoo.com",
                     "https://finance.yahoo.com/quote/AAPL",
                     "https://guce.yahoo.com/consent"):
            try:
                await c.get(warm)
            except Exception:
                pass
        for host in ("https://query1.finance.yahoo.com/v1/test/getcrumb",
                     "https://query2.finance.yahoo.com/v1/test/getcrumb"):
            for _ in range(2):
                try:
                    cr = await c.get(host)
                    last = cr.text.strip()
                    if cr.status_code == 200 and _valid(last):
                        crumb = last
                        break
                except Exception as e:
                    last = str(e)
            if crumb:
                break
        cookies = dict(c.cookies)
    if not crumb:
        _YF["fail_ts"] = time.time()
        raise RuntimeError(f"failed to obtain Yahoo crumb: {last[:40]!r}")
    _YF.update(cookies=cookies, crumb=crumb, ts=time.time(), fail_ts=0.0)
    return cookies, crumb


async def _fmp_get(client, path, symbol, extra=""):
    try:
        url = f"{FMP}/{path}?symbol={symbol}{extra}&apikey={FMP_KEY}"
        r = await client.get(url)
        if r.status_code != 200:
            return None
        j = r.json()
        if isinstance(j, list):
            return j[0] if j else None
        if isinstance(j, dict) and "Error Message" not in j:
            return j
    except Exception:
        pass
    return None


async def fetch_fundamentals_fmp(ticker: str) -> dict:
    """Fundamentals via Financial Modeling Prep (stable API)."""
    async with httpx.AsyncClient(timeout=15, headers=UA) as c:
        prof, rat, km, gro, cf = await asyncio.gather(
            _fmp_get(c, "profile", ticker),
            _fmp_get(c, "ratios-ttm", ticker),
            _fmp_get(c, "key-metrics-ttm", ticker),
            _fmp_get(c, "financial-growth", ticker, "&limit=1"),
            _fmp_get(c, "cash-flow-statement", ticker, "&limit=1"),
        )

    def g(o, k):
        return o.get(k) if isinstance(o, dict) else None

    def pct(x):
        return x * 100 if isinstance(x, (int, float)) else None

    prof = prof or {}; rat = rat or {}; km = km or {}; gro = gro or {}; cf = cf or {}
    price = g(prof, "price")
    mcap = g(prof, "marketCap") or g(km, "marketCap")
    shares = (mcap / price) if (mcap and price) else None
    return {
        "pe": g(rat, "priceToEarningsRatioTTM"),
        "pb": g(rat, "priceToBookRatioTTM"),
        "roe": pct(g(km, "returnOnEquityTTM")),
        "debt_equity": pct(g(rat, "debtToEquityRatioTTM")),
        "revenue_growth": pct(g(gro, "revenueGrowth")),
        "margin": pct(g(rat, "netProfitMarginTTM")),
        "beta": g(prof, "beta"),
        "market_cap": mcap,
        "fcf": g(cf, "freeCashFlow"),
        "shares": shares,
        "price": price,
    }


async def fetch_fundamentals(ticker: str) -> dict:
    """Fundamentals with 1h cache: FMP first, Yahoo crumb as fallback."""
    hit = _FUND_CACHE.get(ticker)
    if hit and (time.time() - hit[1]) < _FUND_TTL:
        return hit[0]

    data = {}
    if FMP_KEY:
        fmp = await fetch_fundamentals_fmp(ticker)
        if fmp.get("pe") is not None or fmp.get("market_cap") is not None:
            data = fmp
    if not data:
        data = await fetch_fundamentals_yahoo(ticker)

    if data:
        _FUND_CACHE[ticker] = (data, time.time())
    return data


async def fetch_fundamentals_yahoo(ticker: str) -> dict:
    """Fundamentals via Yahoo quoteSummary (crumb-authenticated). {} on failure."""
    modules = "summaryDetail,defaultKeyStatistics,financialData"
    for attempt in range(2):  # retry once with a fresh crumb on 401
        try:
            cookies, crumb = await _yahoo_auth(force=(attempt == 1))
        except Exception:
            return {}
        for host in YAHOO_QS_HOSTS:
            try:
                async with httpx.AsyncClient(timeout=15, headers=BROWSER_UA, cookies=cookies) as client:
                    r = await client.get(host.format(ticker=ticker),
                                         params={"modules": modules, "crumb": crumb})
                    if r.status_code in (401, 403):
                        break  # crumb stale -> break to outer loop, refresh
                    if r.status_code != 200:
                        continue
                    res = (r.json().get("quoteSummary") or {}).get("result")
                    if not res:
                        continue
                    d = res[0]
                    sd = d.get("summaryDetail", {}) or {}
                    ks = d.get("defaultKeyStatistics", {}) or {}
                    fd = d.get("financialData", {}) or {}

                    def raw(node, key):
                        v = (node.get(key) or {})
                        return v.get("raw") if isinstance(v, dict) else None

                    def pct(x):
                        return x * 100 if x is not None else None

                    return {
                        "pe": raw(sd, "trailingPE"),
                        "pb": raw(ks, "priceToBook"),
                        "roe": pct(raw(fd, "returnOnEquity")),
                        "debt_equity": raw(fd, "debtToEquity"),
                        "revenue_growth": pct(raw(fd, "revenueGrowth")),
                        "margin": pct(raw(fd, "profitMargins")),
                        "beta": raw(sd, "beta") or raw(ks, "beta"),
                        "market_cap": raw(sd, "marketCap"),
                        "fcf": raw(fd, "freeCashflow"),
                        "shares": raw(ks, "sharesOutstanding"),
                        "price": raw(fd, "currentPrice"),
                    }
            except Exception:
                continue
    return {}


# ---------------------------------------------------------------------------
# Indicator helpers
# ---------------------------------------------------------------------------
def _rolling_mean(a, n):
    a = np.asarray(a, float)
    out = np.full(len(a), np.nan)
    if len(a) >= n:
        c = np.cumsum(np.insert(a, 0, 0.0))
        out[n - 1:] = (c[n:] - c[:-n]) / n
    return out


def _rolling_std(a, n):
    a = np.asarray(a, float)
    out = np.full(len(a), np.nan)
    for i in range(n - 1, len(a)):
        out[i] = np.std(a[i - n + 1:i + 1], ddof=0)
    return out


def _ema(a, span):
    a = np.asarray(a, float)
    if len(a) == 0:
        return a
    alpha = 2.0 / (span + 1.0)
    out = np.empty_like(a)
    out[0] = a[0]
    for i in range(1, len(a)):
        out[i] = alpha * a[i] + (1 - alpha) * out[i - 1]
    return out


def _rsi(closes, n=14):
    closes = np.asarray(closes, float)
    out = np.full(len(closes), np.nan)
    d = np.diff(closes)
    if len(d) < n:
        return out
    gain = np.where(d > 0, d, 0.0)
    loss = np.where(d < 0, -d, 0.0)
    ag = np.mean(gain[:n]); al = np.mean(loss[:n])
    rs = ag / al if al != 0 else np.inf
    out[n] = 100 - 100 / (1 + rs)
    for i in range(n + 1, len(closes)):
        ag = (ag * (n - 1) + gain[i - 1]) / n
        al = (al * (n - 1) + loss[i - 1]) / n
        rs = ag / al if al != 0 else np.inf
        out[i] = 100 - 100 / (1 + rs)
    return out


def _stochastic(high, low, close, n=14, d_period=3):
    high = np.asarray(high, float); low = np.asarray(low, float); close = np.asarray(close, float)
    k = np.full(len(close), np.nan)
    for i in range(n - 1, len(close)):
        hh = np.max(high[i - n + 1:i + 1]); ll = np.min(low[i - n + 1:i + 1])
        k[i] = 100 * (close[i] - ll) / (hh - ll) if hh > ll else 50.0
    # %D is the SMA of %K. Compute nan-safe (k has leading NaNs, and a
    # cumsum-based rolling mean would propagate them across the whole array).
    d = np.full(len(close), np.nan)
    for i in range(len(close)):
        window = k[max(0, i - d_period + 1):i + 1]
        window = window[~np.isnan(window)]
        if len(window) == d_period:
            d[i] = float(np.mean(window))
    return k, d


def _series(dates, vals):
    return [{"date": dates[i], "value": round(float(vals[i]), 4)}
            for i in range(len(vals)) if not (vals[i] is None or (isinstance(vals[i], float) and np.isnan(vals[i])))]


def _max_drawdown(wealth):
    wealth = np.asarray(wealth, float)
    if len(wealth) == 0:
        return 0.0
    peak = np.maximum.accumulate(wealth)
    dd = (wealth - peak) / peak
    return float(np.min(dd))


def _future_dates(last_date, n):
    d = datetime.strptime(last_date, "%Y-%m-%d")
    out = []
    while len(out) < n:
        d += timedelta(days=1)
        if d.weekday() < 5:
            out.append(d.strftime("%Y-%m-%d"))
    return out


# ---------------------------------------------------------------------------
# Monte Carlo (unchanged)
# ---------------------------------------------------------------------------
async def _montecarlo(ticker: str, days: int, simulations: int) -> dict:
    ticker = (ticker or "AAPL").upper().strip()
    days = max(1, min(int(days), 1260))
    simulations = max(100, min(int(simulations), 20000))

    closes = await fetch_closes(ticker)
    arr = np.asarray(closes, dtype=float)
    log_ret = np.diff(np.log(arr))
    mu = float(np.mean(log_ret))
    sigma = float(np.std(log_ret, ddof=1))
    s0 = float(arr[-1])

    rng = np.random.default_rng()
    z = rng.standard_normal((simulations, days))
    increments = (mu - 0.5 * sigma ** 2) + sigma * z
    log_paths = np.cumsum(increments, axis=1)
    paths = s0 * np.exp(log_paths)
    paths = np.hstack([np.full((simulations, 1), s0), paths])

    percentiles = {
        name: np.percentile(paths, q, axis=0).round(4).tolist()
        for name, q in (("p5", 5), ("p25", 25), ("p50", 50), ("p75", 75), ("p95", 95))
    }
    final = paths[:, -1]
    stats = {
        "mean": float(np.mean(final)),
        "median": float(np.median(final)),
        "p5": float(np.percentile(final, 5)),
        "p95": float(np.percentile(final, 95)),
        "prob_positive": float(np.mean(final > s0)),
        "expected_return": float(np.mean(final) / s0 - 1.0),
    }
    return {
        "ticker": ticker, "start_price": s0, "days": days, "simulations": simulations,
        "mu": mu, "sigma": sigma, "percentiles": percentiles,
        "sample_paths": paths[:20].round(4).tolist(),
        "final_prices": final.round(4).tolist(), "stats": stats,
    }


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/montecarlo")
@app.get("/analytics/montecarlo")
async def montecarlo(ticker: str = "AAPL", days: int = 252, simulations: int = 1000):
    return await _montecarlo(ticker, days, simulations)


# ---------------------------------------------------------------------------
# Technicals
# ---------------------------------------------------------------------------
@app.get("/technicals")
@app.get("/analytics/technicals")
async def technicals(ticker: str = "AAPL", period: str = "6mo", indicators: str = "all"):
    ticker = ticker.upper().strip()
    data = await fetch_ohlcv(ticker, period)
    dates, o, h, l, c, v = data["dates"], data["open"], data["high"], data["low"], data["close"], data["volume"]
    close = np.asarray(c, float)

    sma20 = _rolling_mean(close, 20); sma50 = _rolling_mean(close, 50); sma200 = _rolling_mean(close, 200)
    std20 = _rolling_std(close, 20)
    bb_upper = sma20 + 2 * std20
    bb_lower = sma20 - 2 * std20
    rsi = _rsi(close, 14)
    e12 = _ema(close, 12); e26 = _ema(close, 26)
    macd_line = e12 - e26
    signal_line = _ema(macd_line, 9)
    hist = macd_line - signal_line
    k, d = _stochastic(h, l, c, 14, 3)

    candles = [{"date": dates[i], "open": round(o[i], 4), "high": round(h[i], 4),
                "low": round(l[i], 4), "close": round(c[i], 4)} for i in range(len(dates))]
    volumes = [{"date": dates[i], "value": v[i]} for i in range(len(dates))]

    macd_out = [{"date": dates[i], "macd": round(float(macd_line[i]), 4),
                 "signal": round(float(signal_line[i]), 4), "histogram": round(float(hist[i]), 4)}
                for i in range(26, len(dates))]
    stoch_out = [{"date": dates[i], "k": round(float(k[i]), 2), "d": round(float(d[i]), 2)}
                 for i in range(len(dates)) if not np.isnan(k[i]) and not np.isnan(d[i])]

    # --- signals ---
    last = close[-1]
    def lastval(a):
        a = a[~np.isnan(a)]
        return float(a[-1]) if len(a) else None

    r_last = lastval(rsi)
    sig_rsi = "oversold" if (r_last is not None and r_last < 30) else "overbought" if (r_last is not None and r_last > 70) else "neutral"
    sig_macd = "bullish" if macd_line[-1] > signal_line[-1] else "bearish"
    s20, s50 = lastval(sma20), lastval(sma50)
    sig_sma_cross = "bullish" if (s20 and s50 and s20 > s50) else "bearish"
    sig_price_vs_sma = "bullish" if (s50 and last > s50) else "bearish"
    k_last = lastval(k)
    sig_stoch = "oversold" if (k_last is not None and k_last < 20) else "overbought" if (k_last is not None and k_last > 80) else "neutral"
    bu, bl = lastval(bb_upper), lastval(bb_lower)
    sig_bb = "overbought" if (bu and last > bu) else "oversold" if (bl and last < bl) else "neutral"

    bull = sum([
        sig_rsi == "oversold", sig_macd == "bullish", sig_sma_cross == "bullish",
        sig_price_vs_sma == "bullish", sig_stoch == "oversold", sig_bb == "oversold",
    ])
    bear = sum([
        sig_rsi == "overbought", sig_macd == "bearish", sig_sma_cross == "bearish",
        sig_price_vs_sma == "bearish", sig_stoch == "overbought", sig_bb == "overbought",
    ])
    net = bull - bear
    overall = ("STRONG BUY" if net >= 3 else "BUY" if net >= 1 else
               "STRONG SELL" if net <= -3 else "SELL" if net <= -1 else "NEUTRAL")

    return {
        "ticker": ticker, "period": period,
        "candles": candles, "volumes": volumes,
        "sma20": _series(dates, sma20), "sma50": _series(dates, sma50), "sma200": _series(dates, sma200),
        "bb_upper": _series(dates, bb_upper), "bb_lower": _series(dates, bb_lower),
        "rsi": _series(dates, rsi), "macd": macd_out, "stochastic": stoch_out,
        "signals": {"rsi": sig_rsi, "macd": sig_macd, "sma_cross": sig_sma_cross,
                    "price_vs_sma": sig_price_vs_sma, "stochastic": sig_stoch, "bollinger": sig_bb},
        "overall_signal": overall,
    }


# ---------------------------------------------------------------------------
# Forecast
# ---------------------------------------------------------------------------
@app.get("/forecast")
@app.get("/analytics/forecast")
async def forecast(ticker: str = "AAPL", days: int = 30, method: str = "ensemble"):
    ticker = ticker.upper().strip()
    days = max(1, min(int(days), 365))
    data = await fetch_ohlcv(ticker, "1y")
    dates, c = data["dates"], np.asarray(data["close"], float)
    last = float(c[-1])
    logret = np.diff(np.log(c))
    sigma = float(np.std(logret, ddof=1))

    n = len(c)
    lookback = min(90, n)
    x = np.arange(lookback)
    prices_lb = c[-lookback:]
    slope, intercept = np.polyfit(x, prices_lb, 1)

    ema_ret = float(_ema(logret, 10)[-1])
    target = float(np.mean(c[-min(60, n):]))
    half_life = 20.0
    lam = 0.5 ** (1.0 / half_life)

    fdates = _future_dates(dates[-1], days)
    t = np.arange(1, days + 1)

    linear = intercept + slope * (lookback - 1 + t)
    ema_f = last * np.exp(ema_ret * t)
    mr = target + (last - target) * (lam ** t)
    ensemble = (linear + ema_f + mr) / 3.0

    method_map = {"linear": linear, "ema": ema_f, "mean_reversion": mr, "ensemble": ensemble}
    chosen = method_map.get(method, ensemble)

    z = 1.28  # ~80% band
    band = z * sigma * np.sqrt(t)
    upper = chosen * (1 + band)
    lower = chosen * (1 - band)

    def pts(arr):
        return [{"date": fdates[i], "price": round(float(arr[i]), 4)} for i in range(days)]

    predicted = float(chosen[-1])
    exp_ret = predicted / last - 1.0
    trend = "bullish" if exp_ret > 0.02 else "bearish" if exp_ret < -0.02 else "neutral"

    return {
        "ticker": ticker, "method": method, "days": days,
        "historical": [{"date": dates[i], "price": round(float(c[i]), 4)} for i in range(max(0, n - 120), n)],
        "forecast": pts(chosen),
        "method_forecasts": {k: pts(vv) for k, vv in method_map.items()},
        "upper_band": pts(upper), "lower_band": pts(lower),
        "summary": {
            "predicted_price": predicted,
            "expected_return": exp_ret,
            "trend": trend,
            "confidence_low": float(lower[-1]),
            "confidence_high": float(upper[-1]),
            "daily_volatility": sigma,
            "annual_volatility": sigma * math.sqrt(252),
        },
    }


# ---------------------------------------------------------------------------
# Backtest
# ---------------------------------------------------------------------------
def _signal_series(close, strategy, fast_ma, slow_ma):
    n = len(close)
    close = np.asarray(close, float)
    sig = np.zeros(n)
    if strategy == "sma_cross":
        fast = _rolling_mean(close, fast_ma); slow = _rolling_mean(close, slow_ma)
        for i in range(n):
            if not np.isnan(fast[i]) and not np.isnan(slow[i]):
                sig[i] = 1.0 if fast[i] > slow[i] else 0.0
    elif strategy == "rsi":
        rsi = _rsi(close, 14)
        pos = 0.0
        for i in range(n):
            if not np.isnan(rsi[i]):
                if rsi[i] < 30: pos = 1.0
                elif rsi[i] > 70: pos = 0.0
            sig[i] = pos
    else:  # mean_reversion
        sma = _rolling_mean(close, max(fast_ma, 20))
        pos = 0.0
        for i in range(n):
            if not np.isnan(sma[i]):
                if close[i] < sma[i] * 0.98: pos = 1.0
                elif close[i] > sma[i]: pos = 0.0
            sig[i] = pos
    return sig


@app.get("/backtest")
@app.get("/analytics/backtest")
async def backtest(ticker: str = "AAPL", fast_ma: int = 20, slow_ma: int = 50,
                   period: str = "2y", capital: float = 100000, strategy: str = "sma_cross"):
    ticker = ticker.upper().strip()
    capital = float(capital)
    fast_ma = max(2, int(fast_ma)); slow_ma = max(fast_ma + 1, int(slow_ma))
    data = await fetch_ohlcv(ticker, period)
    dates, c = data["dates"], data["close"]
    sig = _signal_series(c, strategy, fast_ma, slow_ma)

    cash = capital; shares = 0; position = 0; entry = 0.0
    equity_curve = []; trades = []
    for i in range(len(c)):
        price = c[i]
        if sig[i] == 1 and position == 0:
            shares = int(cash // price)
            if shares > 0:
                cash -= shares * price; position = 1; entry = price
                trades.append({"date": dates[i], "type": "BUY", "price": round(price, 2), "shares": shares, "pnl": 0.0})
        elif sig[i] == 0 and position == 1:
            pnl = (price - entry) * shares
            cash += shares * price
            trades.append({"date": dates[i], "type": "SELL", "price": round(price, 2), "shares": shares, "pnl": round(pnl, 2)})
            shares = 0; position = 0
        equity_curve.append({"date": dates[i], "value": round(cash + shares * price, 2)})

    bh_shares = int(capital // c[0]); bh_cash = capital - bh_shares * c[0]
    buy_hold_curve = [{"date": dates[i], "value": round(bh_cash + bh_shares * c[i], 2)} for i in range(len(c))]

    eq = np.array([e["value"] for e in equity_curve], float)
    eq_ret = np.diff(eq) / eq[:-1]
    sharpe = float(np.mean(eq_ret) / np.std(eq_ret) * math.sqrt(252)) if np.std(eq_ret) > 0 else 0.0
    sells = [t for t in trades if t["type"] == "SELL"]
    wins = [t for t in sells if t["pnl"] > 0]
    gross_profit = sum(t["pnl"] for t in wins)
    gross_loss = -sum(t["pnl"] for t in sells if t["pnl"] < 0)
    stats = {
        "total_return": float(eq[-1] / capital - 1.0),
        "buy_hold_return": float(buy_hold_curve[-1]["value"] / capital - 1.0),
        "sharpe": sharpe,
        "max_drawdown": _max_drawdown(eq),
        "win_rate": (len(wins) / len(sells)) if sells else 0.0,
        "profit_factor": (gross_profit / gross_loss) if gross_loss > 0 else (float("inf") if gross_profit > 0 else 0.0),
        "total_trades": len(sells),
    }
    if not math.isfinite(stats["profit_factor"]):
        stats["profit_factor"] = round(gross_profit, 2) if gross_profit > 0 else 0.0

    return {"ticker": ticker, "strategy": strategy, "stats": stats,
            "trades": trades, "equity_curve": equity_curve, "buy_hold_curve": buy_hold_curve}


# ---------------------------------------------------------------------------
# Factor analysis
# ---------------------------------------------------------------------------
def _minmax_scores(raw):
    """raw: list of floats/None -> 0-100 scores, None->neutral fill."""
    vals = [v for v in raw if v is not None and not (isinstance(v, float) and math.isnan(v))]
    if not vals:
        return [50.0] * len(raw)
    lo, hi = min(vals), max(vals)
    rng = hi - lo
    out = []
    for v in raw:
        if v is None or (isinstance(v, float) and math.isnan(v)):
            out.append(50.0)
        elif rng == 0:
            out.append(50.0)
        else:
            out.append(round(100 * (v - lo) / rng, 1))
    return out


@app.get("/factors")
@app.get("/analytics/factors")
async def factors(tickers: str = "AAPL,MSFT,GOOG,AMZN,META", period: str = "1y"):
    tick_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:10]
    if not tick_list:
        raise HTTPException(status_code=400, detail="no tickers provided")

    rows = []
    for t in tick_list:
        try:
            closes = np.asarray(await fetch_closes(t, period), float)
            fund = await fetch_fundamentals(t)
            logret = np.diff(np.log(closes))
            mom = float(closes[-1] / closes[0] - 1.0)
            vol = float(np.std(logret, ddof=1) * math.sqrt(252))
            rows.append({"ticker": t, "mom": mom, "vol": vol, "fund": fund})
        except HTTPException:
            continue
    if not rows:
        return {"results": []}

    raw_mom = [r["mom"] for r in rows]
    raw_vol = [-r["vol"] for r in rows]  # lower vol -> higher score
    raw_size = [(math.log(r["fund"]["market_cap"]) if r["fund"].get("market_cap") else None) for r in rows]
    raw_value = [(1.0 / r["fund"]["pe"] if r["fund"].get("pe") and r["fund"]["pe"] > 0 else None) for r in rows]
    raw_quality = [r["fund"].get("roe") for r in rows]

    s_mom = _minmax_scores(raw_mom); s_vol = _minmax_scores(raw_vol)
    s_size = _minmax_scores(raw_size); s_value = _minmax_scores(raw_value)
    s_quality = _minmax_scores(raw_quality)

    results = []
    for i, r in enumerate(rows):
        f = r["fund"]
        fac = {"value": s_value[i], "momentum": s_mom[i], "quality": s_quality[i],
               "volatility": s_vol[i], "size": s_size[i]}
        composite = round(float(np.mean(list(fac.values()))), 1)
        results.append({
            "ticker": r["ticker"], "factors": fac, "composite_score": composite,
            "metrics": {
                "pe": f.get("pe"), "pb": f.get("pb"), "roe": f.get("roe"),
                "debt_equity": f.get("debt_equity"), "revenue_growth": f.get("revenue_growth"),
                "margin": f.get("margin"), "beta": f.get("beta"), "market_cap": f.get("market_cap"),
            },
        })
    return {"results": results}


# ---------------------------------------------------------------------------
# Returns matrix helper (optimizer + portfolio)
# ---------------------------------------------------------------------------
async def _returns_matrix(tick_list, period):
    series = {}
    for t in tick_list:
        series[t] = np.asarray(await fetch_closes(t, period), float)
    L = min(len(v) for v in series.values())
    L = max(L, 3)
    closes = np.column_stack([series[t][-L:] for t in tick_list])  # (L, n)
    dates_src = await fetch_ohlcv(tick_list[0], period)
    dates = dates_src["dates"][-L:]
    rets = np.diff(closes, axis=0) / closes[:-1]  # (L-1, n)
    return closes, rets, dates


@app.get("/optimizer")
@app.get("/analytics/optimizer")
async def optimizer(tickers: str = "AAPL,MSFT,GOOG,AMZN", period: str = "1y", method: str = "max_sharpe"):
    tick_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:12]
    if len(tick_list) < 2:
        raise HTTPException(status_code=400, detail="need at least 2 tickers")
    _, rets, _ = await _returns_matrix(tick_list, period)
    n = len(tick_list)
    mean_a = rets.mean(axis=0) * 252
    cov_a = np.cov(rets.T) * 252
    if cov_a.ndim == 0:
        cov_a = cov_a.reshape(1, 1)

    def perf(w):
        ret = float(w @ mean_a)
        vol = float(math.sqrt(max(w @ cov_a @ w, 1e-12)))
        sharpe = (ret - RF) / vol if vol > 0 else 0.0
        return ret, vol, sharpe

    rng = np.random.default_rng(42)
    N = 6000
    W = rng.random((N, n)); W /= W.sum(axis=1, keepdims=True)
    perfs = np.array([perf(w) for w in W])  # (N,3)

    if method == "min_vol":
        w_opt = W[int(np.argmin(perfs[:, 1]))]
    elif method == "risk_parity":
        asset_vol = np.sqrt(np.diag(cov_a))
        w_opt = (1.0 / asset_vol); w_opt /= w_opt.sum()
    elif method == "equal":
        w_opt = np.full(n, 1.0 / n)
    else:  # max_sharpe
        w_opt = W[int(np.argmax(perfs[:, 2]))]

    o_ret, o_vol, o_sharpe = perf(w_opt)
    eq = np.full(n, 1.0 / n); e_ret, e_vol, e_sharpe = perf(eq)

    # efficient frontier: bin by vol, take max-return per bin
    order = np.argsort(perfs[:, 1])
    fr = perfs[order]
    pts = []
    step = max(1, len(fr) // 60)
    running_max = -1e9
    for i in range(0, len(fr), step):
        chunk = fr[i:i + step]
        best = chunk[int(np.argmax(chunk[:, 0]))]
        if best[0] >= running_max:
            running_max = best[0]
            pts.append({"vol": round(float(best[1]), 4), "ret": round(float(best[0]), 4)})

    assets = []
    for i, t in enumerate(tick_list):
        assets.append({"ticker": t, "vol": round(float(math.sqrt(cov_a[i, i])), 4),
                       "ret": round(float(mean_a[i]), 4)})

    return {
        "method": method,
        "weights": {tick_list[i]: round(float(w_opt[i]), 4) for i in range(n)},
        "stats": {"expected_return": o_ret, "volatility": o_vol, "sharpe": o_sharpe},
        "frontier": {"points": pts, "optimal": {"vol": round(o_vol, 4), "ret": round(o_ret, 4)}, "assets": assets},
        "comparison": {
            "optimal": {"expected_return": o_ret, "volatility": o_vol, "sharpe": o_sharpe},
            "equal_weight": {"expected_return": e_ret, "volatility": e_vol, "sharpe": e_sharpe},
        },
    }


@app.get("/portfolio")
@app.get("/analytics/portfolio")
async def portfolio(tickers: str = "AAPL,MSFT,GOOG", weights: str = "0.4,0.3,0.3", period: str = "1y"):
    tick_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:12]
    if len(tick_list) < 1:
        raise HTTPException(status_code=400, detail="need at least 1 ticker")
    try:
        w = np.array([float(x) for x in weights.split(",") if x.strip()])
    except ValueError:
        w = np.array([])
    if len(w) != len(tick_list) or w.sum() == 0:
        w = np.full(len(tick_list), 1.0 / len(tick_list))
    w = w / w.sum()

    _, rets, dates = await _returns_matrix(tick_list, period)
    rdates = dates[1:]  # returns line up after the first close
    port = rets @ w

    ann_ret = float(np.mean(port) * 252)
    ann_vol = float(np.std(port, ddof=1) * math.sqrt(252))
    sharpe = (ann_ret - RF) / ann_vol if ann_vol > 0 else 0.0
    downside = port[port < 0]
    dd_std = float(np.std(downside, ddof=1) * math.sqrt(252)) if len(downside) > 1 else 0.0
    sortino = (ann_ret - RF) / dd_std if dd_std > 0 else 0.0
    var_95 = float(np.percentile(port, 5))
    cvar = float(np.mean(port[port <= var_95])) if np.any(port <= var_95) else var_95

    wealth = np.cumprod(1 + port)
    cum = wealth - 1
    cumulative_returns = [{"date": rdates[i], "value": round(float(cum[i]), 4)} for i in range(len(cum))]

    roll = []
    win = 30
    for i in range(win, len(port)):
        seg = port[i - win:i]
        s = np.std(seg, ddof=1)
        val = float(np.mean(seg) / s * math.sqrt(252)) if s > 0 else 0.0
        roll.append({"date": rdates[i], "value": round(val, 4)})

    corr = np.corrcoef(rets.T)
    if corr.ndim == 0:
        corr = np.array([[1.0]])
    matrix = [[round(float(corr[i, j]), 3) for j in range(len(tick_list))] for i in range(len(tick_list))]

    asset_stats = []
    for i, t in enumerate(tick_list):
        a = rets[:, i]
        a_ret = float(np.mean(a) * 252); a_vol = float(np.std(a, ddof=1) * math.sqrt(252))
        a_sharpe = (a_ret - RF) / a_vol if a_vol > 0 else 0.0
        a_down = a[a < 0]
        a_dstd = float(np.std(a_down, ddof=1) * math.sqrt(252)) if len(a_down) > 1 else 0.0
        a_sortino = (a_ret - RF) / a_dstd if a_dstd > 0 else 0.0
        a_wealth = np.cumprod(1 + a)
        asset_stats.append({"ticker": t, "annual_return": a_ret, "annual_vol": a_vol,
                            "sharpe": a_sharpe, "max_drawdown": _max_drawdown(a_wealth), "sortino": a_sortino})

    return {
        "tickers": tick_list, "sharpe": sharpe, "sortino": sortino,
        "var_95": var_95, "cvar": cvar, "max_drawdown": _max_drawdown(wealth),
        "annual_return": ann_ret, "annual_vol": ann_vol,
        "cumulative_returns": cumulative_returns, "rolling_sharpe": roll,
        "correlation": {"tickers": tick_list, "matrix": matrix},
        "asset_stats": asset_stats,
    }


# ---------------------------------------------------------------------------
# DCF valuation
# ---------------------------------------------------------------------------
def _dcf_per_share(base_fcf, shares, growth, terminal_growth, wacc, years):
    if wacc <= terminal_growth:
        wacc = terminal_growth + 0.01
    disc_fcfs = []
    ev = 0.0
    fcf_t = base_fcf
    for t in range(1, years + 1):
        fcf_t = base_fcf * (1 + growth) ** t
        disc = fcf_t / (1 + wacc) ** t
        disc_fcfs.append(disc); ev += disc
    terminal = fcf_t * (1 + terminal_growth) / (wacc - terminal_growth)
    disc_terminal = terminal / (1 + wacc) ** years
    ev += disc_terminal
    return ev / shares if shares else 0.0, disc_fcfs, disc_terminal, ev


@app.get("/dcf")
@app.get("/analytics/dcf")
async def dcf(ticker: str = "AAPL", growth: float = 0.08, terminal_growth: float = 0.03,
              wacc: float = 0.10, years: int = 5):
    ticker = ticker.upper().strip()
    years = max(1, min(int(years), 15))
    closes = await fetch_closes(ticker, "1y")
    current_price = float(closes[-1])
    fund = await fetch_fundamentals(ticker)

    market_cap = fund.get("market_cap")
    shares = fund.get("shares")
    base_fcf = fund.get("fcf")

    if not shares and market_cap:
        shares = market_cap / current_price
    if not shares:
        shares = 1_000_000_000.0  # fallback
    if not base_fcf:
        base_fcf = (market_cap * 0.04) if market_cap else (current_price * shares * 0.04)

    intrinsic, disc_fcfs, disc_terminal, ev = _dcf_per_share(
        base_fcf, shares, growth, terminal_growth, wacc, years)

    fcf_projections = [{"year": f"Y{t}", "value": round(base_fcf * (1 + growth) ** t, 2)}
                       for t in range(1, years + 1)]
    waterfall = [{"label": f"PV Y{t}", "value": round(disc_fcfs[t - 1], 2)} for t in range(1, years + 1)]
    waterfall.append({"label": "PV Terminal", "value": round(disc_terminal, 2)})

    wacc_range = [round(wacc + d, 4) for d in (-0.02, -0.01, 0.0, 0.01, 0.02)]
    growth_range = [round(growth + d, 4) for d in (-0.02, -0.01, 0.0, 0.01, 0.02)]
    values = []
    for w in wacc_range:
        row = []
        for g in growth_range:
            iv, *_ = _dcf_per_share(base_fcf, shares, g, terminal_growth, w, years)
            row.append(round(iv, 2))
        values.append(row)

    return {
        "ticker": ticker, "intrinsic_value": round(intrinsic, 2), "current_price": round(current_price, 2),
        "enterprise_value": round(ev, 2), "shares_outstanding": shares,
        "fcf_projections": fcf_projections, "waterfall": waterfall,
        "sensitivity": {"wacc_range": wacc_range, "growth_range": growth_range, "values": values},
    }


# ---------------------------------------------------------------------------
# Options (Black-Scholes)
# ---------------------------------------------------------------------------
def _ncdf(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def _npdf(x):
    return math.exp(-x * x / 2) / math.sqrt(2 * math.pi)


def _bs(spot, strike, time, rate, vol, opt_type):
    if time <= 0 or vol <= 0:
        intrinsic = max(spot - strike, 0.0) if opt_type == "call" else max(strike - spot, 0.0)
        return {"price": intrinsic, "delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}
    sqrt_t = math.sqrt(time)
    d1 = (math.log(spot / strike) + (rate + 0.5 * vol ** 2) * time) / (vol * sqrt_t)
    d2 = d1 - vol * sqrt_t
    disc = math.exp(-rate * time)
    if opt_type == "call":
        price = spot * _ncdf(d1) - strike * disc * _ncdf(d2)
        delta = _ncdf(d1)
        theta = (-(spot * _npdf(d1) * vol) / (2 * sqrt_t) - rate * strike * disc * _ncdf(d2)) / 365
        rho = strike * time * disc * _ncdf(d2) / 100
    else:
        price = strike * disc * _ncdf(-d2) - spot * _ncdf(-d1)
        delta = _ncdf(d1) - 1
        theta = (-(spot * _npdf(d1) * vol) / (2 * sqrt_t) + rate * strike * disc * _ncdf(-d2)) / 365
        rho = -strike * time * disc * _ncdf(-d2) / 100
    gamma = _npdf(d1) / (spot * vol * sqrt_t)
    vega = spot * _npdf(d1) * sqrt_t / 100
    return {"price": price, "delta": delta, "gamma": gamma, "theta": theta, "vega": vega, "rho": rho}


def _implied_vol(market_price, spot, strike, time, rate, opt_type):
    lo, hi = 0.001, 5.0
    for _ in range(100):
        mid = (lo + hi) / 2
        p = _bs(spot, strike, time, rate, mid, opt_type)["price"]
        if abs(p - market_price) < 1e-4:
            return mid
        if p > market_price:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


@app.get("/options")
@app.get("/analytics/options")
async def options(spot: float = 150, strike: float = 155, time: float = 0.25,
                  rate: float = 0.05, vol: float = 0.3, type: str = "call",
                  market_price: float = None):
    opt_type = "put" if str(type).lower().startswith("p") else "call"
    spot = float(spot); strike = float(strike); time = float(time); rate = float(rate); vol = float(vol)
    g = _bs(spot, strike, time, rate, vol, opt_type)
    out = {k: round(v, 6) for k, v in g.items()}
    out["type"] = opt_type

    if market_price is not None:
        try:
            out["implied_volatility"] = round(_implied_vol(float(market_price), spot, strike, time, rate, opt_type), 6)
        except Exception:
            out["implied_volatility"] = None

    vol_range = [round(vol * f, 4) for f in (0.5, 0.75, 1.0, 1.25, 1.5)]
    strike_range = [round(strike * f, 2) for f in (0.9, 0.95, 1.0, 1.05, 1.1)]
    values = [[round(_bs(spot, k, time, rate, vv, opt_type)["price"], 2) for k in strike_range]
              for vv in vol_range]
    out["surface"] = {"vol_range": vol_range, "strike_range": strike_range, "values": values}
    return out
