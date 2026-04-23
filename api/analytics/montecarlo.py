from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs
import numpy as np
import yfinance as yf

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        try:
            ticker = query.get('ticker', ['AAPL'])[0]
            days = int(query.get('days', [252])[0])
            simulations = min(int(query.get('simulations', [1000])[0]), 5000)

            stock = yf.Ticker(ticker)
            hist = stock.history(period='1y')
            if hist.empty:
                raise ValueError(f"No data for {ticker}")

            closes = hist['Close'].values
            returns = np.diff(np.log(closes))
            mu = np.mean(returns)
            sigma = np.std(returns)
            last_price = float(closes[-1])

            # Run simulations
            np.random.seed(42)
            dt = 1
            price_paths = np.zeros((simulations, days + 1))
            price_paths[:, 0] = last_price

            for t in range(1, days + 1):
                z = np.random.standard_normal(simulations)
                price_paths[:, t] = price_paths[:, t - 1] * np.exp((mu - 0.5 * sigma ** 2) * dt + sigma * np.sqrt(dt) * z)

            final_prices = price_paths[:, -1]

            # Sample paths for visualization (20 paths)
            sample_indices = np.linspace(0, simulations - 1, 20, dtype=int)
            sample_paths = []
            step = max(1, days // 100)
            for idx in sample_indices:
                path = []
                for d in range(0, days + 1, step):
                    path.append({'day': d, 'price': round(float(price_paths[idx, d]), 2)})
                sample_paths.append(path)

            # Percentile bands
            percentiles = [5, 25, 50, 75, 95]
            bands = {str(p): [] for p in percentiles}
            for d in range(0, days + 1, step):
                for p in percentiles:
                    bands[str(p)].append({
                        'day': d,
                        'price': round(float(np.percentile(price_paths[:, d], p)), 2)
                    })

            # Distribution stats
            distribution = {
                'mean': round(float(np.mean(final_prices)), 2),
                'median': round(float(np.median(final_prices)), 2),
                'std': round(float(np.std(final_prices)), 2),
                'p5': round(float(np.percentile(final_prices, 5)), 2),
                'p25': round(float(np.percentile(final_prices, 25)), 2),
                'p75': round(float(np.percentile(final_prices, 75)), 2),
                'p95': round(float(np.percentile(final_prices, 95)), 2),
                'min': round(float(np.min(final_prices)), 2),
                'max': round(float(np.max(final_prices)), 2)
            }

            # Histogram bins
            hist_data, bin_edges = np.histogram(final_prices, bins=40)
            histogram = []
            for i in range(len(hist_data)):
                histogram.append({
                    'bin_start': round(float(bin_edges[i]), 2),
                    'bin_end': round(float(bin_edges[i + 1]), 2),
                    'count': int(hist_data[i]),
                    'pct': round(float(hist_data[i] / simulations * 100), 1)
                })

            prob_positive = round(float(np.mean(final_prices > last_price) * 100), 1)
            expected_return = round(float((distribution['mean'] / last_price - 1) * 100), 1)

            result = {
                'ticker': ticker,
                'current_price': round(last_price, 2),
                'days': days,
                'simulations': simulations,
                'sample_paths': sample_paths,
                'bands': bands,
                'distribution': distribution,
                'histogram': histogram,
                'prob_positive': prob_positive,
                'expected_return': expected_return,
                'annual_drift': round(float(mu * 252), 4),
                'annual_vol': round(float(sigma * np.sqrt(252)), 4)
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
