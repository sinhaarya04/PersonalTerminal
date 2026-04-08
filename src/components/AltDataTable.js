import React, { useState } from 'react';
import { formatChange, getCellStyle } from '../utils/formatting';

const S = {
  container: { display: 'flex', background: '#000000', gap: '0' },
  main: { flex: 1, minWidth: 0 },
  sidebar: {
    width: '220px',
    borderLeft: '1px solid #333333',
    background: '#0d0d1a',
    padding: '8px',
    flexShrink: 0,
  },
  header: {
    background: '#0d0d1a',
    borderBottom: '1px solid #333333',
    padding: '4px 8px',
  },
  headerTitle: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    display: 'block',
  },
  headerSub: {
    color: '#888888',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    display: 'block',
    marginTop: '1px',
  },
  quoteBar: {
    background: '#1a1a2e',
    borderBottom: '1px solid #333333',
    padding: '4px 8px',
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
  },
  price: {
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '20px',
    fontWeight: 'bold',
    letterSpacing: '1px',
  },
  qLabel: {
    color: '#888888',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
    display: 'block',
  },
  qValue: (v) => ({
    color: typeof v === 'number' ? (v >= 0 ? '#00cc00' : '#ff0000') : '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    display: 'block',
  }),
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: "'Consolas','Courier New',monospace",
  },
  superTh: {
    background: '#0d0d1a',
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    textAlign: 'center',
    padding: '3px 4px',
    border: '1px solid #333333',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 'normal',
  },
  subTh: {
    background: '#1a1a2e',
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    textAlign: 'right',
    padding: '2px 6px',
    border: '1px solid #333333',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 'normal',
  },
  subThFirst: { textAlign: 'left', width: '190px' },
  radio: {
    color: '#ff8c00',
    marginRight: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  labelCell: {
    color: '#b0b0b0',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textAlign: 'left',
    padding: '3px 8px',
    border: '1px solid #222222',
  },
  numCell: {
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textAlign: 'right',
    padding: '3px 8px',
    border: '1px solid #222222',
    fontWeight: 'bold',
  },
  sbSection: {
    marginBottom: '12px',
  },
  sbTitle: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #333333',
    paddingBottom: '2px',
    marginBottom: '4px',
  },
  sbRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '2px',
  },
  sbLabel: {
    color: '#888888',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
  },
  sbVal: {
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    textAlign: 'right',
  },
};

function NumCell({ v }) {
  const style = { ...S.numCell, ...getCellStyle(v) };
  const text = v === null || v === undefined ? '--' : formatChange(v, 2) + '%';
  return <td style={style}>{text}</td>;
}

export default function AltDataTable({ data, quote, ticker, dataSource }) {
  const [selectedMetric, setSelectedMetric] = useState('price_mom');
  const d = data;
  const q = quote;

  if (!d || !q) {
    return (
      <div style={{ padding: '20px', color: '#ff8c00', fontFamily: "'Consolas','Courier New',monospace", fontSize: '12px' }}>
        LOADING {ticker || ''}...
      </div>
    );
  }

  const sign = (v) => v >= 0 ? '+' : '';

  return (
    <div style={S.container}>
      <div style={S.main}>
        {/* Header */}
        <div style={S.header}>
          <span style={S.headerTitle}>
            ALTERNATIVE DATA METRICS SUMMARY — {d.name || ticker}
          </span>
          <span style={S.headerSub}>
            DATA UP TO {d.dataDate}
            {dataSource && (
              <span style={{
                marginLeft: '12px',
                color: dataSource === 'POLYGON' ? '#ff8c00' : dataSource === 'YAHOO' ? '#00cc00' : '#888888',
              }}>
                ● {dataSource === 'POLYGON' ? 'POLYGON.IO' : dataSource === 'YAHOO' ? 'YAHOO FINANCE' : 'DEMO DATA'}
              </span>
            )}
          </span>
        </div>

        {/* Quote bar */}
        <div style={S.quoteBar}>
          <span style={S.price}>{q.price.toFixed(2)}</span>
          <div>
            <span style={S.qLabel}>CHG / %CHG</span>
            <span style={{ ...S.qValue(q.change), fontSize: '14px' }}>
              {sign(q.change)}{q.change.toFixed(2)} / {sign(q.pctChange)}{q.pctChange.toFixed(2)}%
            </span>
          </div>
          <div>
            <span style={S.qLabel}>OPEN</span>
            <span style={S.qValue(null)}>{q.open.toFixed(2)}</span>
          </div>
          <div>
            <span style={S.qLabel}>HIGH</span>
            <span style={{ ...S.qValue(null), color: '#00cc00' }}>{q.high.toFixed(2)}</span>
          </div>
          <div>
            <span style={S.qLabel}>LOW</span>
            <span style={{ ...S.qValue(null), color: '#ff4444' }}>{q.low.toFixed(2)}</span>
          </div>
          <div>
            <span style={S.qLabel}>VOLUME</span>
            <span style={S.qValue(null)}>{(q.volume / 1e6).toFixed(2)}M</span>
          </div>
          <div>
            <span style={S.qLabel}>MKT CAP</span>
            <span style={S.qValue(null)}>{(q.mktCap / 1e9).toFixed(1)}B</span>
          </div>
          <div>
            <span style={S.qLabel}>P/E</span>
            <span style={S.qValue(null)}>{q.pe.toFixed(1)}</span>
          </div>
          <div>
            <span style={S.qLabel}>52W H/L</span>
            <span style={S.qValue(null)}>{q.week52High.toFixed(0)} / {q.week52Low.toFixed(0)}</span>
          </div>
        </div>

        {/* Alt data table */}
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.superTh, textAlign: 'left' }} rowSpan={2}>ALT DATA METRICS</th>
              <th style={S.superTh} colSpan={3}>TRAILING YOY GROWTH %</th>
              <th style={S.superTh} colSpan={3}>TRAILING POP GROWTH %</th>
            </tr>
            <tr>
              <th style={S.subTh}>91 DAY</th>
              <th style={S.subTh}>28 DAY</th>
              <th style={S.subTh}>7 DAY</th>
              <th style={S.subTh}>91 DAY</th>
              <th style={S.subTh}>28 DAY</th>
              <th style={S.subTh}>7 DAY</th>
            </tr>
          </thead>
          <tbody>
            {d.metrics.map((m, i) => {
              const isSelected = selectedMetric === m.id;
              return (
                <tr
                  key={m.id}
                  style={{ background: isSelected ? '#0d2035' : (i % 2 === 0 ? '#000000' : '#0d0d1a') }}
                  onClick={() => setSelectedMetric(m.id)}
                >
                  <td style={{
                    ...S.labelCell,
                    borderLeft: isSelected ? '3px solid #ff8c00' : '3px solid transparent',
                    background: isSelected ? '#0d2035' : 'transparent',
                    cursor: 'pointer',
                  }}>
                    <span style={S.radio}>{isSelected ? '◉' : '○'}</span>
                    {m.label}
                  </td>
                  <NumCell v={m.yoy91} />
                  <NumCell v={m.yoy28} />
                  <NumCell v={m.yoy7} />
                  <NumCell v={m.pop91} />
                  <NumCell v={m.pop28} />
                  <NumCell v={m.pop7} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sidebar */}
      <div style={S.sidebar}>
        {/* Selected metric analysis */}
        {(() => {
          const m = d.metrics.find(x => x.id === selectedMetric);
          if (!m) return null;
          const vals = [m.yoy91, m.yoy28, m.yoy7, m.pop91, m.pop28, m.pop7].filter(v => v != null);
          const best = vals.length ? Math.max(...vals) : null;
          const worst = vals.length ? Math.min(...vals) : null;
          const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
          const trending = m.yoy7 != null && m.yoy28 != null
            ? m.yoy7 > m.yoy28 ? 'ACCELERATING' : m.yoy7 < m.yoy28 ? 'DECELERATING' : 'FLAT'
            : '--';
          const trendColor = trending === 'ACCELERATING' ? '#00cc00' : trending === 'DECELERATING' ? '#ff4444' : '#888888';
          return (
            <div style={S.sbSection}>
              <div style={S.sbTitle}>◉ {m.label.toUpperCase()}</div>
              <div style={S.sbRow}>
                <span style={S.sbLabel}>TREND</span>
                <span style={{ ...S.sbVal, color: trendColor }}>{trending}</span>
              </div>
              <div style={S.sbRow}>
                <span style={S.sbLabel}>BEST PERIOD</span>
                <span style={{ ...S.sbVal, color: '#00cc00' }}>{best != null ? `+${best.toFixed(2)}%` : '--'}</span>
              </div>
              <div style={S.sbRow}>
                <span style={S.sbLabel}>WORST PERIOD</span>
                <span style={{ ...S.sbVal, color: '#ff4444' }}>{worst != null ? `${worst.toFixed(2)}%` : '--'}</span>
              </div>
              <div style={S.sbRow}>
                <span style={S.sbLabel}>AVG ACROSS</span>
                <span style={S.sbVal}>{avg != null ? `${avg >= 0 ? '+' : ''}${avg.toFixed(2)}%` : '--'}</span>
              </div>
            </div>
          );
        })()}

        <div style={S.sbSection}>
          <div style={S.sbTitle}>ABOUT THE DATA</div>
          <div style={S.sbRow}>
            <span style={S.sbLabel}>SOURCE</span>
            <span style={{ ...S.sbVal, color: '#ff8c00' }}>{d.about?.source || 'BSM'}</span>
          </div>
          <div style={S.sbRow}>
            <span style={S.sbLabel}>PANEL SIZE</span>
            <span style={S.sbVal}>{d.about?.panelSize || '--'}</span>
          </div>
          <div style={S.sbRow}>
            <span style={S.sbLabel}>GEO</span>
            <span style={S.sbVal}>{d.about?.geo || 'US'}</span>
          </div>
          <div style={S.sbRow}>
            <span style={S.sbLabel}>CARD TYPE</span>
            <span style={S.sbVal}>{d.about?.cardType || 'Credit & Debit'}</span>
          </div>
        </div>

        <div style={S.sbSection}>
          <div style={S.sbTitle}>FUNDAMENTALS</div>
          {[
            ['EPS', `$${q.eps}`],
            ['P/E RATIO', q.pe.toFixed(1)],
            ['AVG VOL', `${(q.avgVolume / 1e6).toFixed(2)}M`],
            ['52W HIGH', `$${q.week52High}`],
            ['52W LOW', `$${q.week52Low}`],
          ].map(([lbl, val]) => (
            <div key={lbl} style={S.sbRow}>
              <span style={S.sbLabel}>{lbl}</span>
              <span style={S.sbVal}>{val}</span>
            </div>
          ))}
        </div>

        <div style={S.sbSection}>
          <div style={S.sbTitle}>COLOR SCALE</div>
          {[
            ['≥ +10%', { background: '#005500', color: '#00ff00' }],
            ['≥ +5%',  { background: '#003300', color: '#00cc00' }],
            ['≥ 0%',   { background: '#001a00', color: '#00aa00' }],
            ['≥ -5%',  { background: '#1a0000', color: '#ff4444' }],
            ['≥ -10%', { background: '#330000', color: '#ff0000' }],
            ['< -10%', { background: '#550000', color: '#ff0000' }],
          ].map(([label, style]) => (
            <div key={label} style={{ ...S.sbRow, marginBottom: '3px' }}>
              <span style={{
                ...style,
                fontFamily: "'Consolas','Courier New',monospace",
                fontSize: '10px',
                padding: '1px 6px',
                textAlign: 'right',
                width: '100%',
              }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
