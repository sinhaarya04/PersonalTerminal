from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs
import numpy as np
import yfinance as yf
import pandas as pd

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        try:
            tickers = query.get('tickers', ['AAPL,MSFT,GOOG'])[0].split(',')
            weights_str = query.get('weights', [None])[0]
            period = query.get('period', ['1y'])[0]

            if weights_str:
                weights = np.array([float(w) for w in weights_str.split(',')])
            else:
                weights = np.ones(len(tickers)) / len(tickers)
            weights = weights / weights.sum()

            # Fetch data
            data = yf.download(tickers, period=period, auto_adjust=True, progress=False)
            if len(tickers) == 1:
                closes = data['Close'].to_frame(tickers[0])
            else:
                closes = data['Close']
            closes = closes.dropna()

            returns = closes.pct_change().dropna()
            port_returns = (returns * weights).sum(axis=1)

            # Core metrics
            total_return = float((1 + port_returns).prod() - 1)
            ann_return = float((1 + total_return) ** (252 / len(port_returns)) - 1) if len(port_returns) > 0 else 0
            ann_vol = float(port_returns.std() * np.sqrt(252))
            sharpe = float(ann_return / ann_vol) if ann_vol > 0 else 0

            # Sortino
            downside = port_returns[port_returns < 0]
            downside_std = float(downside.std() * np.sqrt(252)) if len(downside) > 0 else 0.0001
            sortino = float(ann_return / downside_std)

            # VaR and CVaR (95%)
            var_95 = float(np.percentile(port_returns, 5))
            cvar_95 = float(port_returns[port_returns <= var_95].mean()) if len(port_returns[port_returns <= var_95]) > 0 else var_95

            # Max drawdown
            cum = (1 + port_returns).cumprod()
            rolling_max = cum.cummax()
            drawdowns = (cum - rolling_max) / rolling_max
            max_drawdown = float(drawdowns.min())

            # Rolling Sharpe (63-day window)
            roll_window = min(63, len(port_returns) - 1)
            rolling_sharpe = []
            if roll_window > 5:
                roll_ret = port_returns.rolling(roll_window).mean() * 252
                roll_vol = port_returns.rolling(roll_window).std() * np.sqrt(252)
                rs = (roll_ret / roll_vol).dropna()
                for dt, val in rs.items():
                    rolling_sharpe.append({'date': str(dt.date()), 'value': round(float(val), 3)})

            # Monthly returns
            monthly = port_returns.resample('ME').apply(lambda x: (1 + x).prod() - 1)
            monthly_returns = [{'date': str(dt.date()), 'return': round(float(v), 4)} for dt, v in monthly.items()]

            # Cumulative returns for chart
            cum_returns = []
            cum_series = (1 + port_returns).cumprod()
            step = max(1, len(cum_series) // 200)
            for i in range(0, len(cum_series), step):
                cum_returns.append({
                    'date': str(cum_series.index[i].date()),
                    'value': round(float(cum_series.iloc[i]), 4)
                })

            # Correlation matrix
            corr = returns.corr()
            correlation = {}
            for t in tickers:
                if t in corr.columns:
                    correlation[t] = {t2: round(float(corr.loc[t, t2]), 3) for t2 in tickers if t2 in corr.columns}

            # Individual asset stats
            asset_stats = {}
            for i, t in enumerate(tickers):
                if t in returns.columns:
                    r = returns[t]
                    asset_stats[t] = {
                        'weight': round(float(weights[i]), 4),
                        'ann_return': round(float(r.mean() * 252), 4),
                        'ann_vol': round(float(r.std() * np.sqrt(252)), 4),
                        'sharpe': round(float(r.mean() / r.std() * np.sqrt(252)), 3) if r.std() > 0 else 0,
                        'max_drawdown': round(float(((1 + r).cumprod() / (1 + r).cumprod().cummax() - 1).min()), 4)
                    }

            result = {
                'total_return': round(total_return, 4),
                'ann_return': round(ann_return, 4),
                'ann_volatility': round(ann_vol, 4),
                'sharpe': round(sharpe, 3),
                'sortino': round(sortino, 3),
                'var_95': round(var_95, 4),
                'cvar_95': round(cvar_95, 4),
                'max_drawdown': round(max_drawdown, 4),
                'rolling_sharpe': rolling_sharpe,
                'monthly_returns': monthly_returns,
                'cumulative_returns': cum_returns,
                'correlation': correlation,
                'asset_stats': asset_stats,
                'tickers': tickers,
                'weights': [round(float(w), 4) for w in weights]
            }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 's-maxage=300')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
