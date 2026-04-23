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
            ticker = query.get('ticker', ['AAPL'])[0]
            fast_ma = int(query.get('fast_ma', [20])[0])
            slow_ma = int(query.get('slow_ma', [50])[0])
            period = query.get('period', ['2y'])[0]
            capital = float(query.get('capital', [100000])[0])
            strategy = query.get('strategy', ['sma_cross'])[0]

            stock = yf.Ticker(ticker)
            hist = stock.history(period=period)
            if hist.empty:
                raise ValueError(f"No data for {ticker}")

            df = hist[['Close', 'Volume']].copy()
            df.columns = ['close', 'volume']

            # Compute indicators based on strategy
            if strategy == 'sma_cross':
                df['fast'] = df['close'].rolling(fast_ma).mean()
                df['slow'] = df['close'].rolling(slow_ma).mean()
                df['signal'] = 0
                df.loc[df['fast'] > df['slow'], 'signal'] = 1
                df.loc[df['fast'] <= df['slow'], 'signal'] = -1
            elif strategy == 'rsi':
                delta = df['close'].diff()
                gain = delta.where(delta > 0, 0).rolling(14).mean()
                loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
                rs = gain / loss
                df['rsi'] = 100 - (100 / (1 + rs))
                df['signal'] = 0
                df.loc[df['rsi'] < 30, 'signal'] = 1
                df.loc[df['rsi'] > 70, 'signal'] = -1
            elif strategy == 'mean_reversion':
                df['sma'] = df['close'].rolling(20).mean()
                df['std'] = df['close'].rolling(20).std()
                df['z_score'] = (df['close'] - df['sma']) / df['std']
                df['signal'] = 0
                df.loc[df['z_score'] < -1.5, 'signal'] = 1
                df.loc[df['z_score'] > 1.5, 'signal'] = -1

            df = df.dropna()
            df['position'] = df['signal'].shift(1).fillna(0)

            # Simulate trades
            trades = []
            equity = [capital]
            shares = 0
            cash = capital
            position_open = False
            entry_price = 0

            for i in range(1, len(df)):
                price = float(df['close'].iloc[i])
                prev_pos = float(df['position'].iloc[i - 1]) if i > 1 else 0
                curr_pos = float(df['position'].iloc[i])

                # Entry
                if curr_pos > 0 and prev_pos <= 0 and not position_open:
                    shares = int(cash / price)
                    if shares > 0:
                        entry_price = price
                        cash -= shares * price
                        position_open = True
                        trades.append({
                            'date': str(df.index[i].date()),
                            'type': 'BUY',
                            'price': round(price, 2),
                            'shares': shares
                        })

                # Exit
                elif (curr_pos <= 0 and prev_pos > 0 and position_open) or (curr_pos < 0 and position_open):
                    if shares > 0:
                        cash += shares * price
                        pnl = (price - entry_price) * shares
                        trades.append({
                            'date': str(df.index[i].date()),
                            'type': 'SELL',
                            'price': round(price, 2),
                            'shares': shares,
                            'pnl': round(pnl, 2)
                        })
                        shares = 0
                        position_open = False

                total = cash + shares * price
                equity.append(total)

            # Close any open position
            if position_open and shares > 0:
                final_price = float(df['close'].iloc[-1])
                cash += shares * final_price
                pnl = (final_price - entry_price) * shares
                trades.append({
                    'date': str(df.index[-1].date()),
                    'type': 'SELL (CLOSE)',
                    'price': round(final_price, 2),
                    'shares': shares,
                    'pnl': round(pnl, 2)
                })

            final_equity = cash
            total_return = (final_equity / capital - 1) * 100

            # Buy and hold comparison
            buy_hold_return = (float(df['close'].iloc[-1]) / float(df['close'].iloc[0]) - 1) * 100

            # Equity curve (downsample for chart)
            equity_curve = []
            step = max(1, len(equity) // 200)
            dates = df.index.tolist()
            for i in range(0, min(len(equity), len(dates)), step):
                equity_curve.append({
                    'date': str(dates[i].date()),
                    'equity': round(equity[i], 2),
                    'buy_hold': round(capital * (float(df['close'].iloc[i]) / float(df['close'].iloc[0])), 2)
                })

            # Performance metrics
            equity_arr = np.array(equity[1:])
            equity_returns = np.diff(equity_arr) / equity_arr[:-1] if len(equity_arr) > 1 else np.array([0])
            ann_return = float(np.mean(equity_returns) * 252) if len(equity_returns) > 0 else 0
            ann_vol = float(np.std(equity_returns) * np.sqrt(252)) if len(equity_returns) > 0 else 0.0001
            sharpe = ann_return / ann_vol if ann_vol > 0 else 0

            # Max drawdown
            eq_series = np.array(equity)
            peak = np.maximum.accumulate(eq_series)
            drawdown = (eq_series - peak) / peak
            max_dd = float(np.min(drawdown)) * 100

            # Win rate
            winning = [t for t in trades if t.get('pnl', 0) > 0]
            losing = [t for t in trades if t.get('pnl', 0) < 0]
            sell_trades = [t for t in trades if 'pnl' in t]
            win_rate = len(winning) / len(sell_trades) * 100 if sell_trades else 0

            result = {
                'ticker': ticker,
                'strategy': strategy,
                'period': period,
                'initial_capital': capital,
                'final_equity': round(final_equity, 2),
                'total_return': round(total_return, 2),
                'buy_hold_return': round(buy_hold_return, 2),
                'sharpe': round(sharpe, 3),
                'max_drawdown': round(max_dd, 2),
                'total_trades': len(sell_trades),
                'win_rate': round(win_rate, 1),
                'avg_win': round(np.mean([t['pnl'] for t in winning]), 2) if winning else 0,
                'avg_loss': round(np.mean([t['pnl'] for t in losing]), 2) if losing else 0,
                'profit_factor': round(abs(sum(t['pnl'] for t in winning) / sum(t['pnl'] for t in losing)), 2) if losing and sum(t['pnl'] for t in losing) != 0 else float('inf'),
                'equity_curve': equity_curve,
                'trades': trades[-50:],  # Last 50 trades
                'params': {'fast_ma': fast_ma, 'slow_ma': slow_ma}
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
