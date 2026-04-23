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
    width: '110px',
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
  legendRow: {
    display: 'flex',
    gap: '16px',
    padding: '4px 0',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  legendItem: (color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: '#888',
    fontFamily: FONT,
    fontSize: '10px',
  }),
  legendSwatch: (color) => ({
    width: '16px',
    height: '3px',
    background: color,
    display: 'inline-block',
  }),
};

// eslint-disable-next-line no-unused-vars
const BAND_COLORS = [
  { label: '5th - 95th', fill: 'rgba(255,140,0,0.08)', stroke: '#ff8c00' },
  { label: '25th - 75th', fill: 'rgba(255,140,0,0.15)', stroke: '#ff8c00' },
  { label: 'Median', fill: 'none', stroke: '#ffffff' },
];

export default function MonteCarloSim() {
  const [ticker, setTicker] = useState('AAPL');
  const [days, setDays] = useState('252');
  const [sims, setSims] = useState('1000');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/analytics/montecarlo?ticker=${ticker}&days=${days}&simulations=${sims}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || 'Failed to run Monte Carlo simulation');
    } finally {
      setLoading(false);
    }
  };

  const renderFanChart = () => {
    if (!data?.percentiles) return null;
    const { p5, p25, p50, p75, p95 } = data.percentiles;
    const samplePaths = data.sample_paths || [];
    if (!p50 || p50.length < 2) return null;

    const numDays = p50.length;
    const W = 900, H = 300;
    const padL = 70, padR = 20, padT = 16, padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    // Find Y range from all percentile bands
    const allVals = [...(p5 || []), ...(p95 || []), ...(p50 || [])];
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const range = maxV - minV || 1;

    const xScale = (i) => padL + (i / (numDays - 1)) * chartW;
    const yScale = (v) => padT + ((maxV - v) / range) * chartH;

    const buildPath = (arr) =>
      arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(v)}`).join(' ');

    // Band polygon: upper forward + lower reversed
    const buildBand = (upper, lower) => {
      if (!upper || !lower) return '';
      const fwd = upper.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ');
      const rev = [...lower].reverse().map((v, i) => `${xScale(numDays - 1 - i)},${yScale(v)}`).join(' ');
      return `${fwd} ${rev}`;
    };

    // Y ticks
    const yTicks = [];
    const step = range / 5;
    for (let i = 0; i <= 5; i++) {
      yTicks.push(minV + step * i);
    }

    // X labels
    const xLabels = [];
    const labelCount = 6;
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.round((i / (labelCount - 1)) * (numDays - 1));
      xLabels.push({ idx, label: `Day ${idx}` });
    }

    return (
      <div>
        <div style={S.sectionTitle}>SIMULATION FAN CHART</div>
        <div style={S.svgWrap}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
            {/* Y grid */}
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
                  ${v.toFixed(0)}
                </text>
              </g>
            ))}

            {/* 5th-95th band */}
            {p5 && p95 && (
              <polygon
                points={buildBand(p95, p5)}
                fill="rgba(255,140,0,0.08)"
                stroke="none"
              />
            )}

            {/* 25th-75th band */}
            {p25 && p75 && (
              <polygon
                points={buildBand(p75, p25)}
                fill="rgba(255,140,0,0.15)"
                stroke="none"
              />
            )}

            {/* Sample paths */}
            {samplePaths.slice(0, 20).map((path, i) => (
              <path
                key={i}
                d={buildPath(path)}
                fill="none"
                stroke="#555"
                strokeWidth="0.5"
                opacity="0.4"
              />
            ))}

            {/* Percentile lines */}
            {p5 && (
              <path d={buildPath(p5)} fill="none" stroke="#ff8c00" strokeWidth="0.7" strokeDasharray="3,3" opacity="0.6" />
            )}
            {p95 && (
              <path d={buildPath(p95)} fill="none" stroke="#ff8c00" strokeWidth="0.7" strokeDasharray="3,3" opacity="0.6" />
            )}
            {p25 && (
              <path d={buildPath(p25)} fill="none" stroke="#ff8c00" strokeWidth="0.8" opacity="0.7" />
            )}
            {p75 && (
              <path d={buildPath(p75)} fill="none" stroke="#ff8c00" strokeWidth="0.8" opacity="0.7" />
            )}

            {/* Median */}
            <path d={buildPath(p50)} fill="none" stroke="#fff" strokeWidth="1.5" />

            {/* X labels */}
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

          {/* Legend */}
          <div style={S.legendRow}>
            <span style={S.legendItem('#fff')}>
              <span style={S.legendSwatch('#fff')} /> MEDIAN (P50)
            </span>
            <span style={S.legendItem('#ff8c00')}>
              <span style={{ ...S.legendSwatch('#ff8c00'), opacity: 0.7 }} /> P25 / P75
            </span>
            <span style={S.legendItem('#ff8c00')}>
              <span style={{ ...S.legendSwatch('#ff8c00'), opacity: 0.4, borderStyle: 'dashed' }} /> P5 / P95
            </span>
            <span style={S.legendItem('#555')}>
              <span style={S.legendSwatch('#555')} /> SAMPLE PATHS
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderHistogram = () => {
    if (!data?.final_prices || data.final_prices.length === 0) return null;
    const prices = [...data.final_prices].sort((a, b) => a - b);

    // Build histogram bins
    const numBins = 40;
    const minP = prices[0];
    const maxP = prices[prices.length - 1];
    const binWidth = (maxP - minP) / numBins || 1;
    const bins = Array.from({ length: numBins }, (_, i) => ({
      low: minP + i * binWidth,
      high: minP + (i + 1) * binWidth,
      count: 0,
    }));
    prices.forEach((p) => {
      const idx = Math.min(Math.floor((p - minP) / binWidth), numBins - 1);
      bins[idx].count++;
    });
    const maxCount = Math.max(...bins.map((b) => b.count));

    const W = 900, H = 180;
    const padL = 50, padR = 20, padT = 12, padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const startPrice = data.start_price || prices[0];

    return (
      <div>
        <div style={S.sectionTitle}>FINAL PRICE DISTRIBUTION</div>
        <div style={S.svgWrap}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
            {bins.map((bin, i) => {
              const x = padL + (i / numBins) * chartW;
              const barW = chartW / numBins;
              const barH = (bin.count / maxCount) * chartH;
              const y = padT + chartH - barH;
              const mid = (bin.low + bin.high) / 2;
              const isAbove = mid >= startPrice;
              return (
                <rect
                  key={i}
                  x={x} y={y} width={Math.max(barW - 1, 1)} height={barH}
                  fill={isAbove ? '#00ff41' : '#ff4444'}
                  opacity="0.7"
                />
              );
            })}

            {/* Start price reference line */}
            {startPrice >= minP && startPrice <= maxP && (() => {
              const x = padL + ((startPrice - minP) / (maxP - minP)) * chartW;
              return (
                <g>
                  <line x1={x} y1={padT} x2={x} y2={padT + chartH} stroke="#ff8c00" strokeWidth="1.5" strokeDasharray="4,3" />
                  <text x={x} y={padT - 3} fill="#ff8c00" fontSize="8" fontFamily={FONT} textAnchor="middle">
                    CURRENT ${startPrice.toFixed(0)}
                  </text>
                </g>
              );
            })()}

            {/* X labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const val = minP + t * (maxP - minP);
              const x = padL + t * chartW;
              return (
                <text
                  key={t} x={x} y={H - 6}
                  fill="#555" fontSize="8" fontFamily={FONT} textAnchor="middle"
                >
                  ${val.toFixed(0)}
                </text>
              );
            })}

            <rect
              x={padL} y={padT} width={chartW} height={chartH}
              fill="none" stroke="#333" strokeWidth="0.5"
            />
          </svg>
        </div>
      </div>
    );
  };

  const stats = data?.stats;
  const metricCards = stats
    ? [
        { label: 'Mean', value: '$' + stats.mean.toFixed(2), color: '#e0e0e0' },
        { label: 'Median', value: '$' + stats.median.toFixed(2), color: '#e0e0e0' },
        { label: 'P5 (Bear)', value: '$' + stats.p5.toFixed(2), color: '#ff4444' },
        { label: 'P95 (Bull)', value: '$' + stats.p95.toFixed(2), color: '#00ff41' },
        {
          label: 'Prob Positive',
          value: (stats.prob_positive * 100).toFixed(1) + '%',
          color: stats.prob_positive >= 0.5 ? '#00ff41' : '#ff4444',
        },
        {
          label: 'Expected Return',
          value: (stats.expected_return * 100).toFixed(2) + '%',
          color: stats.expected_return >= 0 ? '#00ff41' : '#ff4444',
        },
      ]
    : [];

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>MONTE CARLO SIMULATION</span>
      </div>

      <div style={S.body}>
        {/* Inputs */}
        <div style={S.row}>
          <div style={S.fieldGroup}>
            <span style={S.label}>Ticker</span>
            <input style={S.input} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>Days</span>
            <input style={S.input} value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>Simulations</span>
            <input style={S.input} value={sims} onChange={(e) => setSims(e.target.value)} />
          </div>
          <button style={S.btn} onClick={run} disabled={loading}>
            RUN SIMULATION
          </button>
        </div>

        {loading && <div style={S.loadingTxt}>LOADING...</div>}
        {error && !loading && <div style={S.errorTxt}>{'\u26A0'} {error}</div>}

        {data && !loading && (
          <>
            {/* Stats panel */}
            {stats && (
              <div style={S.metricsRow}>
                {metricCards.map((m) => (
                  <div key={m.label} style={S.metricCard}>
                    <div style={S.metricLabel}>{m.label}</div>
                    <div style={S.metricValue(m.color)}>{m.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Fan chart */}
            {renderFanChart()}

            {/* Histogram */}
            {renderHistogram()}
          </>
        )}
      </div>
    </div>
  );
}
