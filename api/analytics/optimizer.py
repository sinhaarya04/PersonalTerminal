from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs
import numpy as np
from scipy.optimize import minimize
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

            constraints = [{'type': 'eq', 'fun': lambda w: np.sum(w) - 1}]
            bounds = tuple((0, 1) for _ in range(n))
            init_weights = np.ones(n) / n

            if method == 'max_sharpe':
                def neg_sharpe(w):
                    r, v, _ = portfolio_stats(w)
                    return -(r - rf) / v if v > 0 else 0
                result_opt = minimize(neg_sharpe, init_weights, method='SLSQP', bounds=bounds, constraints=constraints)
            elif method == 'min_vol':
                def vol_obj(w):
                    return np.sqrt(np.dot(w.T, np.dot(cov_matrix, w)))
                result_opt = minimize(vol_obj, init_weights, method='SLSQP', bounds=bounds, constraints=constraints)
            elif method == 'risk_parity':
                def risk_parity_obj(w):
                    port_vol = np.sqrt(np.dot(w.T, np.dot(cov_matrix, w)))
                    marginal = np.dot(cov_matrix, w)
                    risk_contrib = w * marginal / port_vol
                    target = port_vol / n
                    return np.sum((risk_contrib - target) ** 2)
                result_opt = minimize(risk_parity_obj, init_weights, method='SLSQP', bounds=bounds, constraints=constraints)
            else:
                # Equal weight
                result_opt = type('obj', (object,), {'x': init_weights, 'success': True})()

            opt_weights = result_opt.x
            opt_ret, opt_vol, opt_sharpe = portfolio_stats(opt_weights)

            # Generate efficient frontier (50 points)
            target_returns = np.linspace(min(mean_returns) * 0.5, max(mean_returns) * 1.2, 50)
            frontier = []
            for target in target_returns:
                cons = [
                    {'type': 'eq', 'fun': lambda w: np.sum(w) - 1},
                    {'type': 'eq', 'fun': lambda w, t=target: np.dot(w, mean_returns) - t}
                ]
                try:
                    res = minimize(lambda w: np.sqrt(np.dot(w.T, np.dot(cov_matrix, w))),
                                  init_weights, method='SLSQP', bounds=bounds, constraints=cons)
                    if res.success:
                        r, v, s = portfolio_stats(res.x)
                        frontier.append({'return': round(r * 100, 2), 'volatility': round(v * 100, 2), 'sharpe': round(s, 3)})
                except:
                    pass

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
