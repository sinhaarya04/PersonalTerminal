import React from 'react';

const FONT = "'Consolas','Courier New',monospace";

const LABELS = {
  '^VIX':     { name: 'VIX',     color: '#ff8c00' },
  '^TNX':     { name: 'US 10Y',  color: '#00cccc' },
  'DX-Y.NYB': { name: 'DXY',     color: '#00cccc' },
  'GC=F':     { name: 'GOLD',    color: '#ff8c00' },
  'CL=F':     { name: 'OIL WTI', color: '#00cccc' },
  'BTC-USD':  { name: 'BTC',     color: '#ff8c00' },
};

function fmt(val) {
  if (val == null) return '—';
  if (Math.abs(val) >= 1000) return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return val.toFixed(2);
}

export default function GlobalSnapshotWidget({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ color: '#555', fontSize: 11, fontFamily: FONT, padding: 8 }}>LOADING...</div>;
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {data.map(q => {
        const meta = LABELS[q.symbol] || { name: q.symbol, color: '#aaa' };
        const chg = q.regularMarketChangePercent;
        const chgColor = chg > 0 ? '#00cc00' : chg < 0 ? '#ff4444' : '#888';
        return (
          <div
            key={q.symbol}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 10px',
              borderBottom: '1px solid #111',
            }}
          >
            <span style={{ fontFamily: FONT, fontSize: 10, color: meta.color, fontWeight: 700, width: 55 }}>
              {meta.name}
            </span>
            <span style={{ fontFamily: FONT, fontSize: 11, color: '#ddd', flex: 1, textAlign: 'right' }}>
              {fmt(q.regularMarketPrice)}
            </span>
            <span style={{
              fontFamily: FONT, fontSize: 10, color: chgColor, width: 60, textAlign: 'right',
            }}>
              {chg != null ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
