import React, { useState, useEffect, useCallback } from 'react';
import {
  MACRO_SERIES,
  fetchMultipleSeries,
  fetchYieldCurve,
  formatMacroValue,
  computeChange,
} from '../hooks/useFred';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

// ── Styles ──────────────────────────────────────────────────────────────────
const S = {
  container: { background: '#000', minHeight: '600px' },
  header: {
    background: '#0d0d1a',
    borderBottom: '1px solid #333',
    padding: '6px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  statusWrap: { display: 'flex', alignItems: 'center', gap: '10px' },
  dot: (color) => ({
    display: 'inline-block', width: '6px', height: '6px',
    borderRadius: '50%', background: color, marginRight: '4px',
  }),
  statusTxt: (color) => ({
    color,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
  }),
  refreshBtn: {
    background: 'transparent',
    color: '#ff8c00',
    border: '1px solid #333',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 8px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  },
  sectionHeader: {
    background: '#0a0a1a',
    padding: '4px 12px',
    borderBottom: '1px solid #1a1a2e',
    borderTop: '1px solid #1a1a2e',
  },
  sectionLabel: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  row: (hover) => ({
    display: 'flex',
    alignItems: 'center',
    padding: '5px 12px',
    background: hover ? '#08101a' : '#000',
    borderBottom: '1px solid #0a0a0a',
    cursor: 'default',
    gap: '8px',
  }),
  label: {
    width: '160px',
    flexShrink: 0,
    color: '#b0b0b0',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textTransform: 'uppercase',
  },
  value: {
    width: '100px',
    textAlign: 'right',
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    fontWeight: 'bold',
  },
  change: (dir) => ({
    width: '90px',
    textAlign: 'right',
    color: dir > 0 ? '#00cc00' : dir < 0 ? '#ff4444' : '#888',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
  }),
  arrow: (dir) => ({
    width: '20px',
    textAlign: 'center',
    color: dir > 0 ? '#00cc00' : dir < 0 ? '#ff4444' : '#888',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
  }),
  sparkWrap: {
    flex: 1,
    minWidth: '80px',
    height: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  date: {
    width: '80px',
    textAlign: 'right',
    color: '#444',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
  },
  // Yield curve section
  ycSection: {
    padding: '12px',
    borderTop: '2px solid #1a1a2e',
  },
  ycTitle: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  ycBadge: (inverted) => ({
    background: inverted ? '#1a0000' : '#001a00',
    color: inverted ? '#ff4444' : '#00cc00',
    border: `1px solid ${inverted ? '#ff4444' : '#00cc00'}`,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 6px',
    letterSpacing: '0.5px',
  }),
  spreadRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '5px 12px',
    background: '#050510',
    borderBottom: '1px solid #0a0a0a',
    gap: '8px',
  },
  // No-key state
  noKey: {
    padding: '60px 20px',
    textAlign: 'center',
  },
  noKeyTitle: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '14px',
    letterSpacing: '1px',
    marginBottom: '12px',
  },
  noKeyDesc: {
    color: '#666',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    marginBottom: '20px',
  },
  noKeyLink: {
    color: '#ffcc00',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  keyInputWrap: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '16px',
  },
  keyInput: {
    background: '#000',
    color: '#ffcc00',
    border: '1px solid #ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    padding: '4px 10px',
    width: '300px',
    textTransform: 'uppercase',
    outline: 'none',
    letterSpacing: '1px',
  },
  keyBtn: {
    background: '#ff8c00',
    color: '#000',
    border: 'none',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    fontWeight: 'bold',
    padding: '4px 16px',
    cursor: 'pointer',
  },
};

// ── Sparkline SVG ───────────────────────────────────────────────────────────
function Sparkline({ observations, width = 80, height = 20 }) {
  if (!observations || observations.length < 2) return null;

  // observations are desc order from FRED, reverse for left-to-right chronological
  const pts = [...observations].reverse().slice(-24);
  const values = pts.map(o => o.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const isUp = values[values.length - 1] >= values[0];
  const color = isUp ? '#00cc00' : '#ff4444';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {(() => {
        const lastX = width;
        const lastY = height - 2 - ((values[values.length - 1] - min) / range) * (height - 4);
        return <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="1.5" fill={color} />;
      })()}
    </svg>
  );
}

// ── Yield Curve SVG ─────────────────────────────────────────────────────────
function YieldCurveChart({ points }) {
  if (!points || points.length < 3) return null;

  const W = 500, H = 160, PAD_L = 50, PAD_R = 20, PAD_T = 10, PAD_B = 30;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const yields = points.map(p => p.yield);
  const minY = Math.min(...yields) - 0.2;
  const maxY = Math.max(...yields) + 0.2;
  const yRange = maxY - minY || 1;

  const xOf = (i) => PAD_L + (i / (points.length - 1)) * chartW;
  const yOf = (v) => PAD_T + chartH - ((v - minY) / yRange) * chartH;

  const linePts = points.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.yield).toFixed(1)}`).join(' ');

  // Area fill
  const areaPath = [
    `M ${xOf(0).toFixed(1)},${(PAD_T + chartH).toFixed(1)}`,
    ...points.map((p, i) => `L ${xOf(i).toFixed(1)},${yOf(p.yield).toFixed(1)}`),
    `L ${xOf(points.length - 1).toFixed(1)},${(PAD_T + chartH).toFixed(1)}`,
    'Z',
  ].join(' ');

  // Y ticks
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => {
    const v = minY + (i / yTickCount) * yRange;
    return { v, y: yOf(v) };
  });

  // Check inversion (2Y > 10Y)
  const p2y = points.find(p => p.label === '2Y');
  const p10y = points.find(p => p.label === '10Y');
  const isInverted = p2y && p10y && p2y.yield > p10y.yield;
  const lineColor = isInverted ? '#ff4444' : '#00cc00';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: '600px', height: '180px' }}>
      <rect x={0} y={0} width={W} height={H} fill="#020208" />

      {/* Grid */}
      {yTicks.map(({ v, y }, i) => (
        <g key={i}>
          <line x1={PAD_L} y1={y.toFixed(1)} x2={W - PAD_R} y2={y.toFixed(1)}
            stroke="#1a1a2e" strokeWidth="0.5" />
          <text x={PAD_L - 4} y={y.toFixed(1)} fill="#555" fontSize="9"
            textAnchor="end" dominantBaseline="middle" fontFamily="Consolas,monospace">
            {v.toFixed(1)}%
          </text>
        </g>
      ))}

      {/* Area */}
      <path d={areaPath} fill={isInverted ? 'rgba(255,60,60,0.08)' : 'rgba(0,180,0,0.08)'} />

      {/* Line */}
      <polyline points={linePts} fill="none" stroke={lineColor}
        strokeWidth="2" strokeLinejoin="round" />

      {/* Dots + X labels */}
      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={xOf(i).toFixed(1)} cy={yOf(p.yield).toFixed(1)}
            r="3" fill={lineColor} />
          <text x={xOf(i).toFixed(1)} y={(H - 6).toFixed(1)}
            fill="#888" fontSize="8" textAnchor="middle" fontFamily="Consolas,monospace">
            {p.label}
          </text>
          {/* Value on hover */}
          <text x={xOf(i).toFixed(1)} y={(yOf(p.yield) - 8).toFixed(1)}
            fill="#b0b0b0" fontSize="8" textAnchor="middle" fontFamily="Consolas,monospace">
            {p.yield.toFixed(2)}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── Macro Row ───────────────────────────────────────────────────────────────
function MacroRow({ meta, observations }) {
  const [hover, setHover] = useState(false);

  const latest = observations?.[0];
  const latestValue = latest ? formatMacroValue(latest.value, meta) : '--';
  const { changeStr, direction } = computeChange(observations, meta);
  const arrow = direction > 0 ? '\u25B2' : direction < 0 ? '\u25BC' : '-';

  return (
    <div
      style={S.row(hover)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={S.label}>{meta.label}</span>
      <span style={S.value}>{latestValue}</span>
      <span style={S.change(direction)}>{changeStr || '--'}</span>
      <span style={S.arrow(direction)}>{arrow}</span>
      <span style={S.sparkWrap}>
        <Sparkline observations={observations} />
      </span>
      <span style={S.date}>{latest?.date || '--'}</span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function MacroDashboard({ fredKey, onSetFredKey }) {
  const [seriesData, setSeriesData] = useState({});
  const [yieldCurve, setYieldCurve] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [keyInput, setKeyInput] = useState('');
  const { register, unregister } = useExport();

  const load = useCallback(async (key) => {
    if (!key) return;
    setLoading(true);
    setError(null);

    try {
      const [series, curve] = await Promise.allSettled([
        fetchMultipleSeries(key),
        fetchYieldCurve(key),
      ]);

      if (series.status === 'fulfilled') {
        setSeriesData(series.value);
      } else {
        setError('Failed to fetch macro data — check API key');
      }

      if (curve.status === 'fulfilled') {
        setYieldCurve(curve.value);
      }
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (fredKey) load(fredKey);
  }, [fredKey, load]);

  useEffect(() => {
    const date = new Date().toISOString().split('T')[0];
    if (Object.keys(seriesData).length > 0) {
      register('MACRO_SERIES', 'FRED Macro Series', () => {
        const rows = [];
        MACRO_SERIES.forEach(m => {
          (seriesData[m.id] || []).forEach(obs => {
            rows.push({ series_id: m.id, series_label: m.label, category: m.category, date: obs.date, value: obs.value });
          });
        });
        exportCSV(rows, `fred_macro_${date}.csv`);
      });
    } else {
      unregister('MACRO_SERIES');
    }
    return () => unregister('MACRO_SERIES');
  }, [seriesData, register, unregister]);

  useEffect(() => {
    const date = new Date().toISOString().split('T')[0];
    if (yieldCurve.length > 0) {
      register('YIELD_CURVE', 'Yield Curve', () => {
        const rows = yieldCurve.map(p => ({
          maturity: p.label, months: p.months, yield_pct: p.yield, date: p.date,
        }));
        exportCSV(rows, `yield_curve_${date}.csv`);
      });
    } else {
      unregister('YIELD_CURVE');
    }
    return () => unregister('YIELD_CURVE');
  }, [yieldCurve, register, unregister]);

  const handleKeySubmit = () => {
    const k = keyInput.trim();
    if (k && onSetFredKey) {
      onSetFredKey(k);
    }
  };

  // No-key state
  if (!fredKey) {
    return (
      <div style={S.container}>
        <div style={S.header}>
          <span style={S.title}>MACRO ECONOMICS — FRED</span>
        </div>
        <div style={S.noKey}>
          <div style={S.noKeyTitle}>FRED API KEY REQUIRED</div>
          <div style={S.noKeyDesc}>
            GET A FREE KEY AT{' '}
            <span style={S.noKeyLink} onClick={() => window.open('https://fredaccount.stlouisfed.org/apikeys', '_blank')}>
              FREDACCOUNT.STLOUISFED.ORG
            </span>
          </div>
          <div style={S.noKeyDesc}>
            THE FEDERAL RESERVE ECONOMIC DATA API IS FREE AND PROVIDES ACCESS TO 800,000+ DATA SERIES
          </div>
          <div style={S.keyInputWrap}>
            <input
              style={S.keyInput}
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleKeySubmit()}
              placeholder="PASTE FRED API KEY..."
              spellCheck={false}
            />
            <button style={S.keyBtn} onClick={handleKeySubmit}>CONNECT</button>
          </div>
        </div>
      </div>
    );
  }

  // Group series by category
  const categories = [];
  const seen = new Set();
  MACRO_SERIES.forEach(m => {
    if (!seen.has(m.category)) {
      seen.add(m.category);
      categories.push(m.category);
    }
  });

  const statusColor = loading ? '#ff8c00' : error ? '#ff4444' : Object.keys(seriesData).length > 0 ? '#00cc00' : '#555';
  const statusLabel = loading ? 'FETCHING...' : error ? 'ERROR' : Object.keys(seriesData).length > 0 ? `LIVE · ${MACRO_SERIES.length} SERIES` : 'NO DATA';

  // Compute 10Y-2Y spread
  const dgs10 = seriesData['DGS10']?.[0]?.value;
  const dgs2 = seriesData['DGS2']?.[0]?.value;
  const spread = dgs10 != null && dgs2 != null ? dgs10 - dgs2 : null;
  const spreadInverted = spread != null && spread < 0;

  // Check yield curve inversion
  const p2y = yieldCurve.find(p => p.label === '2Y');
  const p10y = yieldCurve.find(p => p.label === '10Y');
  const curveInverted = p2y && p10y && p2y.yield > p10y.yield;

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>MACRO ECONOMICS — FRED</span>
        <div style={S.statusWrap}>
          <span>
            <span style={S.dot(statusColor)} />
            <span style={S.statusTxt(statusColor)}>{statusLabel}</span>
          </span>
          <button
            style={S.refreshBtn}
            onClick={() => load(fredKey)}
            disabled={loading}
          >
            {'\u21BB'} REFRESH
          </button>
        </div>
      </div>

      {loading && Object.keys(seriesData).length === 0 && (
        <div style={{ padding: '30px', color: '#ff8c00', fontFamily: "'Consolas','Courier New',monospace", fontSize: '12px', textAlign: 'center' }}>
          FETCHING {MACRO_SERIES.length} SERIES FROM FRED...
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 12px', color: '#ff4444', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px', background: '#0d0000', borderBottom: '1px solid #330000' }}>
          {'\u26A0'} {error}
        </div>
      )}

      {/* Series rows grouped by category */}
      {categories.map(cat => {
        const series = MACRO_SERIES.filter(m => m.category === cat);
        return (
          <React.Fragment key={cat}>
            <div style={S.sectionHeader}>
              <span style={S.sectionLabel}>{cat}</span>
            </div>
            {series.map(m => (
              <MacroRow key={m.id} meta={m} observations={seriesData[m.id] || []} />
            ))}
            {/* Insert spread row after rates section */}
            {cat === 'RATES & YIELDS' && spread != null && (
              <div style={S.spreadRow}>
                <span style={{ ...S.label, color: spreadInverted ? '#ff4444' : '#00cc00' }}>
                  10Y-2Y SPREAD
                </span>
                <span style={{ ...S.value, color: spreadInverted ? '#ff4444' : '#00cc00' }}>
                  {spread >= 0 ? '+' : ''}{spread.toFixed(2)}%
                </span>
                <span style={S.change(spreadInverted ? -1 : 1)}>
                  {spreadInverted ? 'INVERTED' : 'NORMAL'}
                </span>
                <span style={S.arrow(spreadInverted ? -1 : 1)}>
                  {spreadInverted ? '\u25BC' : '\u25B2'}
                </span>
                <span style={S.sparkWrap} />
                <span style={S.date} />
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Yield Curve */}
      {yieldCurve.length > 3 && (
        <div style={S.ycSection}>
          <div style={S.ycTitle}>
            US TREASURY YIELD CURVE
            <span style={S.ycBadge(curveInverted)}>
              {curveInverted ? '● INVERTED' : '● NORMAL'}
            </span>
            {yieldCurve[0]?.date && (
              <span style={{ color: '#444', fontSize: '10px' }}>
                AS OF {yieldCurve[0].date}
              </span>
            )}
          </div>
          <YieldCurveChart points={yieldCurve} />
        </div>
      )}

      {/* Footer */}
      {Object.keys(seriesData).length > 0 && (
        <div style={{
          padding: '6px 12px', color: '#222', fontFamily: "'Consolas','Courier New',monospace",
          fontSize: '10px', borderTop: '1px solid #0d0d0d', textAlign: 'right',
        }}>
          {MACRO_SERIES.length} SERIES · FEDERAL RESERVE BANK OF ST. LOUIS · FRED API
        </div>
      )}
    </div>
  );
}
