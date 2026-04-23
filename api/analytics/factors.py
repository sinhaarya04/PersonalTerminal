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
            period = query.get('period', ['1y'])[0]

            results = {}
            for ticker in tickers[:10]:  # Max 10 tickers
                stock = yf.Ticker(ticker)
                info = stock.info
                hist = stock.history(period=period)

                if hist.empty:
                    continue

                closes = hist['Close'].values
                volumes = hist['Volume'].values
                returns = np.diff(np.log(closes))

                # Value factors
                pe = info.get('trailingPE', None)
                pb = info.get('priceToBook', None)
                ps = info.get('priceToSalesTrailing12Months', None)
                ev_ebitda = info.get('enterpriseToEbitda', None)
                div_yield = info.get('dividendYield', None)

                # Value score (lower P/E, P/B = more value)
                value_score = 0
                value_count = 0
                if pe and pe > 0:
                    value_score += max(0, min(100, (50 - pe) * 2))
                    value_count += 1
                if pb and pb > 0:
                    value_score += max(0, min(100, (5 - pb) * 20))
                    value_count += 1
                if ps and ps > 0:
                    value_score += max(0, min(100, (10 - ps) * 10))
                    value_count += 1
                value_score = round(value_score / max(value_count, 1), 1)

                # Momentum factors
                if len(closes) >= 252:
                    mom_12m = float((closes[-1] / closes[-252] - 1) * 100)
                elif len(closes) >= 63:
                    mom_12m = float((closes[-1] / closes[0] - 1) * 100)
                else:
                    mom_12m = 0

                mom_1m = float((closes[-1] / closes[-min(21, len(closes))] - 1) * 100) if len(closes) > 21 else 0
                mom_3m = float((closes[-1] / closes[-min(63, len(closes))] - 1) * 100) if len(closes) > 63 else 0

                momentum_score = round(min(100, max(0, 50 + mom_12m)), 1)

                # Quality factors
                roe = info.get('returnOnEquity', None)
                roa = info.get('returnOnAssets', None)
                profit_margin = info.get('profitMargins', None)
                debt_equity = info.get('debtToEquity', None)
                current_ratio = info.get('currentRatio', None)

                quality_score = 0
                quality_count = 0
                if roe and roe > 0:
                    quality_score += min(100, roe * 100 * 3)
                    quality_count += 1
                if profit_margin and profit_margin > 0:
                    quality_score += min(100, profit_margin * 100 * 3)
                    quality_count += 1
                if debt_equity is not None:
                    quality_score += max(0, 100 - debt_equity * 0.5)
                    quality_count += 1
                quality_score = round(quality_score / max(quality_count, 1), 1)

                # Volatility factor
                ann_vol = float(np.std(returns) * np.sqrt(252) * 100) if len(returns) > 0 else 0
                volatility_score = round(max(0, 100 - ann_vol * 2), 1)

                # Size factor
                mkt_cap = info.get('marketCap', 0)
                if mkt_cap > 200e9:
                    size_label = 'Mega Cap'
                    size_score = 90
                elif mkt_cap > 10e9:
                    size_label = 'Large Cap'
                    size_score = 70
                elif mkt_cap > 2e9:
                    size_label = 'Mid Cap'
                    size_score = 50
                elif mkt_cap > 300e6:
                    size_label = 'Small Cap'
                    size_score = 30
                else:
                    size_label = 'Micro Cap'
                    size_score = 10

                results[ticker] = {
                    'name': info.get('shortName', ticker),
                    'factors': {
                        'value': {'score': value_score, 'metrics': {'P/E': pe, 'P/B': pb, 'P/S': ps, 'EV/EBITDA': ev_ebitda}},
                        'momentum': {'score': momentum_score, 'metrics': {'1M': round(mom_1m, 1), '3M': round(mom_3m, 1), '12M': round(mom_12m, 1)}},
                        'quality': {'score': quality_score, 'metrics': {'ROE': round(roe * 100, 1) if roe else None, 'ROA': round(roa * 100, 1) if roa else None, 'Margin': round(profit_margin * 100, 1) if profit_margin else None, 'D/E': round(debt_equity, 1) if debt_equity else None}},
                        'volatility': {'score': volatility_score, 'metrics': {'Ann. Vol': round(ann_vol, 1)}},
                        'size': {'score': size_score, 'label': size_label, 'metrics': {'Mkt Cap ($B)': round(mkt_cap / 1e9, 1) if mkt_cap else None}}
                    },
                    'composite_score': round((value_score + momentum_score + quality_score + volatility_score) / 4, 1)
                }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 's-maxage=300')
            self.end_headers()
            self.wfile.write(json.dumps({'factors': results, 'tickers': tickers}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
