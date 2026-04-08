import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTrading } from '../context/TradingContext';
import { fetchYFQuotesLive } from '../hooks/useYahooFinance';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';
import TradingPanel from './TradingPanel';
import PortfolioView from './PortfolioView';
import PerformanceChart from './PerformanceChart';
import TransactionHistory from './TransactionHistory';

const S = {
  container: { background: '#000', minHeight: '600px' },
  header: {
    background: '#0d0d1a',
    borderBottom: '1px solid #333',
    padding: '6px 10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
  },
  title: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  totalValue: {
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '15px',
    fontWeight: 'bold',
    marginLeft: '10px',
  },
  returnBadge: (positive) => ({
    color: positive ? '#00cc00' : '#ff4444',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    marginLeft: '6px',
  }),
  resetBtn: {
    background: '#1a1a2e',
    color: '#ff4444',
    border: '1px solid #ff4444',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '2px 10px',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  resetMsg: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    marginLeft: '8px',
  },
  body: {
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid #222',
  },
};

function fmt(n) {
  if (n == null) return '--';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PaperTrading({ ticker, quoteData, onTickerChange }) {
  const {
    cash, startingCash, positions, transactions, portfolioHistory,
    executeBuy, executeSell, resetPortfolio, recordSnapshot,
  } = useTrading();

  const [livePrices, setLivePrices] = useState({});
  const [resetFlash, setResetFlash] = useState(false);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const cashRef = useRef(cash);
  cashRef.current = cash;

  const { register, unregister } = useExport();

  // Fetch live prices for all positions + SPY
  const fetchPrices = useCallback(async () => {
    const syms = Object.keys(positionsRef.current);
    if (!syms.includes('SPY')) syms.push('SPY');
    if (syms.length === 0) return;

    try {
      const quotes = await fetchYFQuotesLive(syms);
      const prices = {};
      quotes.forEach(q => { prices[q.symbol] = q.regularMarketPrice; });
      setLivePrices(prices);

      // Record snapshot
      let mktValue = 0;
      Object.values(positionsRef.current).forEach(p => {
        const mp = prices[p.symbol];
        if (mp != null) mktValue += p.shares * mp;
      });
      const totalVal = cashRef.current + mktValue;
      recordSnapshot(totalVal, cashRef.current, prices['SPY'] || null);
    } catch { /* ignore */ }
  }, [recordSnapshot]);

  // Poll on mount + every 30s
  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, 30000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  // Re-fetch when positions change (new trade)
  useEffect(() => {
    fetchPrices();
  }, [positions, fetchPrices]);

  // Use quoteData price for active ticker if live price not yet available
  const activePrice = livePrices[ticker] ?? quoteData?.price ?? null;
  const activePrices = useMemo(() => {
    const prices = { ...livePrices };
    if (ticker && activePrice != null) prices[ticker] = activePrice;
    return prices;
  }, [livePrices, ticker, activePrice]);

  // Compute total value for header
  let investedValue = 0;
  Object.values(positions).forEach(p => {
    const mp = activePrices[p.symbol];
    if (mp != null) investedValue += p.shares * mp;
  });
  const totalValue = cash + investedValue;
  const totalReturn = ((totalValue / startingCash) - 1) * 100;

  // Register CSV exports
  useEffect(() => {
    if (transactions.length > 0) {
      register('TRANSACTIONS', 'Paper Trading Transactions', () => {
        const date = new Date().toISOString().split('T')[0];
        const rows = transactions.map(t => ({
          date: new Date(t.timestamp).toISOString(),
          type: t.type, symbol: t.symbol, shares: t.shares,
          price: t.price, total: t.total,
        }));
        exportCSV(rows, `paper_trades_${date}.csv`);
      });
    }
    if (Object.keys(positions).length > 0) {
      register('PORTFOLIO', 'Paper Trading Portfolio', () => {
        const date = new Date().toISOString().split('T')[0];
        const rows = Object.values(positions).map(p => ({
          symbol: p.symbol, shares: p.shares, avg_cost: p.avgCost.toFixed(2),
          mkt_price: activePrices[p.symbol]?.toFixed(2) || '',
          mkt_value: activePrices[p.symbol] ? (p.shares * activePrices[p.symbol]).toFixed(2) : '',
          pnl: activePrices[p.symbol] ? ((activePrices[p.symbol] - p.avgCost) * p.shares).toFixed(2) : '',
        }));
        exportCSV(rows, `paper_portfolio_${date}.csv`);
      });
    }
    return () => { unregister('TRANSACTIONS'); unregister('PORTFOLIO'); };
  }, [transactions, positions, activePrices, register, unregister]);

  const handleReset = () => {
    resetPortfolio();
    setLivePrices({});
    setResetFlash(true);
    setTimeout(() => setResetFlash(false), 2000);
  };

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={S.title}>PAPER TRADING SIMULATOR</span>
          <span style={{ ...S.totalValue, color: '#00cc00' }}>CASH ${fmt(cash)}</span>
          <span style={{ color: '#888', fontFamily: "'Consolas','Courier New',monospace", fontSize: '12px' }}>|</span>
          <span style={{ color: '#ff8c00', fontFamily: "'Consolas','Courier New',monospace", fontSize: '12px' }}>
            INVESTED ${fmt(investedValue)}
          </span>
          <span style={{ color: '#888', fontFamily: "'Consolas','Courier New',monospace", fontSize: '12px' }}>|</span>
          <span style={{ color: '#ffffff', fontFamily: "'Consolas','Courier New',monospace", fontSize: '13px', fontWeight: 'bold' }}>
            TOTAL ${fmt(totalValue)}
          </span>
          <span style={S.returnBadge(totalReturn >= 0)}>
            {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {resetFlash && <span style={S.resetMsg}>PORTFOLIO RESET</span>}
          <button style={S.resetBtn} onClick={handleReset}>RESET</button>
        </div>
      </div>

      {/* Trading + Portfolio */}
      <div style={S.body}>
        <TradingPanel
          ticker={ticker}
          price={activePrice}
          cash={cash}
          position={positions[ticker]}
          onBuy={executeBuy}
          onSell={executeSell}
          onTickerChange={onTickerChange}
        />
        <PortfolioView
          positions={positions}
          livePrices={activePrices}
          cash={cash}
          onTickerChange={onTickerChange}
        />
      </div>

      {/* Performance Chart */}
      <PerformanceChart portfolioHistory={portfolioHistory} />

      {/* Transaction History */}
      <TransactionHistory transactions={transactions} onTickerChange={onTickerChange} />
    </div>
  );
}
