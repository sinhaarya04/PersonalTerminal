import React, { useState } from 'react';

const FONT = "'Consolas','Courier New',monospace";

const S = {
  container: {
    background: '#000',
    minHeight: '600px',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    background: '#0d0d1a',
    borderBottom: '1px solid #333',
    padding: '4px 8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#ff8c00',
    fontFamily: FONT,
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  body: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    flex: 1,
  },
  row: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  label: {
    color: '#888',
    fontFamily: FONT,
    fontSize: '10px',
    textTransform: 'uppercase',
  },
  input: {
    background: '#0d0d1a',
    border: '1px solid #333',
    color: '#e0e0e0',
    fontFamily: FONT,
    fontSize: '12px',
    padding: '4px 8px',
    width: '180px',
    outline: 'none',
  },
  select: {
    background: '#0d0d1a',
    border: '1px solid #333',
    color: '#e0e0e0',
    fontFamily: FONT,
    fontSize: '12px',
    padding: '4px 8px',
    width: '80px',
    outline: 'none',
  },
  btn: {
    background: '#ff8c00',
    color: '#000',
    border: 'none',
    fontFamily: FONT,
    fontSize: '11px',
    padding: '5px 16px',
    cursor: 'pointer',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    letterSpacing: '0.5px',
  },
  loadingTxt: {
    padding: '40px',
    color: '#ff8c00',
    fontFamily: FONT,
    fontSize: '12px',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  errorTxt: {
    padding: '20px',
    color: '#ff4444',
    fontFamily: FONT,
    fontSize: '12px',
  },
  sectionTitle: {
    color: '#ff8c00',
    fontFamily: FONT,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #333',
    paddingBottom: '4px',
    marginBottom: '8px',
  },
  metricsRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  metricCard: {
    background: '#0d0d1a',
    border: '1px solid #333',
    padding: '8px 14px',
    minWidth: '110px',
  },
  metricLabel: {
    color: '#888',
    fontFamily: FONT,
    fontSize: '9px',
    textTransform: 'uppercase',
    marginBottom: '2px',
  },
  metricValue: (color) => ({
    color: color || '#e0e0e0',
    fontFamily: FONT,
    fontSize: '14px',
    fontWeight: 'bold',
  }),
  svgWrap: {
    background: '#000',
    padding: '8px',
  },
  table: {
    borderCollapse: 'collapse',
    fontFamily: FONT,
    fontSize: '11px',
    width: '100%',
  },
  th: {
    background: '#0d0d1a',
    color: '#ff8c00',
    border: '1px solid #333',
    padding: '4px 8px',
    textAlign: 'left',
    textTransform: 'uppercase',
    fontSize: '10px',
    fontWeight: 'bold',
  },
  td: {
    border: '1px solid #333',
    padding: '4px 8px',
    color: '#e0e0e0',
  },
};

function corrToColor(v) {
  if (v == null) return '#1a1a2e';
  if (v >= 0) {
    const t = v;
    const r = Math.round(26 * (1 - t));
    const g = Math.round(26 + (77 - 26) * t);
    const b = Math.round(46 * (1 - t));
    return `rgb(${r},${g},${b})`;
  } else {
    const t = -v;
    const r = Math.round(26 + (77 - 26) * t);
    const g = Math.round(26 * (1 - t));
    const b = Math.round(46 * (1 - t));
    return `rgb(${r},${g},${b})`;
  }
}

export default function PortfolioAnalytics() {
  const [tickers, setTickers] = useState('AAPL,MSFT,GOOG');
  const [weights, setWeights] = useState('0.4,0.3,0.3');
  const [period, setPeriod] = useState('1y');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/analytics/portfolio?tickers=${tickers}&weights=${weights}&period=${period}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || 'Failed to fetch portfolio analytics');
    } finally {
      setLoading(false);
    }
  };

  const fmtPct = (v) => (v != null ? (v * 100).toFixed(2) + '%' : '--');
  const fmtNum = (v, d = 2) => (v != null ? v.toFixed(d) : '--');

  const renderLineChart = (title, points, color, yFmt) => {
    if (!points || points.length < 2) return null;
    const W = 900, H = 200;
    const padL = 60, padR = 20, padT = 16, padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const vals = points.map((p) => (typeof p === 'object' ? p.value : p));
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const range = maxV - minV || 1;

    const xScale = (i) => padL + (i / (vals.length - 1)) * chartW;
    const yScale = (v) => padT + ((maxV - v) / range) * chartH;

    const pathD = vals
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(v)}`)
      .join(' ');

    // Y ticks
    const yTicks = [];
    const step = range / 4;
    for (let i = 0; i <= 4; i++) {
      yTicks.push(minV + step * i);
    }

    // X labels
    const dates = points.map((p) => (typeof p === 'object' ? p.date : null));
    const xLabels = [];
    const labelCount = Math.min(6, vals.length);
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.round((i / (labelCount - 1)) * (vals.length - 1));
      xLabels.push({ idx, label: dates[idx] || String(idx) });
    }

    return (
      <div>
        <div style={S.sectionTitle}>{title}</div>
        <div style={S.svgWrap}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
            {yTicks.map((v, i) => (
              <g key={i}>
                <line
                  x1={padL} y1={yScale(v)} x2={W - padR} y2={yScale(v)}
                  stroke="#1a1a2e" strokeWidth="0.5"
                />
                <text
                  x={padL - 4} y={yScale(v) + 3}
                  fill="#666" fontSize="9" fontFamily={FONT} textAnchor="end"
                >
                  {yFmt ? yFmt(v) : v.toFixed(2)}
                </text>
              </g>
            ))}
            <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" />
            <path
              d={`${pathD} L${xScale(vals.length - 1)},${yScale(minV)} L${xScale(0)},${yScale(minV)} Z`}
              fill={color} opacity="0.07"
            />
            {xLabels.map((xl) => (
              <text
                key={xl.idx} x={xScale(xl.idx)} y={H - 6}
                fill="#555" fontSize="8" fontFamily={FONT} textAnchor="middle"
              >
                {xl.label}
              </text>
            ))}
            <rect
              x={padL} y={padT} width={chartW} height={chartH}
              fill="none" stroke="#333" strokeWidth="0.5"
            />
          </svg>
        </div>
      </div>
    );
  };

  const renderCorrelationMatrix = () => {
    if (!data?.correlation) return null;
    const { tickers: tickerList, matrix } = data.correlation;
    if (!tickerList || !matrix) return null;

    return (
      <div>
        <div style={S.sectionTitle}>CORRELATION MATRIX</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontFamily: FONT, fontSize: '11px' }}>
            <thead>
              <tr>
                <th style={{ background: '#0d0d1a', border: '1px solid #333', padding: '4px 8px' }} />
                {tickerList.map((t) => (
                  <th
                    key={t}
                    style={{
                      background: '#0d0d1a',
                      color: '#ffcc00',
                      border: '1px solid #333',
                      padding: '4px 8px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickerList.map((rowT, ri) => (
                <tr key={rowT}>
                  <th
                    style={{
                      background: '#0d0d1a',
                      color: '#ffcc00',
                      border: '1px solid #333',
                      padding: '4px 8px',
                      textAlign: 'right',
                      fontWeight: 'bold',
                    }}
                  >
                    {rowT}
                  </th>
                  {tickerList.map((colT, ci) => {
                    const v = matrix[ri]?.[ci];
                    const isDiag = ri === ci;
                    return (
                      <td
                        key={colT}
                        style={{
                          background: isDiag ? '#2a2a3e' : corrToColor(v),
                          color: isDiag ? '#888' : Math.abs(v) > 0.5 ? '#fff' : '#ccc',
                          border: '1px solid #2a2a3e',
                          padding: '4px 8px',
                          textAlign: 'center',
                          fontWeight: 'bold',
                          minWidth: '60px',
                        }}
                      >
                        {v != null ? v.toFixed(2) : '--'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAssetTable = () => {
    if (!data?.asset_stats) return null;
    return (
      <div>
        <div style={S.sectionTitle}>INDIVIDUAL ASSET STATISTICS</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Ticker</th>
              <th style={S.th}>Ann. Return</th>
              <th style={S.th}>Ann. Vol</th>
              <th style={S.th}>Sharpe</th>
              <th style={S.th}>Max DD</th>
              <th style={S.th}>Sortino</th>
            </tr>
          </thead>
          <tbody>
            {data.asset_stats.map((a) => (
              <tr key={a.ticker}>
                <td style={{ ...S.td, color: '#ffcc00', fontWeight: 'bold' }}>{a.ticker}</td>
                <td style={{ ...S.td, color: a.annual_return >= 0 ? '#00ff41' : '#ff4444' }}>
                  {fmtPct(a.annual_return)}
                </td>
                <td style={S.td}>{fmtPct(a.annual_vol)}</td>
                <td style={S.td}>{fmtNum(a.sharpe)}</td>
                <td style={{ ...S.td, color: '#ff4444' }}>{fmtPct(a.max_drawdown)}</td>
                <td style={S.td}>{fmtNum(a.sortino)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const metrics = data
    ? [
        { label: 'Sharpe Ratio', value: fmtNum(data.sharpe), color: data.sharpe >= 1 ? '#00ff41' : '#e0e0e0' },
        { label: 'Sortino Ratio', value: fmtNum(data.sortino), color: data.sortino >= 1 ? '#00ff41' : '#e0e0e0' },
        { label: 'VaR 95%', value: fmtPct(data.var_95), color: '#ff4444' },
        { label: 'CVaR', value: fmtPct(data.cvar), color: '#ff4444' },
        { label: 'Max Drawdown', value: fmtPct(data.max_drawdown), color: '#ff4444' },
        { label: 'Ann. Return', value: fmtPct(data.annual_return), color: data.annual_return >= 0 ? '#00ff41' : '#ff4444' },
        { label: 'Ann. Vol', value: fmtPct(data.annual_vol), color: '#e0e0e0' },
      ]
    : [];

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>PORTFOLIO ANALYTICS — RISK METRICS</span>
      </div>

      <div style={S.body}>
        {/* Inputs */}
        <div style={S.row}>
          <div style={S.fieldGroup}>
            <span style={S.label}>Tickers (comma-sep)</span>
            <input style={{ ...S.input, width: '200px' }} value={tickers} onChange={(e) => setTickers(e.target.value)} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>Weights (comma-sep)</span>
            <input style={{ ...S.input, width: '200px' }} value={weights} onChange={(e) => setWeights(e.target.value)} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>Period</span>
            <select style={S.select} value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="6mo">6 MO</option>
              <option value="1y">1 YR</option>
              <option value="2y">2 YR</option>
              <option value="5y">5 YR</option>
            </select>
          </div>
          <button style={S.btn} onClick={analyze} disabled={loading}>
            ANALYZE
          </button>
        </div>

        {loading && <div style={S.loadingTxt}>LOADING...</div>}
        {error && !loading && <div style={S.errorTxt}>{'\u26A0'} {error}</div>}

        {data && !loading && (
          <>
            {/* Metric cards */}
            <div style={S.metricsRow}>
              {metrics.map((m) => (
                <div key={m.label} style={S.metricCard}>
                  <div style={S.metricLabel}>{m.label}</div>
                  <div style={S.metricValue(m.color)}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Cumulative returns chart */}
            {renderLineChart(
              'CUMULATIVE RETURNS',
              data.cumulative_returns,
              '#ff8c00',
              (v) => (v * 100).toFixed(1) + '%'
            )}

            {/* Rolling Sharpe chart */}
            {renderLineChart(
              'ROLLING SHARPE RATIO',
              data.rolling_sharpe,
              '#00cccc',
              (v) => v.toFixed(2)
            )}

            {/* Correlation Matrix */}
            {renderCorrelationMatrix()}

            {/* Asset stats table */}
            {renderAssetTable()}
          </>
        )}
      </div>
    </div>
  );
}
