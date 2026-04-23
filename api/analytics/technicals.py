from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs
import numpy as np
import yfinance as yf

def sma(data, period):
    result = [None] * len(data)
    for i in range(period - 1, len(data)):
        result[i] = float(np.mean(data[i - period + 1:i + 1]))
    return result

def ema(data, period):
    result = [None] * len(data)
    alpha = 2 / (period + 1)
    result[period - 1] = float(np.mean(data[:period]))
    for i in range(period, len(data)):
        result[i] = alpha * data[i] + (1 - alpha) * result[i - 1]
    return result

def rsi(closes, period=14):
    result = [None] * len(closes)
    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    avg_gain = float(np.mean(gains[:period]))
    avg_loss = float(np.mean(losses[:period]))
    for i in range(period, len(closes)):
        if avg_loss == 0:
            result[i] = 100
        else:
            rs = avg_gain / avg_loss
            result[i] = round(100 - (100 / (1 + rs)), 2)
        if i < len(deltas):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    return result

def macd(closes, fast=12, slow=26, signal=9):
    fast_ema = ema(closes, fast)
    slow_ema = ema(closes, slow)
    macd_line = [None] * len(closes)
    for i in range(len(closes)):
        if fast_ema[i] is not None and slow_ema[i] is not None:
            macd_line[i] = round(fast_ema[i] - slow_ema[i], 4)
    valid = [v for v in macd_line if v is not None]
    signal_line = [None] * len(closes)
    if len(valid) >= signal:
        sig = ema(valid, signal)
        offset = len(closes) - len(valid)
        for i in range(len(sig)):
            if sig[i] is not None:
                signal_line[offset + i] = round(sig[i], 4)
    histogram = [None] * len(closes)
    for i in range(len(closes)):
        if macd_line[i] is not None and signal_line[i] is not None:
            histogram[i] = round(macd_line[i] - signal_line[i], 4)
    return macd_line, signal_line, histogram

def bollinger(closes, period=20, mult=2):
    upper = [None] * len(closes)
    middle = [None] * len(closes)
    lower = [None] * len(closes)
    for i in range(period - 1, len(closes)):
        window = closes[i - period + 1:i + 1]
        m = float(np.mean(window))
        s = float(np.std(window))
        middle[i] = round(m, 2)
        upper[i] = round(m + mult * s, 2)
        lower[i] = round(m - mult * s, 2)
    return upper, middle, lower

def stochastic(highs, lows, closes, k_period=14, d_period=3):
    k = [None] * len(closes)
    for i in range(k_period - 1, len(closes)):
        h = max(highs[i - k_period + 1:i + 1])
        l = min(lows[i - k_period + 1:i + 1])
        if h != l:
            k[i] = round((closes[i] - l) / (h - l) * 100, 2)
        else:
            k[i] = 50
    valid_k = [v for v in k if v is not None]
    d = [None] * len(closes)
    if len(valid_k) >= d_period:
        d_vals = sma(valid_k, d_period)
        offset = len(closes) - len(valid_k)
        for i in range(len(d_vals)):
            if d_vals[i] is not None:
                d[offset + i] = round(d_vals[i], 2)
    return k, d

def atr(highs, lows, closes, period=14):
    result = [None] * len(closes)
    trs = []
    for i in range(1, len(closes)):
        tr = max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1]))
        trs.append(tr)
    if len(trs) >= period:
        avg = float(np.mean(trs[:period]))
        result[period] = round(avg, 2)
        for i in range(period + 1, len(closes)):
            avg = (avg * (period - 1) + trs[i - 1]) / period
            result[i] = round(avg, 2)
    return result

def obv(closes, volumes):
    result = [0]
    for i in range(1, len(closes)):
        if closes[i] > closes[i - 1]:
            result.append(result[-1] + volumes[i])
        elif closes[i] < closes[i - 1]:
            result.append(result[-1] - volumes[i])
        else:
            result.append(result[-1])
    return result

def adx(highs, lows, closes, period=14):
    result = [None] * len(closes)
    if len(closes) < period * 2:
        return result
    plus_dm = []
    minus_dm = []
    tr_list = []
    for i in range(1, len(closes)):
        up = highs[i] - highs[i - 1]
        down = lows[i - 1] - lows[i]
        plus_dm.append(up if up > down and up > 0 else 0)
        minus_dm.append(down if down > up and down > 0 else 0)
        tr_list.append(max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1])))
    if len(tr_list) < period:
        return result
    atr_val = sum(tr_list[:period])
    plus_di = sum(plus_dm[:period])
    minus_di = sum(minus_dm[:period])
    dx_list = []
    for i in range(period, len(tr_list)):
        atr_val = atr_val - atr_val / period + tr_list[i]
        plus_di = plus_di - plus_di / period + plus_dm[i]
        minus_di = minus_di - minus_di / period + minus_dm[i]
        pdi = (plus_di / atr_val * 100) if atr_val > 0 else 0
        mdi = (minus_di / atr_val * 100) if atr_val > 0 else 0
        dx = abs(pdi - mdi) / (pdi + mdi) * 100 if (pdi + mdi) > 0 else 0
        dx_list.append(dx)
        if len(dx_list) >= period:
            adx_val = sum(dx_list[-period:]) / period
            result[i + 1] = round(adx_val, 2)
    return result

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        try:
            ticker = query.get('ticker', ['AAPL'])[0]
            period = query.get('period', ['6mo'])[0]
            indicators_str = query.get('indicators', ['all'])[0]

            stock = yf.Ticker(ticker)
            hist = stock.history(period=period)
            if hist.empty:
                raise ValueError(f"No data for {ticker}")

            opens = hist['Open'].values.tolist()
            highs = hist['High'].values.tolist()
            lows = hist['Low'].values.tolist()
            closes = hist['Close'].values.tolist()
            volumes = hist['Volume'].values.tolist()
            dates = [str(d.date()) for d in hist.index]

            # Downsample if too many points
            step = max(1, len(dates) // 300)
            idx = list(range(0, len(dates), step))

            ohlcv = [{'date': dates[i], 'o': round(opens[i], 2), 'h': round(highs[i], 2),
                       'l': round(lows[i], 2), 'c': round(closes[i], 2), 'v': int(volumes[i])} for i in idx]

            result_indicators = {}

            want_all = indicators_str == 'all'
            wanted = set(indicators_str.split(',')) if not want_all else set()

            if want_all or 'sma' in wanted:
                result_indicators['sma20'] = [{'date': dates[i], 'value': sma(closes, 20)[i]} for i in idx if sma(closes, 20)[i] is not None]
                result_indicators['sma50'] = [{'date': dates[i], 'value': sma(closes, 50)[i]} for i in idx if sma(closes, 50)[i] is not None]
                result_indicators['sma200'] = [{'date': dates[i], 'value': sma(closes, 200)[i]} for i in idx if sma(closes, 200)[i] is not None]

            if want_all or 'ema' in wanted:
                result_indicators['ema12'] = [{'date': dates[i], 'value': round(ema(closes, 12)[i], 2)} for i in idx if ema(closes, 12)[i] is not None]
                result_indicators['ema26'] = [{'date': dates[i], 'value': round(ema(closes, 26)[i], 2)} for i in idx if ema(closes, 26)[i] is not None]

            if want_all or 'rsi' in wanted:
                rsi_vals = rsi(closes)
                result_indicators['rsi'] = [{'date': dates[i], 'value': rsi_vals[i]} for i in idx if rsi_vals[i] is not None]

            if want_all or 'macd' in wanted:
                m_line, m_sig, m_hist = macd(closes)
                result_indicators['macd'] = [{'date': dates[i], 'line': m_line[i], 'signal': m_sig[i], 'histogram': m_hist[i]}
                                              for i in idx if m_line[i] is not None]

            if want_all or 'bollinger' in wanted:
                b_upper, b_mid, b_lower = bollinger(closes)
                result_indicators['bollinger'] = [{'date': dates[i], 'upper': b_upper[i], 'middle': b_mid[i], 'lower': b_lower[i]}
                                                   for i in idx if b_upper[i] is not None]

            if want_all or 'stochastic' in wanted:
                sk, sd = stochastic(highs, lows, closes)
                result_indicators['stochastic'] = [{'date': dates[i], 'k': sk[i], 'd': sd[i]}
                                                    for i in idx if sk[i] is not None]

            if want_all or 'atr' in wanted:
                atr_vals = atr(highs, lows, closes)
                result_indicators['atr'] = [{'date': dates[i], 'value': atr_vals[i]} for i in idx if atr_vals[i] is not None]

            if want_all or 'obv' in wanted:
                obv_vals = obv(closes, volumes)
                result_indicators['obv'] = [{'date': dates[i], 'value': obv_vals[i]} for i in idx]

            if want_all or 'adx' in wanted:
                adx_vals = adx(highs, lows, closes)
                result_indicators['adx'] = [{'date': dates[i], 'value': adx_vals[i]} for i in idx if adx_vals[i] is not None]

            # Signal summary
            latest_rsi = rsi(closes)[-1]
            latest_macd = macd(closes)[0][-1]
            sma20_val = sma(closes, 20)[-1]
            sma50_val = sma(closes, 50)[-1]
            current = closes[-1]

            signals = {
                'rsi': 'Oversold' if latest_rsi and latest_rsi < 30 else ('Overbought' if latest_rsi and latest_rsi > 70 else 'Neutral'),
                'macd': 'Bullish' if latest_macd and latest_macd > 0 else 'Bearish',
                'sma_cross': 'Bullish' if sma20_val and sma50_val and sma20_val > sma50_val else 'Bearish',
                'price_vs_sma20': 'Above' if sma20_val and current > sma20_val else 'Below',
                'price_vs_sma50': 'Above' if sma50_val and current > sma50_val else 'Below',
            }

            bullish_count = sum(1 for v in signals.values() if v in ('Bullish', 'Oversold', 'Above'))
            overall = 'Strong Buy' if bullish_count >= 4 else ('Buy' if bullish_count >= 3 else ('Neutral' if bullish_count >= 2 else ('Sell' if bullish_count >= 1 else 'Strong Sell')))

            result = {
                'ticker': ticker,
                'ohlcv': ohlcv,
                'indicators': result_indicators,
                'signals': signals,
                'overall_signal': overall,
                'company_name': stock.info.get('shortName', ticker)
            }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 's-maxage=60')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
