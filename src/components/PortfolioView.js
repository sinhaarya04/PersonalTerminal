import React, { useState } from 'react';

const S = {
  container: { flex: 1, minWidth: 0 },
  summary: {
    display: 'flex',
    gap: '20px',
    padding: '6px 10px',
    background: '#0d0d1a',
    borderBottom: '1px solid #333',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  summaryItem: {
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  summaryLabel: { color: '#888' },
  summaryVal: (color) => ({ color: color || '#fff', marginLeft: '4px', fontWeight: 'bold', fontSize: '12px' }),
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '4px 8px',
    textAlign: 'right',
    borderBottom: '1px solid #333',
    background: '#050510',
  },
  thLeft: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '4px 8px',
    textAlign: 'left',
    borderBottom: '1px solid #333',
    background: '#050510',
  },
  td: {
    color: '#ccc',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    padding: '4px 8px',
    textAlign: 'right',
    borderBottom: '1px solid #111',
  },
  tdLeft: {
    color: '#ffcc00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '4px 8px',
    textAlign: 'left',
    borderBottom: '1px solid #111',
    cursor: 'pointer',
  },
  row: (hover) => ({
    background: hover ? '#1a3a5c' : 'transparent',
    cursor: 'pointer',
  }),
  empty: {
    color: '#555',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    padding: '20px',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
};

function fmt(n) {
  if (n == null) return '--';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtLarge(n) {
  if (n == null) return '--';
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${fmt(n)}`;
}

function PositionRow({ pos, mktPrice, onTickerChange }) {
  const [hover, setHover] = useState(false);
  const mktValue = mktPrice != null ? pos.shares * mktPrice : null;
  const pnl = mktPrice != null ? (mktPrice - pos.avgCost) * pos.shares : null;
  const pnlPct = pos.avgCost > 0 && mktPrice != null ? ((mktPrice - pos.avgCost) / pos.avgCost) * 100 : null;
  const pnlColor = pnl == null ? '#555' : pnl >= 0 ? '#00cc00' : '#ff4444';

  return (
    <tr
      style={S.row(hover)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onTickerChange(pos.symbol)}
    >
      <td style={S.tdLeft}>{pos.symbol}</td>
      <td style={S.td}>{pos.shares}</td>
      <td style={S.td}>${fmt(pos.avgCost)}</td>
      <td style={S.td}>{mktPrice != null ? `$${fmt(mktPrice)}` : '--'}</td>
      <td style={S.td}>{mktValue != null ? fmtLarge(mktValue) : '--'}</td>
      <td style={{ ...S.td, color: pnlColor, fontWeight: 'bold' }}>
        {pnl != null ? `${pnl >= 0 ? '+' : ''}$${fmt(pnl)}` : '--'}
      </td>
      <td style={{ ...S.td, color: pnlColor }}>
        {pnlPct != null ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : '--'}
      </td>
    </tr>
  );
}

export default function PortfolioView({ positions, livePrices, cash, onTickerChange }) {
  const posArray = Object.values(positions);

  // Compute totals
  let invested = 0;
  let mktTotal = 0;
  let allPriced = true;
  posArray.forEach(p => {
    invested += p.totalCost;
    const mp = livePrices[p.symbol];
    if (mp != null) {
      mktTotal += p.shares * mp;
    } else {
      allPriced = false;
    }
  });
  const totalValue = cash + (allPriced ? mktTotal : mktTotal);
  const totalPnl = allPriced ? mktTotal - invested : null;
  const totalPnlPct = invested > 0 && totalPnl != null ? (totalPnl / invested) * 100 : null;
  const pnlColor = totalPnl == null ? '#555' : totalPnl >= 0 ? '#00cc00' : '#ff4444';

  return (
    <div style={S.container}>
      <div style={S.summary}>
        <span style={S.summaryItem}>
          <span style={S.summaryLabel}>PORTFOLIO VALUE</span>
          <span style={S.summaryVal('#fff')}>${fmt(totalValue)}</span>
        </span>
        <span style={S.summaryItem}>
          <span style={S.summaryLabel}>CASH</span>
          <span style={S.summaryVal('#ffcc00')}>${fmt(cash)}</span>
        </span>
        <span style={S.summaryItem}>
          <span style={S.summaryLabel}>INVESTED</span>
          <span style={S.summaryVal('#b0b0b0')}>${fmt(allPriced ? mktTotal : invested)}</span>
        </span>
        {totalPnl != null && (
          <span style={S.summaryItem}>
            <span style={S.summaryLabel}>P&L</span>
            <span style={S.summaryVal(pnlColor)}>
              {totalPnl >= 0 ? '+' : ''}${fmt(totalPnl)} ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct?.toFixed(2)}%)
            </span>
          </span>
        )}
      </div>

      {posArray.length === 0 ? (
        <div style={S.empty}>NO POSITIONS — BUY A STOCK TO START TRADING</div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.thLeft}>SYMBOL</th>
              <th style={S.th}>SHARES</th>
              <th style={S.th}>AVG COST</th>
              <th style={S.th}>MKT PRICE</th>
              <th style={S.th}>MKT VALUE</th>
              <th style={S.th}>P&L ($)</th>
              <th style={S.th}>P&L (%)</th>
            </tr>
          </thead>
          <tbody>
            {posArray.map(p => (
              <PositionRow
                key={p.symbol}
                pos={p}
                mktPrice={livePrices[p.symbol]}
                onTickerChange={onTickerChange}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
