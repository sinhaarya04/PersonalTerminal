from http.server import BaseHTTPRequestHandler
import json
import math
from urllib.parse import urlparse, parse_qs

def norm_cdf(x):
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

def norm_pdf(x):
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)

def black_scholes(S, K, T, r, sigma, option_type='call'):
    if T <= 0 or sigma <= 0:
        intrinsic = max(S - K, 0) if option_type == 'call' else max(K - S, 0)
        return {'price': intrinsic, 'delta': 1.0 if option_type == 'call' and S > K else 0.0,
                'gamma': 0, 'theta': 0, 'vega': 0, 'rho': 0}

    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    if option_type == 'call':
        price = S * norm_cdf(d1) - K * math.exp(-r * T) * norm_cdf(d2)
        delta = norm_cdf(d1)
        rho = K * T * math.exp(-r * T) * norm_cdf(d2) / 100
    else:
        price = K * math.exp(-r * T) * norm_cdf(-d2) - S * norm_cdf(-d1)
        delta = norm_cdf(d1) - 1
        rho = -K * T * math.exp(-r * T) * norm_cdf(-d2) / 100

    gamma = norm_pdf(d1) / (S * sigma * math.sqrt(T))
    theta = (-(S * norm_pdf(d1) * sigma) / (2 * math.sqrt(T))
             - r * K * math.exp(-r * T) * (norm_cdf(d2) if option_type == 'call' else norm_cdf(-d2))) / 365
    vega = S * norm_pdf(d1) * math.sqrt(T) / 100

    return {'price': round(price, 4), 'delta': round(delta, 4), 'gamma': round(gamma, 6),
            'theta': round(theta, 4), 'vega': round(vega, 4), 'rho': round(rho, 4)}

def implied_vol(market_price, S, K, T, r, option_type='call'):
    low, high = 0.001, 5.0
    for _ in range(100):
        mid = (low + high) / 2
        bs = black_scholes(S, K, T, r, mid, option_type)
        if bs['price'] < market_price:
            low = mid
        else:
            high = mid
        if abs(bs['price'] - market_price) < 0.0001:
            break
    return round(mid, 4)

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        try:
            S = float(query.get('spot', [100])[0])
            K = float(query.get('strike', [100])[0])
            T = float(query.get('time', [0.25])[0])
            r = float(query.get('rate', [0.05])[0])
            sigma = float(query.get('vol', [0.3])[0])
            opt_type = query.get('type', ['call'])[0]
            market_price = query.get('market_price', [None])[0]

            result = black_scholes(S, K, T, r, sigma, opt_type)

            if market_price is not None:
                result['implied_vol'] = implied_vol(float(market_price), S, K, T, r, opt_type)

            # Generate Greeks surface data for visualization
            strikes = [K * (0.8 + i * 0.05) for i in range(9)]
            times = [max(T * (0.2 + i * 0.2), 0.01) for i in range(5)]
            surface = []
            for t in times:
                row = []
                for k in strikes:
                    bs = black_scholes(S, k, t, r, sigma, opt_type)
                    row.append({'strike': round(k, 2), 'time': round(t, 3),
                                'price': bs['price'], 'delta': bs['delta'], 'gamma': bs['gamma']})
                surface.append(row)
            result['surface'] = surface

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 's-maxage=60')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        except Exception as e:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
