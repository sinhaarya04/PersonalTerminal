"""
E[X] / Terminal analytics backend — FastAPI service on Fly.io.

Serves the /analytics/* endpoints the terminal frontend calls. First up:
Monte Carlo (geometric Brownian motion). Price history is pulled from Yahoo
Finance (same source the terminal already uses), drift + vol are estimated
from ~2y of daily log returns, then paths are simulated with numpy.

The terminal calls `/analytics/montecarlo`; Vercel rewrites `/analytics/(.*)`
to `https://<app>.fly.dev/$1`, so this app receives `/montecarlo`. Both paths
are registered to be safe.
"""

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


async def fetch_closes(ticker: str, rng: str = "2y", interval: str = "1d") -> list[float]:
    """Daily closing prices for a ticker from Yahoo Finance."""
    url = YAHOO_CHART.format(ticker=ticker)
    params = {"range": rng, "interval": interval}
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, params=params, headers=headers)
            r.raise_for_status()
            payload = r.json()
    except Exception as e:  # network / upstream failure
        raise HTTPException(status_code=502, detail=f"price fetch failed: {e}")

    result = (payload.get("chart") or {}).get("result")
    if not result:
        raise HTTPException(status_code=404, detail=f"no data for '{ticker}'")
    quote = result[0]["indicators"]["quote"][0]
    closes = [c for c in quote.get("close", []) if c is not None]
    if len(closes) < 30:
        raise HTTPException(status_code=400, detail="not enough price history")
    return closes


@app.get("/health")
def health():
    return {"ok": True}


async def _montecarlo(ticker: str, days: int, simulations: int) -> dict:
    ticker = (ticker or "AAPL").upper().strip()
    days = max(1, min(int(days), 1260))            # cap ~5y
    simulations = max(100, min(int(simulations), 20000))

    closes = await fetch_closes(ticker)
    arr = np.asarray(closes, dtype=float)
    log_ret = np.diff(np.log(arr))
    mu = float(np.mean(log_ret))                    # daily drift
    sigma = float(np.std(log_ret, ddof=1))          # daily vol
    s0 = float(arr[-1])

    rng = np.random.default_rng()
    z = rng.standard_normal((simulations, days))
    increments = (mu - 0.5 * sigma ** 2) + sigma * z
    log_paths = np.cumsum(increments, axis=1)
    paths = s0 * np.exp(log_paths)                  # (sims, days)
    # prepend the known starting price so every path begins at s0
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
        "ticker": ticker,
        "start_price": s0,
        "days": days,
        "simulations": simulations,
        "mu": mu,
        "sigma": sigma,
        "percentiles": percentiles,
        "sample_paths": paths[:20].round(4).tolist(),
        "final_prices": final.round(4).tolist(),
        "stats": stats,
    }


@app.get("/montecarlo")
@app.get("/analytics/montecarlo")
async def montecarlo(ticker: str = "AAPL", days: int = 252, simulations: int = 1000):
    return await _montecarlo(ticker, days, simulations)
