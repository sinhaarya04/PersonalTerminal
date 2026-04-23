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
            days = int(query.get('days', [30])[0])
            method = query.get('method', ['ensemble'])[0]

            stock = yf.Ticker(ticker)
            hist = stock.history(period='1y')
            if hist.empty:
                raise ValueError(f"No data for {ticker}")

            closes = hist['Close'].values.astype(float)
            dates = hist.index.tolist()

            # Historical data for chart
            historical = []
            step = max(1, len(closes) // 200)
            for i in range(0, len(closes), step):
                historical.append({'date': str(dates[i].date()), 'price': round(float(closes[i]), 2)})

            forecasts = {}

            # Method 1: Linear Regression
            x = np.arange(len(closes))
            coeffs = np.polyfit(x, closes, 1)
            trend_slope = coeffs[0]

            lr_forecast = []
            lr_upper = []
            lr_lower = []
            residuals = closes - np.polyval(coeffs, x)
            std_residual = float(np.std(residuals))

            last_date = dates[-1]
            for d in range(1, days + 1):
                pred = float(np.polyval(coeffs, len(closes) + d))
                lr_forecast.append({'day': d, 'price': round(pred, 2)})
                lr_upper.append({'day': d, 'price': round(pred + 1.96 * std_residual * np.sqrt(d / 10), 2)})
                lr_lower.append({'day': d, 'price': round(pred - 1.96 * std_residual * np.sqrt(d / 10), 2)})

            forecasts['linear'] = {'forecast': lr_forecast, 'upper': lr_upper, 'lower': lr_lower}

            # Method 2: Exponential Moving Average extrapolation
            span = min(20, len(closes))
            ema = closes.copy()
            alpha = 2 / (span + 1)
            for i in range(1, len(ema)):
                ema[i] = alpha * closes[i] + (1 - alpha) * ema[i - 1]

            ema_trend = (ema[-1] - ema[-span]) / span if len(ema) >= span else 0
            ema_forecast = []
            ema_upper = []
            ema_lower = []
            last_ema = float(ema[-1])
            vol = float(np.std(np.diff(np.log(closes[-60:]))) if len(closes) > 60 else np.std(np.diff(np.log(closes))))

            for d in range(1, days + 1):
                pred = last_ema + ema_trend * d
                band = last_ema * vol * np.sqrt(d) * 1.96
                ema_forecast.append({'day': d, 'price': round(pred, 2)})
                ema_upper.append({'day': d, 'price': round(pred + band, 2)})
                ema_lower.append({'day': d, 'price': round(max(pred - band, 0), 2)})

            forecasts['ema'] = {'forecast': ema_forecast, 'upper': ema_upper, 'lower': ema_lower}

            # Method 3: Mean Reversion
            mean_price = float(np.mean(closes[-60:]) if len(closes) >= 60 else np.mean(closes))
            current = float(closes[-1])
            reversion_speed = 0.05

            mr_forecast = []
            mr_upper = []
            mr_lower = []
            price = current
            for d in range(1, days + 1):
                price = price + reversion_speed * (mean_price - price)
                band = current * vol * np.sqrt(d) * 1.5
                mr_forecast.append({'day': d, 'price': round(price, 2)})
                mr_upper.append({'day': d, 'price': round(price + band, 2)})
                mr_lower.append({'day': d, 'price': round(max(price - band, 0), 2)})

            forecasts['mean_reversion'] = {'forecast': mr_forecast, 'upper': mr_upper, 'lower': mr_lower}

            # Ensemble (average of all methods)
            ensemble_forecast = []
            ensemble_upper = []
            ensemble_lower = []
            for d in range(days):
                avg_price = (lr_forecast[d]['price'] + ema_forecast[d]['price'] + mr_forecast[d]['price']) / 3
                avg_upper = max(lr_upper[d]['price'], ema_upper[d]['price'], mr_upper[d]['price'])
                avg_lower = min(lr_lower[d]['price'], ema_lower[d]['price'], mr_lower[d]['price'])
                ensemble_forecast.append({'day': d + 1, 'price': round(avg_price, 2)})
                ensemble_upper.append({'day': d + 1, 'price': round(avg_upper, 2)})
                ensemble_lower.append({'day': d + 1, 'price': round(avg_lower, 2)})

            forecasts['ensemble'] = {'forecast': ensemble_forecast, 'upper': ensemble_upper, 'lower': ensemble_lower}

            # Summary stats
            selected = forecasts.get(method, forecasts['ensemble'])
            final_pred = selected['forecast'][-1]['price']
            expected_return = round((final_pred / current - 1) * 100, 2)

            result = {
                'ticker': ticker,
                'current_price': round(current, 2),
                'forecast_days': days,
                'method': method,
                'historical': historical,
                'forecasts': forecasts,
                'summary': {
                    'predicted_price': final_pred,
                    'expected_return': expected_return,
                    'upper_bound': selected['upper'][-1]['price'],
                    'lower_bound': selected['lower'][-1]['price'],
                    'trend': 'Bullish' if expected_return > 2 else ('Bearish' if expected_return < -2 else 'Neutral'),
                    'confidence_range': round(selected['upper'][-1]['price'] - selected['lower'][-1]['price'], 2),
                    'daily_vol': round(vol * 100, 2),
                    'annual_vol': round(vol * np.sqrt(252) * 100, 2)
                },
                'company_name': stock.info.get('shortName', ticker)
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
