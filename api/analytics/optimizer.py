from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs
import numpy as np
import yfinance as yf

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        try:
            tickers = query.get('tickers', ['AAPL,MSFT,GOOG,AMZN'])[0].split(',')
            period = query.get('period', ['1y'])[0]
            method = query.get('method', ['max_sharpe'])[0]
            rf = float(query.get('rf', [0.05])[0])

            data = yf.download(tickers, period=period, auto_adjust=True, progress=False)
            if len(tickers) == 1:
                closes = data['Close'].to_frame(tickers[0])
            else:
                closes = data['Close']
            closes = closes.dropna()
            returns = closes.pct_change().dropna()

            n = len(tickers)
            mean_returns = returns.mean().values * 252
            cov_matrix = returns.cov().values * 252

            def portfolio_stats(weights):
                ret = np.dot(weights, mean_returns)
                vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
                sharpe = (ret - rf) / vol if vol > 0 else 0
                return ret, vol, sharpe

            # Monte Carlo optimization: generate random portfolios
            np.random.seed(42)
            num_portfolios = 5000
            all_weights = np.random.dirichlet(np.ones(n), num_portfolios)
            all_stats = np.array([portfolio_stats(w) for w in all_weights])

            best_sharpe_idx = np.argmax(all_stats[:, 2])
            min_vol_idx = np.argmin(all_stats[:, 1])

            if method == 'max_sharpe':
                opt_weights = all_weights[best_sharpe_idx]
            elif method == 'min_vol':
                opt_weights = all_weights[min_vol_idx]
            elif method == 'risk_parity':
                # Inverse volatility weighting as risk parity proxy
                vols = np.sqrt(np.diag(cov_matrix))
                inv_vol = 1.0 / vols
                opt_weights = inv_vol / inv_vol.sum()
            else:
                opt_weights = np.ones(n) / n

            opt_ret, opt_vol, opt_sharpe = portfolio_stats(opt_weights)

            # Efficient frontier from simulated portfolios
            frontier = []
            # Sort by volatility and pick the best return at each vol level
            sorted_idx = np.argsort(all_stats[:, 1])
            vol_bins = np.linspace(all_stats[:, 1].min(), all_stats[:, 1].max(), 50)
            for i in range(len(vol_bins) - 1):
                mask = (all_stats[:, 1] >= vol_bins[i]) & (all_stats[:, 1] < vol_bins[i + 1])
                if mask.any():
                    best = np.argmax(all_stats[mask, 0])
                    idx = np.where(mask)[0][best]
                    frontier.append({
                        'return': round(float(all_stats[idx, 0] * 100), 2),
                        'volatility': round(float(all_stats[idx, 1] * 100), 2),
                        'sharpe': round(float(all_stats[idx, 2]), 3)
                    })

            # Individual asset points
            asset_points = []
            for i, t in enumerate(tickers):
                w = np.zeros(n)
                w[i] = 1
                r, v, s = portfolio_stats(w)
                asset_points.append({
                    'ticker': t,
                    'return': round(r * 100, 2),
                    'volatility': round(v * 100, 2),
                    'sharpe': round(s, 3)
                })

            result = {
                'method': method,
                'tickers': tickers,
                'optimal_weights': {t: round(float(w), 4) for t, w in zip(tickers, opt_weights)},
                'expected_return': round(opt_ret * 100, 2),
                'volatility': round(opt_vol * 100, 2),
                'sharpe': round(opt_sharpe, 3),
                'frontier': frontier,
                'asset_points': asset_points,
                'correlation': {
                    t1: {t2: round(float(returns.corr().loc[t1, t2]), 3) for t2 in tickers if t2 in returns.columns}
                    for t1 in tickers if t1 in returns.columns
                },
                'equal_weight': {
                    'return': round(float(np.dot(np.ones(n) / n, mean_returns) * 100), 2),
                    'volatility': round(float(np.sqrt(np.dot((np.ones(n) / n).T, np.dot(cov_matrix, np.ones(n) / n))) * 100), 2)
                }
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
