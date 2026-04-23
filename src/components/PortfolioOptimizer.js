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
    width: '200px',
    outline: 'none',
  },
  select: {
    background: '#0d0d1a',
    border: '1px solid #333',
    color: '#e0e0e0',
    fontFamily: FONT,
    fontSize: '12px',
    padding: '4px 8px',
    width: '130px',
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
    minWidth: '130px',
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

// Color palette for pie chart slices
const PIE_COLORS = [
  '#ff8c00', '#00cccc', '#00ff41', '#ff4444', '#ffcc00',
  '#cc66ff', '#66aaff', '#ff6699', '#88ff88', '#ffaa44',
];

export default function PortfolioOptimizer() {
  const [tickers, setTickers] = useState('AAPL,MSFT,GOOG,AMZN');
  const [period, setPeriod] = useState('1y');
  const [method, setMethod] = useState('max_sharpe');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const optimize = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/analytics/optimizer?tickers=${tickers}&period=${period}&method=${method}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || 'Failed to run portfolio optimizer');
    } finally {
      setLoading(false);
    }
  };

  const renderPieChart = () => {
    if (!data?.weights) return null;
    const entries = Object.entries(data.weights)
      .filter(([, w]) => w > 0.001)
      .sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return null;

    const size = 240;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 10;

    let cumAngle = -Math.PI / 2;
    const slices = entries.map(([ticker, weight], i) => {
      const angle = weight * 2 * Math.PI;
      const startAngle = cumAngle;
      const endAngle = cumAngle + angle;
      cumAngle = endAngle;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;

      const midAngle = startAngle + angle / 2;
      const labelR = r * 0.65;
      const lx = cx + labelR * Math.cos(midAngle);
      const ly = cy + labelR * Math.sin(midAngle);

      const d = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;

      return {
        d,
        color: PIE_COLORS[i % PIE_COLORS.length],
        ticker,
        weight,
        lx,
        ly,
        showLabel: angle > 0.25,
      };
    });

    return (
      <div>
        <div style={S.sectionTitle}>OPTIMAL WEIGHTS</div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={S.svgWrap}>
            <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: 'block' }}>
              {slices.map((sl, i) => (
                <g key={i}>
                  <path d={sl.d} fill={sl.color} stroke="#000" strokeWidth="1.5" />
                  {sl.showLabel && (
                    <text
                      x={sl.lx} y={sl.ly}
                      fill="#000" fontSize="10" fontFamily={FONT}
                      textAnchor="middle" dominantBaseline="middle"
                      fontWeight="bold"
                    >
                      {sl.ticker}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {entries.map(([ticker, weight], i) => (
              <div
                key={ticker}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: FONT,
                  fontSize: '11px',
                }}
              >
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    background: PIE_COLORS[i % PIE_COLORS.length],
                    display: 'inline-block',
                    borderRadius: '2px',
                  }}
                />
                <span style={{ color: '#e0e0e0', fontWeight: 'bold', minWidth: '50px' }}>
                  {ticker}
                </span>
                <span style={{ color: '#888' }}>
                  {(weight * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderEfficientFrontier = () => {
    if (!data?.frontier) return null;
    const { points, optimal, assets } = data.frontier;
    if (!points || points.length < 2) return null;

    const W = 900, H = 320;
    const padL = 70, padR = 30, padT = 20, padB = 36;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const allX = [...points.map((p) => p.vol), ...(assets || []).map((a) => a.vol)];
    const allY = [...points.map((p) => p.ret), ...(assets || []).map((a) => a.ret)];
    if (optimal) {
      allX.push(optimal.vol);
      allY.push(optimal.ret);
    }

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    const rangeX = maxX - minX || 0.01;
    const rangeY = maxY - minY || 0.01;
    const padFactorX = rangeX * 0.1;
    const padFactorY = rangeY * 0.1;

    const xScale = (v) => padL + ((v - (minX - padFactorX)) / (rangeX + 2 * padFactorX)) * chartW;
    const yScale = (v) => padT + (((maxY + padFactorY) - v) / (rangeY + 2 * padFactorY)) * chartH;

    // Frontier line
    const frontierPath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.vol)},${yScale(p.ret)}`)
      .join(' ');

    // Y ticks
    const yTicks = [];
    const yStep = rangeY / 4;
    for (let i = 0; i <= 4; i++) {
      yTicks.push(minY + yStep * i);
    }

    // X ticks
    const xTicks = [];
    const xStep = rangeX / 4;
    for (let i = 0; i <= 4; i++) {
      xTicks.push(minX + xStep * i);
    }

    return (
      <div>
        <div style={S.sectionTitle}>EFFICIENT FRONTIER</div>
        <div style={S.svgWrap}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
            {/* Grid */}
            {yTicks.map((v, i) => (
              <g key={'y' + i}>
                <line
                  x1={padL} y1={yScale(v)} x2={W - padR} y2={yScale(v)}
                  stroke="#1a1a2e" strokeWidth="0.5"
                />
                <text
                  x={padL - 4} y={yScale(v) + 3}
                  fill="#666" fontSize="9" fontFamily={FONT} textAnchor="end"
                >
                  {(v * 100).toFixed(1)}%
                </text>
              </g>
            ))}
            {xTicks.map((v, i) => (
              <text
                key={'x' + i}
                x={xScale(v)} y={H - padB + 16}
                fill="#666" fontSize="9" fontFamily={FONT} textAnchor="middle"
              >
                {(v * 100).toFixed(1)}%
              </text>
            ))}

            {/* Axis labels */}
            <text
              x={W / 2} y={H - 4}
              fill="#888" fontSize="9" fontFamily={FONT} textAnchor="middle"
            >
              VOLATILITY
            </text>
            <text
              x={12} y={H / 2}
              fill="#888" fontSize="9" fontFamily={FONT}
              textAnchor="middle"
              transform={`rotate(-90, 12, ${H / 2})`}
            >
              RETURN
            </text>

            {/* Frontier line */}
            <path d={frontierPath} fill="none" stroke="#ff8c00" strokeWidth="2" />

            {/* Frontier dots */}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={xScale(p.vol)} cy={yScale(p.ret)}
                r="2" fill="#ff8c00" opacity="0.5"
              />
            ))}

            {/* Asset points */}
            {(assets || []).map((a, i) => (
              <g key={'a' + i}>
                <circle
                  cx={xScale(a.vol)} cy={yScale(a.ret)}
                  r="5" fill="none" stroke={PIE_COLORS[i % PIE_COLORS.length]}
                  strokeWidth="2"
                />
                <text
                  x={xScale(a.vol) + 8} y={yScale(a.ret) + 3}
                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                  fontSize="10" fontFamily={FONT} fontWeight="bold"
                >
                  {a.ticker}
                </text>
              </g>
            ))}

            {/* Optimal point */}
            {optimal && (
              <g>
                <circle
                  cx={xScale(optimal.vol)} cy={yScale(optimal.ret)}
                  r="7" fill="none" stroke="#fff" strokeWidth="2"
                />
                <circle
                  cx={xScale(optimal.vol)} cy={yScale(optimal.ret)}
                  r="4" fill="#ff8c00"
                />
                <text
                  x={xScale(optimal.vol) + 10} y={yScale(optimal.ret) - 4}
                  fill="#fff" fontSize="10" fontFamily={FONT} fontWeight="bold"
                >
                  OPTIMAL
                </text>
              </g>
            )}

            <rect
              x={padL} y={padT} width={chartW} height={chartH}
              fill="none" stroke="#333" strokeWidth="0.5"
            />
          </svg>
        </div>
      </div>
    );
  };

  const renderComparisonTable = () => {
    if (!data?.comparison) return null;
    const { optimal: opt, equal_weight: eq } = data.comparison;
    if (!opt || !eq) return null;

    const rows = [
      { label: 'Expected Return', optVal: opt.expected_return, eqVal: eq.expected_return, fmt: 'pct' },
      { label: 'Volatility', optVal: opt.volatility, eqVal: eq.volatility, fmt: 'pct' },
      { label: 'Sharpe Ratio', optVal: opt.sharpe, eqVal: eq.sharpe, fmt: 'num' },
    ];

    const fmtVal = (v, fmt) => {
      if (v == null) return '--';
      return fmt === 'pct' ? (v * 100).toFixed(2) + '%' : v.toFixed(3);
    };

    return (
      <div>
        <div style={S.sectionTitle}>OPTIMAL vs EQUAL WEIGHT</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Metric</th>
              <th style={S.th}>Optimal</th>
              <th style={S.th}>Equal Weight</th>
              <th style={S.th}>Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const diff = r.optVal != null && r.eqVal != null ? r.optVal - r.eqVal : null;
              const better = r.label === 'Volatility' ? (diff != null && diff < 0) : (diff != null && diff > 0);
              return (
                <tr key={r.label}>
                  <td style={{ ...S.td, color: '#ffcc00', fontWeight: 'bold' }}>{r.label}</td>
                  <td style={{ ...S.td, color: '#ff8c00' }}>{fmtVal(r.optVal, r.fmt)}</td>
                  <td style={S.td}>{fmtVal(r.eqVal, r.fmt)}</td>
                  <td style={{ ...S.td, color: better ? '#00ff41' : '#ff4444' }}>
                    {diff != null
                      ? (diff >= 0 ? '+' : '') + fmtVal(diff, r.fmt)
                      : '--'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const statsCards = data?.stats
    ? [
        {
          label: 'Expected Return',
          value: (data.stats.expected_return * 100).toFixed(2) + '%',
          color: data.stats.expected_return >= 0 ? '#00ff41' : '#ff4444',
        },
        {
          label: 'Volatility',
          value: (data.stats.volatility * 100).toFixed(2) + '%',
          color: '#e0e0e0',
        },
        {
          label: 'Sharpe Ratio',
          value: data.stats.sharpe.toFixed(3),
          color: data.stats.sharpe >= 1 ? '#00ff41' : '#e0e0e0',
        },
      ]
    : [];

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>PORTFOLIO OPTIMIZER — MEAN-VARIANCE</span>
      </div>

      <div style={S.body}>
        {/* Inputs */}
        <div style={S.row}>
          <div style={S.fieldGroup}>
            <span style={S.label}>Tickers (comma-sep)</span>
            <input style={S.input} value={tickers} onChange={(e) => setTickers(e.target.value.toUpperCase())} />
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
          <div style={S.fieldGroup}>
            <span style={S.label}>Method</span>
            <select style={S.select} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="max_sharpe">MAX SHARPE</option>
              <option value="min_vol">MIN VOL</option>
              <option value="risk_parity">RISK PARITY</option>
              <option value="equal">EQUAL WEIGHT</option>
            </select>
          </div>
          <button style={S.btn} onClick={optimize} disabled={loading}>
            OPTIMIZE
          </button>
        </div>

        {loading && <div style={S.loadingTxt}>LOADING...</div>}
        {error && !loading && <div style={S.errorTxt}>{'\u26A0'} {error}</div>}

        {data && !loading && (
          <>
            {/* Stats */}
            {statsCards.length > 0 && (
              <div style={S.metricsRow}>
                {statsCards.map((c) => (
                  <div key={c.label} style={S.metricCard}>
                    <div style={S.metricLabel}>{c.label}</div>
                    <div style={S.metricValue(c.color)}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Pie chart */}
            {renderPieChart()}

            {/* Efficient frontier */}
            {renderEfficientFrontier()}

            {/* Comparison table */}
            {renderComparisonTable()}
          </>
        )}
      </div>
    </div>
  );
}
