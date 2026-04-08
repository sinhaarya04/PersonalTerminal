import React, { useState } from 'react';

const S = {
  container: {
    borderTop: '1px solid #333',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  header: {
    background: '#050510',
    padding: '4px 10px',
    borderBottom: '1px solid #333',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  headerTitle: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    color: '#666',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '3px 8px',
    textAlign: 'right',
    borderBottom: '1px solid #222',
    background: '#050510',
    position: 'sticky',
    top: '28px',
    zIndex: 1,
  },
  thLeft: {
    color: '#666',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '3px 8px',
    textAlign: 'left',
    borderBottom: '1px solid #222',
    background: '#050510',
    position: 'sticky',
    top: '28px',
    zIndex: 1,
  },
  td: {
    color: '#aaa',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '3px 8px',
    textAlign: 'right',
    borderBottom: '1px solid #0a0a0a',
  },
  tdLeft: {
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '3px 8px',
    textAlign: 'left',
    borderBottom: '1px solid #0a0a0a',
    color: '#888',
  },
  symbol: {
    color: '#ffcc00',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  row: (hover) => ({
    background: hover ? '#0d1a2e' : 'transparent',
  }),
  empty: {
    color: '#555',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    padding: '16px',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
};

function fmt(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts) {
  const d = new Date(ts);
  const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  const yr = d.getFullYear();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${mon} ${day}, ${yr} ${h}:${m}:${s}`;
}

function TxnRow({ txn, onTickerChange }) {
  const [hover, setHover] = useState(false);
  const isBuy = txn.type === 'BUY';

  return (
    <tr
      style={S.row(hover)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <td style={S.tdLeft}>{fmtDate(txn.timestamp)}</td>
      <td style={{ ...S.td, color: isBuy ? '#00cc00' : '#ff4444', fontWeight: 'bold', textAlign: 'left' }}>
        {txn.type}
      </td>
      <td
        style={{ ...S.td, ...S.symbol, textAlign: 'left' }}
        onClick={() => onTickerChange(txn.symbol)}
      >
        {txn.symbol}
      </td>
      <td style={S.td}>{txn.shares}</td>
      <td style={S.td}>${fmt(txn.price)}</td>
      <td style={S.td}>${fmt(txn.total)}</td>
    </tr>
  );
}

export default function TransactionHistory({ transactions, onTickerChange }) {
  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.headerTitle}>
          TRANSACTION HISTORY ({transactions.length} TRADES)
        </span>
      </div>

      {transactions.length === 0 ? (
        <div style={S.empty}>NO TRANSACTIONS YET</div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.thLeft}>DATE/TIME</th>
              <th style={S.thLeft}>TYPE</th>
              <th style={S.thLeft}>SYMBOL</th>
              <th style={S.th}>SHARES</th>
              <th style={S.th}>PRICE</th>
              <th style={S.th}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(txn => (
              <TxnRow key={txn.id} txn={txn} onTickerChange={onTickerChange} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
