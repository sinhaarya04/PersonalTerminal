import React, { useState } from 'react';

const FONT = "'Consolas','Courier New',monospace";

const S = {
  container: { background: '#000', fontFamily: FONT, display: 'flex', flexDirection: 'column', height: '100%' },
  header: {
    background: '#0d0d1a', borderBottom: '2px solid #ff8c00',
    padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#ff8c00', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase',
    letterSpacing: '1px', fontFamily: FONT,
  },
  headerSub: { color: '#888', fontSize: '10px', fontFamily: FONT },
  toolbar: {
    background: '#1a1a2e', borderBottom: '1px solid #333', padding: '6px 10px',
    display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap',
  },
  label: {
    color: '#888', fontSize: '10px', textTransform: 'uppercase', fontFamily: FONT, marginRight: '4px',
  },
  input: {
    fontFamily: FONT, fontSize: '11px', background: '#000', color: '#ffcc00',
    border: '1px solid #333', borderRadius: '2px', padding: '3px 6px', outline: 'none', width: '80px',
  },
  select: {
    fontFamily: FONT, fontSize: '11px', background: '#000', color: '#ffcc00',
    border: '1px solid #333', borderRadius: '2px', padding: '3px 6px', outline: 'none',
  },
  btn: {
    fontFamily: FONT, fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase',
    cursor: 'pointer', border: '1px solid #ff8c00', borderRadius: '2px',
    padding: '4px 14px', background: '#ff8c00', color: '#000', fontWeight: 'bold',
  },
  loading: { padding: '40px', color: '#ff8c00', fontFamily: FONT, fontSize: '13px', textAlign: 'center', textTransform: 'uppercase' },
  error: { padding: '20px', color: '#ff4444', fontFamily: FONT, fontSize: '12px', textAlign: 'center' },
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '6px', padding: '10px',
  },
  statCard: {
    background: '#0d0d1a', border: '1px solid #333', borderRadius: '2px', padding: '8px 10px',
  },
  statLabel: { color: '#888', fontSize: '9px', textTransform: 'uppercase', fontFamily: FONT, letterSpacing: '0.5px' },
  statValue: (color) => ({ color: color || '#fff', fontSize: '16px', fontFamily: FONT, fontWeight: 'bold', marginTop: '2px' }),
  sectionHeader: {
    background: '#0d0d1a', borderBottom: '1px solid #333', borderTop: '1px solid #333',
    padding: '4px 10px', color: '#ff8c00', fontSize: '11px', fontFamily: FONT,
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: '11px' },
  th: {
    background: '#0d0d1a', color: '#888', fontSize: '10px', textTransform: 'uppercase',
    fontFamily: FONT, padding: '4px 8px', borderBottom: '1px solid #333', textAlign: 'left',
    letterSpacing: '0.5px', position: 'sticky', top: 0,
  },
  td: { color: '#ccc', padding: '3px 8px', borderBottom: '1px solid #1a1a2e', fontFamily: FONT, fontSize: '11px' },
  svgWrapper: { padding: '8px 10px', background: '#000' },
  legendRow: { display: 'flex', gap: '16px', padding: '4px 10px', alignItems: 'center' },
  legendItem: (color) => ({
    display: 'flex', alignItems: 'center', gap: '4px',
    color: '#888', fontFamily: FONT, fontSize: '10px',
  }),
  legendSwatch: (color) => ({ width: '16px', height: '3px', background: color, display: 'inline-block' }),
};

function EquityCurveChart({ data }) {
  if (!data || !data.equity_curve || data.equity_curve.length < 2) return null;

  const curve = data.equity_curve;
  const bhCurve = data.buy_hold_curve || [];
  const W = 900, H = 220;
  const padL = 60, padR = 16, padT = 16, padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const allVals = [...curve.map(d => d.value), ...bhCurve.map(d => d.value)];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;

  const xScale = (i, len) => padL + (i / (len - 1)) * chartW;
  const yScale = (v) => padT + (1 - (v - minV) / range) * chartH;

  const stratPts = curve.map((d, i) => `${xScale(i, curve.length)},${yScale(d.value)}`).join(' ');
  const bhPts = bhCurve.length > 1
    ? bhCurve.map((d, i) => `${xScale(i, bhCurve.length)},${yScale(d.value)}`).join(' ')
    : null;

  const gridLines = 5;
  const gridVals = Array.from({ length: gridLines }, (_, i) => minV + (range * i) / (gridLines - 1));

  const labelCount = Math.min(6, curve.length);
  const dateLabels = Array.from({ length: labelCount }, (_, i) => {
    const idx = Math.round((i / (labelCount - 1)) * (curve.length - 1));
    return { x: xScale(idx, curve.length), label: curve[idx].date || '' };
  });

  return (
    <div>
      <div style={S.svgWrapper}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
          {gridVals.map((v, i) => (
            <g key={i}>
              <line x1={padL} y1={yScale(v)} x2={W - padR} y2={yScale(v)} stroke="#222" strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={padL - 4} y={yScale(v) + 3} fill="#555" fontFamily={FONT} fontSize="8" textAnchor="end">
                ${(v / 1000).toFixed(0)}K
              </text>
            </g>
          ))}
          {bhPts && (
            <polyline points={bhPts} fill="none" stroke="#555" strokeWidth="1.2" strokeDasharray="4,2" />
          )}
          <polyline points={stratPts} fill="none" stroke="#00ff41" strokeWidth="1.5" />
          {dateLabels.map((dl, i) => (
            <text key={i} x={dl.x} y={H - padB + 14} fill="#555" fontFamily={FONT} fontSize="8" textAnchor="middle">
              {dl.label}
            </text>
          ))}
          <rect x={padL} y={padT} width={chartW} height={chartH} fill="none" stroke="#333" strokeWidth="0.5" />
        </svg>
      </div>
      <div style={S.legendRow}>
        <span style={S.legendItem('#00ff41')}>
          <span style={S.legendSwatch('#00ff41')} /> STRATEGY
        </span>
        <span style={S.legendItem('#555')}>
          <span style={S.legendSwatch('#555')} /> BUY & HOLD
        </span>
      </div>
    </div>
  );
}

export default function BacktestPanel() {
  const [ticker, setTicker] = useState('AAPL');
  const [fastMA, setFastMA] = useState('20');
  const [slowMA, setSlowMA] = useState('50');
  const [period, setPeriod] = useState('2y');
  const [capital, setCapital] = useState('100000');
  const [strategy, setStrategy] = useState('sma_cross');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({
        ticker: ticker.toUpperCase().trim(),
        fast_ma: fastMA,
        slow_ma: slowMA,
        period,
        capital,
        strategy,
      });
      const res = await fetch(`/analytics/backtest?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const stats = data?.stats || {};
  const trades = data?.trades || [];

  const fmtPct = (v) => {
    if (v == null) return '--';
    return (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
  };
  const fmtNum = (v, d = 2) => {
    if (v == null) return '--';
    return typeof v === 'number' ? v.toFixed(d) : String(v);
  };

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.headerTitle}>STRATEGY BACKTESTER</span>
        <span style={S.headerSub}>ANALYTICS ENGINE</span>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={S.label}>TICKER</span>
          <input style={{ ...S.input, width: '60px' }} value={ticker} onChange={e => setTicker(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={S.label}>STRATEGY</span>
          <select style={S.select} value={strategy} onChange={e => setStrategy(e.target.value)}>
            <option value="sma_cross">SMA CROSS</option>
            <option value="rsi">RSI</option>
            <option value="mean_reversion">MEAN REVERSION</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={S.label}>FAST MA</span>
          <input style={{ ...S.input, width: '50px' }} type="number" value={fastMA} onChange={e => setFastMA(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={S.label}>SLOW MA</span>
          <input style={{ ...S.input, width: '50px' }} type="number" value={slowMA} onChange={e => setSlowMA(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={S.label}>PERIOD</span>
          <select style={S.select} value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="1y">1Y</option>
            <option value="2y">2Y</option>
            <option value="5y">5Y</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={S.label}>CAPITAL</span>
          <input style={{ ...S.input, width: '80px' }} type="number" value={capital} onChange={e => setCapital(e.target.value)} />
        </div>
        <button style={S.btn} onClick={run}>RUN BACKTEST</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={S.loading}>LOADING...</div>}
        {error && <div style={S.error}>ERROR: {error}</div>}

        {data && !loading && (
          <>
            {/* Equity Curve */}
            <div style={S.sectionHeader}>EQUITY CURVE</div>
            <EquityCurveChart data={data} />

            {/* Stats Cards */}
            <div style={S.sectionHeader}>PERFORMANCE METRICS</div>
            <div style={S.statsGrid}>
              <div style={S.statCard}>
                <div style={S.statLabel}>TOTAL RETURN</div>
                <div style={S.statValue(stats.total_return >= 0 ? '#00ff41' : '#ff4444')}>
                  {fmtPct(stats.total_return)}
                </div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>BUY & HOLD RETURN</div>
                <div style={S.statValue(stats.buy_hold_return >= 0 ? '#00ff41' : '#ff4444')}>
                  {fmtPct(stats.buy_hold_return)}
                </div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>SHARPE RATIO</div>
                <div style={S.statValue(stats.sharpe >= 1 ? '#00ff41' : stats.sharpe >= 0 ? '#ffcc00' : '#ff4444')}>
                  {fmtNum(stats.sharpe)}
                </div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>MAX DRAWDOWN</div>
                <div style={S.statValue('#ff4444')}>
                  {fmtPct(stats.max_drawdown)}
                </div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>WIN RATE</div>
                <div style={S.statValue(stats.win_rate >= 0.5 ? '#00ff41' : '#ff4444')}>
                  {stats.win_rate != null ? (stats.win_rate * 100).toFixed(1) + '%' : '--'}
                </div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>PROFIT FACTOR</div>
                <div style={S.statValue(stats.profit_factor >= 1 ? '#00ff41' : '#ff4444')}>
                  {fmtNum(stats.profit_factor)}
                </div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>TOTAL TRADES</div>
                <div style={S.statValue('#fff')}>{stats.total_trades != null ? stats.total_trades : '--'}</div>
              </div>
            </div>

            {/* Trade Log */}
            <div style={S.sectionHeader}>TRADE LOG (LAST 50)</div>
            <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>DATE</th>
                    <th style={S.th}>TYPE</th>
                    <th style={S.th}>PRICE</th>
                    <th style={S.th}>SHARES</th>
                    <th style={S.th}>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(-50).map((t, i) => (
                    <tr key={i}>
                      <td style={S.td}>{t.date || '--'}</td>
                      <td style={{ ...S.td, color: t.type === 'BUY' ? '#00ff41' : '#ff4444', fontWeight: 'bold' }}>
                        {t.type || '--'}
                      </td>
                      <td style={S.td}>${fmtNum(t.price)}</td>
                      <td style={S.td}>{t.shares != null ? t.shares : '--'}</td>
                      <td style={{ ...S.td, color: t.pnl >= 0 ? '#00ff41' : '#ff4444', fontWeight: 'bold' }}>
                        {t.pnl != null ? (t.pnl >= 0 ? '+' : '') + '$' + t.pnl.toFixed(2) : '--'}
                      </td>
                    </tr>
                  ))}
                  {trades.length === 0 && (
                    <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: '#555' }}>NO TRADES EXECUTED</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!data && !loading && !error && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ color: '#555', fontSize: '12px', fontFamily: FONT, textTransform: 'uppercase' }}>
              CONFIGURE PARAMETERS AND CLICK RUN BACKTEST
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
