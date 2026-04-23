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
            growth_rate = float(query.get('growth', [0.08])[0])
            terminal_growth = float(query.get('terminal_growth', [0.03])[0])
            wacc = float(query.get('wacc', [0.10])[0])
            projection_years = int(query.get('years', [5])[0])
            margin_of_safety = float(query.get('mos', [0.25])[0])

            stock = yf.Ticker(ticker)
            info = stock.info
            cashflow = stock.cashflow

            # Get FCF from financials
            fcf = None
            if cashflow is not None and not cashflow.empty:
                if 'Free Cash Flow' in cashflow.index:
                    fcf = float(cashflow.loc['Free Cash Flow'].iloc[0])
                elif 'Operating Cash Flow' in cashflow.index and 'Capital Expenditure' in cashflow.index:
                    opcf = float(cashflow.loc['Operating Cash Flow'].iloc[0])
                    capex = float(cashflow.loc['Capital Expenditure'].iloc[0])
                    fcf = opcf + capex  # capex is negative

            if fcf is None or fcf <= 0:
                fcf = info.get('freeCashflow', info.get('operatingCashflow', 1e9))
                if fcf is None or fcf <= 0:
                    fcf = 1e9

            shares = info.get('sharesOutstanding', 1e9)
            current_price = info.get('currentPrice', info.get('regularMarketPrice', 0))

            # Project FCFs
            projected_fcf = []
            pv_fcfs = []
            for year in range(1, projection_years + 1):
                future_fcf = fcf * (1 + growth_rate) ** year
                pv = future_fcf / (1 + wacc) ** year
                projected_fcf.append({
                    'year': year,
                    'fcf': round(future_fcf / 1e9, 2),
                    'pv_fcf': round(pv / 1e9, 2)
                })
                pv_fcfs.append(pv)

            # Terminal value
            terminal_fcf = fcf * (1 + growth_rate) ** projection_years * (1 + terminal_growth)
            terminal_value = terminal_fcf / (wacc - terminal_growth)
            pv_terminal = terminal_value / (1 + wacc) ** projection_years

            # Enterprise value & equity value
            total_pv_fcf = sum(pv_fcfs)
            enterprise_value = total_pv_fcf + pv_terminal
            net_debt = info.get('totalDebt', 0) - info.get('totalCash', 0)
            equity_value = enterprise_value - net_debt
            intrinsic_value = equity_value / shares if shares > 0 else 0
            fair_value_with_mos = intrinsic_value * (1 - margin_of_safety)

            upside = ((intrinsic_value / current_price) - 1) * 100 if current_price > 0 else 0

            # Sensitivity analysis
            sensitivity = []
            for w in [wacc - 0.02, wacc - 0.01, wacc, wacc + 0.01, wacc + 0.02]:
                row = []
                for g in [growth_rate - 0.02, growth_rate - 0.01, growth_rate, growth_rate + 0.01, growth_rate + 0.02]:
                    if w <= terminal_growth:
                        row.append(None)
                        continue
                    pv_sum = sum(fcf * (1 + g) ** y / (1 + w) ** y for y in range(1, projection_years + 1))
                    tf = fcf * (1 + g) ** projection_years * (1 + terminal_growth)
                    tv = tf / (w - terminal_growth)
                    pvt = tv / (1 + w) ** projection_years
                    ev = pv_sum + pvt - net_debt
                    row.append(round(ev / shares, 2) if shares > 0 else 0)
                sensitivity.append({
                    'wacc': round(w * 100, 1),
                    'values': row,
                    'growth_rates': [round((growth_rate + (i - 2) * 0.01) * 100, 1) for i in range(5)]
                })

            result = {
                'ticker': ticker,
                'current_price': round(current_price, 2),
                'intrinsic_value': round(intrinsic_value, 2),
                'fair_value_with_mos': round(fair_value_with_mos, 2),
                'upside_pct': round(upside, 1),
                'base_fcf': round(fcf / 1e9, 2),
                'projected_fcf': projected_fcf,
                'terminal_value': round(terminal_value / 1e9, 2),
                'pv_terminal': round(pv_terminal / 1e9, 2),
                'total_pv_fcf': round(total_pv_fcf / 1e9, 2),
                'enterprise_value': round(enterprise_value / 1e9, 2),
                'net_debt': round(net_debt / 1e9, 2),
                'equity_value': round(equity_value / 1e9, 2),
                'shares_outstanding': round(shares / 1e9, 2),
                'assumptions': {
                    'growth_rate': growth_rate,
                    'terminal_growth': terminal_growth,
                    'wacc': wacc,
                    'projection_years': projection_years,
                    'margin_of_safety': margin_of_safety
                },
                'sensitivity': sensitivity,
                'company_name': info.get('shortName', ticker)
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
