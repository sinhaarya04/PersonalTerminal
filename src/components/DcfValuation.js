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
    minWidth: '120px',
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
    fontSize: '16px',
    fontWeight: 'bold',
  }),
  svgWrap: {
    background: '#000',
    padding: '8px',
  },
};

function fmtUSD(v) {
  if (v == null) return '--';
  if (Math.abs(v) >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  return '$' + v.toFixed(2);
}

export default function DcfValuation() {
  const [ticker, setTicker] = useState('AAPL');
  const [growth, setGrowth] = useState('8');
  const [termGrowth, setTermGrowth] = useState('3');
  const [wacc, setWacc] = useState('10');
  const [years, setYears] = useState('5');
  const [mos, setMos] = useState('25');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const g = parseFloat(growth) / 100;
      const tg = parseFloat(termGrowth) / 100;
      const w = parseFloat(wacc) / 100;
      const url = `/analytics/dcf?ticker=${ticker}&growth=${g}&terminal_growth=${tg}&wacc=${w}&years=${years}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || 'Failed to run DCF model');
    } finally {
      setLoading(false);
    }
  };

  const renderBarChart = () => {
    if (!data?.fcf_projections || data.fcf_projections.length === 0) return null;
    const projections = data.fcf_projections;
    const W = 900, H = 220;
    const padL = 70, padR = 20, padT = 16, padB = 36;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const vals = projections.map((p) => p.value);
    const maxVal = Math.max(...vals, 0);
    const minVal = Math.min(...vals, 0);
    const range = maxVal - minVal || 1;

    const barW = (chartW / projections.length) * 0.7;
    const gap = (chartW / projections.length) * 0.3;
    const zeroY = padT + ((maxVal - 0) / range) * chartH;

    return (
      <div>
        <div style={S.sectionTitle}>FCF PROJECTIONS</div>
        <div style={S.svgWrap}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
            {/* Zero line */}
            <line
              x1={padL} y1={zeroY} x2={W - padR} y2={zeroY}
              stroke="#333" strokeWidth="1" strokeDasharray="3,3"
            />
            {/* Y axis labels */}
            {[0, 1, 2, 3, 4].map((i) => {
              const v = minVal + (range / 4) * i;
              const y = padT + ((maxVal - v) / range) * chartH;
              return (
                <text
                  key={i} x={padL - 4} y={y + 3}
                  fill="#666" fontSize="9" fontFamily={FONT} textAnchor="end"
                >
                  {fmtUSD(v)}
                </text>
              );
            })}
            {/* Bars */}
            {projections.map((p, i) => {
              const x = padL + i * (chartW / projections.length) + gap / 2;
              const barVal = p.value;
              const barTop = barVal >= 0
                ? padT + ((maxVal - barVal) / range) * chartH
                : zeroY;
              const barH = Math.abs(barVal) / range * chartH;
              return (
                <g key={i}>
                  <rect
                    x={x} y={barTop} width={barW} height={Math.max(barH, 1)}
                    fill={barVal >= 0 ? '#00ff41' : '#ff4444'}
                    opacity="0.8"
                    rx="1"
                  />
                  <text
                    x={x + barW / 2} y={barTop - 4}
                    fill="#e0e0e0" fontSize="9" fontFamily={FONT}
                    textAnchor="middle"
                  >
                    {fmtUSD(barVal)}
                  </text>
                  <text
                    x={x + barW / 2} y={H - padB + 14}
                    fill="#888" fontSize="9" fontFamily={FONT}
                    textAnchor="middle"
                  >
                    {p.year || `Y${i + 1}`}
                  </text>
                </g>
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

  const renderWaterfall = () => {
    if (!data?.waterfall) return null;
    const items = data.waterfall;
    const W = 900, H = 240;
    const padL = 70, padR = 20, padT = 16, padB = 50;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    // Compute cumulative positions
    let cumulative = 0;
    const bars = items.map((item) => {
      const start = cumulative;
      cumulative += item.value;
      return { ...item, start, end: cumulative };
    });

    const allVals = bars.flatMap((b) => [b.start, b.end]);
    const minV = Math.min(...allVals, 0);
    const maxV = Math.max(...allVals);
    const range = maxV - minV || 1;

    const yScale = (v) => padT + ((maxV - v) / range) * chartH;
    const barW = (chartW / bars.length) * 0.65;
    const slotW = chartW / bars.length;

    return (
      <div>
        <div style={S.sectionTitle}>DCF WATERFALL</div>
        <div style={S.svgWrap}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
            {/* Zero line */}
            {minV < 0 && (
              <line
                x1={padL} y1={yScale(0)} x2={W - padR} y2={yScale(0)}
                stroke="#333" strokeWidth="0.5" strokeDasharray="3,3"
              />
            )}
            {bars.map((b, i) => {
              const x = padL + i * slotW + (slotW - barW) / 2;
              const top = yScale(Math.max(b.start, b.end));
              const bottom = yScale(Math.min(b.start, b.end));
              const h = Math.max(bottom - top, 1);
              const isPositive = b.value >= 0;
              // Connector line to next bar
              const connector =
                i < bars.length - 1
                  ? { x1: x + barW, y1: yScale(b.end), x2: padL + (i + 1) * slotW + (slotW - barW) / 2, y2: yScale(b.end) }
                  : null;
              return (
                <g key={i}>
                  <rect
                    x={x} y={top} width={barW} height={h}
                    fill={isPositive ? '#00ff41' : '#ff4444'}
                    opacity="0.85"
                    rx="1"
                  />
                  <text
                    x={x + barW / 2} y={top - 4}
                    fill="#e0e0e0" fontSize="8" fontFamily={FONT}
                    textAnchor="middle"
                  >
                    {fmtUSD(b.value)}
                  </text>
                  <text
                    x={x + barW / 2} y={H - padB + 10}
                    fill="#888" fontSize="8" fontFamily={FONT}
                    textAnchor="middle"
                    transform={`rotate(-20, ${x + barW / 2}, ${H - padB + 10})`}
                  >
                    {b.label}
                  </text>
                  {connector && (
                    <line
                      x1={connector.x1} y1={connector.y1}
                      x2={connector.x2} y2={connector.y2}
                      stroke="#555" strokeWidth="0.5" strokeDasharray="2,2"
                    />
                  )}
                </g>
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

  const renderSensitivity = () => {
    if (!data?.sensitivity) return null;
    const { wacc_range, growth_range, values } = data.sensitivity;
    if (!wacc_range || !growth_range || !values) return null;

    const currentPrice = data.current_price || 0;

    return (
      <div>
        <div style={S.sectionTitle}>SENSITIVITY TABLE — WACC vs GROWTH RATE</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontFamily: FONT, fontSize: '11px' }}>
            <thead>
              <tr>
                <th
                  style={{
                    background: '#0d0d1a',
                    color: '#888',
                    border: '1px solid #333',
                    padding: '4px 8px',
                    fontSize: '9px',
                  }}
                >
                  WACC \ GROWTH
                </th>
                {growth_range.map((g, i) => (
                  <th
                    key={i}
                    style={{
                      background: '#0d0d1a',
                      color: '#ffcc00',
                      border: '1px solid #333',
                      padding: '4px 8px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    {(g * 100).toFixed(1)}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wacc_range.map((w, ri) => (
                <tr key={ri}>
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
                    {(w * 100).toFixed(1)}%
                  </th>
                  {(values[ri] || []).map((val, ci) => {
                    const isAbove = val != null && val > currentPrice;
                    return (
                      <td
                        key={ci}
                        style={{
                          background: val != null
                            ? isAbove ? 'rgba(0,255,65,0.1)' : 'rgba(255,68,68,0.1)'
                            : '#1a1a2e',
                          color: val != null ? (isAbove ? '#00ff41' : '#ff4444') : '#888',
                          border: '1px solid #333',
                          padding: '4px 8px',
                          textAlign: 'center',
                          fontWeight: 'bold',
                          minWidth: '70px',
                        }}
                      >
                        {val != null ? '$' + val.toFixed(2) : '--'}
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

  const mosDecimal = parseFloat(mos) / 100 || 0;
  const intrinsicValue = data?.intrinsic_value;
  const currentPrice = data?.current_price;
  const upside = intrinsicValue != null && currentPrice
    ? ((intrinsicValue - currentPrice) / currentPrice)
    : null;
  const fairValueMoS = intrinsicValue != null
    ? intrinsicValue * (1 - mosDecimal)
    : null;

  const summaryCards = data
    ? [
        {
          label: 'Intrinsic Value',
          value: intrinsicValue != null ? '$' + intrinsicValue.toFixed(2) : '--',
          color: '#e0e0e0',
        },
        {
          label: 'Current Price',
          value: currentPrice != null ? '$' + currentPrice.toFixed(2) : '--',
          color: '#ff8c00',
        },
        {
          label: 'Upside',
          value: upside != null ? (upside * 100).toFixed(1) + '%' : '--',
          color: upside != null ? (upside >= 0 ? '#00ff41' : '#ff4444') : '#e0e0e0',
        },
        {
          label: `Fair Value (${mos}% MoS)`,
          value: fairValueMoS != null ? '$' + fairValueMoS.toFixed(2) : '--',
          color: '#00cccc',
        },
      ]
    : [];

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>DCF VALUATION MODEL</span>
      </div>

      <div style={S.body}>
        {/* Inputs */}
        <div style={S.row}>
          <div style={S.fieldGroup}>
            <span style={S.label}>Ticker</span>
            <input style={S.input} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>Growth Rate %</span>
            <input style={S.input} value={growth} onChange={(e) => setGrowth(e.target.value)} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>Terminal Growth %</span>
            <input style={S.input} value={termGrowth} onChange={(e) => setTermGrowth(e.target.value)} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>WACC %</span>
            <input style={S.input} value={wacc} onChange={(e) => setWacc(e.target.value)} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>Years</span>
            <input style={S.input} value={years} onChange={(e) => setYears(e.target.value)} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>Margin of Safety %</span>
            <input style={S.input} value={mos} onChange={(e) => setMos(e.target.value)} />
          </div>
          <button style={S.btn} onClick={run} disabled={loading}>
            RUN DCF
          </button>
        </div>

        {loading && <div style={S.loadingTxt}>LOADING...</div>}
        {error && !loading && <div style={S.errorTxt}>{'\u26A0'} {error}</div>}

        {data && !loading && (
          <>
            {/* Summary cards */}
            <div style={S.metricsRow}>
              {summaryCards.map((c) => (
                <div key={c.label} style={S.metricCard}>
                  <div style={S.metricLabel}>{c.label}</div>
                  <div style={S.metricValue(c.color)}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* FCF Bar Chart */}
            {renderBarChart()}

            {/* Waterfall */}
            {renderWaterfall()}

            {/* Sensitivity */}
            {renderSensitivity()}
          </>
        )}
      </div>
    </div>
  );
}
