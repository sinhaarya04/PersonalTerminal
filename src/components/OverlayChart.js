import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchYFChart } from '../hooks/useYahooFinance';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';
import { getDefaultPeers } from '../data/peerMap';

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = ['#ff8c00', '#00cc00', '#4488ff', '#ff4444', '#ffcc00', '#cc44ff', '#00cccc', '#ff6688'];

const RANGES = [
  { label: '1M', days: 21 },
  { label: '3M', days: 63 },
  { label: '6M', days: 126 },
  { label: '1Y', days: 252 },
  { label: '2Y', days: 504 },
];

const MAX_TICKERS = 8;

// SVG coordinate space
const W = 1000;
const H = 400;
const PAD_LEFT  = 60;
const PAD_RIGHT = 16;
const PAD_TOP   = 20;
const PAD_BOT   = 36;
const CHART_W   = W - PAD_LEFT - PAD_RIGHT;
const CHART_H   = H - PAD_TOP - PAD_BOT;

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(bars, rangeDays) {
  if (!bars || bars.length === 0) return [];
  const sliced = bars.slice(-rangeDays);
  if (sliced.length === 0) return [];
  const base = sliced[0].c;
  if (!base) return [];
  return sliced.map(b => ({ ...b, norm: (b.c / base) * 100 }));
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.toLocaleString('en-US', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`;
}

function formatFullDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  container: {
    background: '#000000',
    fontFamily: "'Consolas','Courier New',monospace",
  },
  header: {
    background: '#0d0d1a',
    borderBottom: '1px solid #333333',
    padding: '4px 8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  headerSub: {
    color: '#888888',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
  },
  toolbar: {
    background: '#0d0d1a',
    borderBottom: '1px solid #333333',
    padding: '5px 8px',
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  toolBtn: (active) => ({
    background: active ? '#ff8c00' : '#0d0d1a',
    color: active ? '#000000' : '#b0b0b0',
    border: `1px solid ${active ? '#ff8c00' : '#333333'}`,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    padding: '1px 8px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  }),
  input: {
    background: '#000000',
    color: '#ffffff',
    border: '1px solid #444444',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    padding: '1px 6px',
    width: '72px',
    textTransform: 'uppercase',
    outline: 'none',
  },
  chip: (color) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: '#0d0d1a',
    border: `1px solid ${color}`,
    borderRadius: '2px',
    padding: '1px 6px',
    fontSize: '11px',
    fontFamily: "'Consolas','Courier New',monospace",
    color: color,
  }),
  chipRemove: {
    background: 'none',
    border: 'none',
    color: '#888888',
    cursor: 'pointer',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    padding: '0 0 0 2px',
    lineHeight: 1,
  },
  divider: {
    width: '1px',
    height: '16px',
    background: '#333333',
    margin: '0 4px',
  },
  loading: {
    padding: '40px',
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textAlign: 'center',
  },
  noData: {
    padding: '40px',
    color: '#555555',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textAlign: 'center',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function OverlayChart({ defaultTicker = 'SPY' }) {
  const [tickers, setTickers]   = useState([defaultTicker]);
  const [allBars, setAllBars]   = useState({});
  const [range, setRange]       = useState('6M');
  const [inputVal, setInputVal] = useState('');
  const [hoverIdx, setHoverIdx] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState({});

  const svgRef = useRef(null);
  const { register, unregister } = useExport();

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchTicker = useCallback(async (sym) => {
    try {
      const data = await fetchYFChart(sym, '2y', '1d');
      if (data?.bars?.length > 0) {
        setAllBars(prev => ({ ...prev, [sym]: data.bars }));
        setErrors(prev => { const n = { ...prev }; delete n[sym]; return n; });
      } else {
        setErrors(prev => ({ ...prev, [sym]: 'NO DATA' }));
      }
    } catch (e) {
      setErrors(prev => ({ ...prev, [sym]: e.message || 'FETCH ERROR' }));
    }
  }, []);

  // On mount / when defaultTicker changes: reset to defaultTicker + peers
  useEffect(() => {
    const peers = getDefaultPeers(defaultTicker).slice(0, MAX_TICKERS - 1);
    const initial = [defaultTicker, ...peers].slice(0, MAX_TICKERS);
    setTickers(initial);
    setAllBars({});
    setErrors({});
    setLoading(true);
    Promise.all(initial.map(sym => fetchTicker(sym))).finally(() => setLoading(false));
  }, [defaultTicker, fetchTicker]);

  // ── Add ticker ──────────────────────────────────────────────────────────────

  const addTicker = useCallback(async () => {
    const sym = inputVal.trim().toUpperCase();
    if (!sym || tickers.includes(sym) || tickers.length >= MAX_TICKERS) return;
    setInputVal('');
    setTickers(prev => [...prev, sym]);
    await fetchTicker(sym);
  }, [inputVal, tickers, fetchTicker]);

  const handleInputKey = useCallback((e) => {
    if (e.key === 'Enter') addTicker();
  }, [addTicker]);

  // ── Remove ticker ───────────────────────────────────────────────────────────

  const removeTicker = useCallback((sym) => {
    if (sym === defaultTicker) return; // can't remove default
    setTickers(prev => prev.filter(t => t !== sym));
  }, [defaultTicker]);

  // ── Normalized series (memoized per range) ──────────────────────────────────

  const rangeDays = useMemo(
    () => RANGES.find(r => r.label === range)?.days ?? 126,
    [range]
  );

  const normalizedSeries = useMemo(() => {
    const result = {};
    for (const sym of tickers) {
      const bars = allBars[sym];
      if (bars?.length) {
        result[sym] = normalize(bars, rangeDays);
      }
    }
    return result;
  }, [tickers, allBars, rangeDays]);

  // ── Chart scale ─────────────────────────────────────────────────────────────

  const { minVal, maxVal } = useMemo(() => {
    const all = [];
    for (const series of Object.values(normalizedSeries)) {
      for (const pt of series) {
        if (pt.norm != null) all.push(pt.norm);
      }
    }
    if (all.length === 0) return { minVal: 90, maxVal: 110 };
    const mn = Math.min(...all);
    const mx = Math.max(...all);
    const pad = (mx - mn) * 0.05 || 2;
    return { minVal: mn - pad, maxVal: mx + pad };
  }, [normalizedSeries]);

  const valRange = maxVal - minVal || 1;

  const xOf = useCallback(
    (i, len) => PAD_LEFT + (len <= 1 ? 0 : (i / (len - 1)) * CHART_W),
    []
  );

  const yOf = useCallback(
    (v) => PAD_TOP + CHART_H - ((v - minVal) / valRange) * CHART_H,
    [minVal, valRange]
  );

  // ── Reference series for x-axis dates (longest normalized series) ───────────

  const refSeries = useMemo(() => {
    let best = null;
    for (const sym of tickers) {
      const s = normalizedSeries[sym];
      if (s && (!best || s.length > best.length)) best = s;
    }
    return best || [];
  }, [tickers, normalizedSeries]);

  // ── Hover handling ──────────────────────────────────────────────────────────

  const eventToIdx = useCallback((e) => {
    if (!svgRef.current || !refSeries.length) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    if (mouseX < PAD_LEFT || mouseX > W - PAD_RIGHT) return null;
    const frac = (mouseX - PAD_LEFT) / CHART_W;
    return Math.max(0, Math.min(refSeries.length - 1, Math.round(frac * (refSeries.length - 1))));
  }, [refSeries]);

  const handleMouseMove = useCallback((e) => {
    setHoverIdx(eventToIdx(e));
  }, [eventToIdx]);

  const handleMouseLeave = useCallback(() => {
    setHoverIdx(null);
  }, []);

  // ── Y-axis ticks ────────────────────────────────────────────────────────────

  const yTicks = useMemo(() => {
    const count = 5;
    return Array.from({ length: count }, (_, i) => {
      const v = minVal + (i / (count - 1)) * valRange;
      return { v, y: yOf(v) };
    });
  }, [minVal, valRange, yOf]);

  // ── X-axis date labels ───────────────────────────────────────────────────────

  const xLabels = useMemo(() => {
    if (!refSeries.length) return [];
    const step = Math.max(1, Math.floor(refSeries.length / 7));
    const labels = [];
    for (let i = 0; i < refSeries.length; i += step) {
      labels.push({ i, ts: refSeries[i].t });
    }
    return labels;
  }, [refSeries]);

  // ── Export registration ─────────────────────────────────────────────────────

  useEffect(() => {
    if (Object.keys(normalizedSeries).length > 0) {
      register('OVERLAY_CHART', 'Overlay Chart', () => {
        const date = new Date().toISOString().split('T')[0];
        const syms = tickers.filter(sym => normalizedSeries[sym]?.length > 0);
        if (!syms.length) return;

        // Build rows: date + one column per ticker
        const maxLen = Math.max(...syms.map(sym => normalizedSeries[sym].length));
        const rows = [];
        for (let i = 0; i < maxLen; i++) {
          const row = {};
          // Use ref series timestamp for date
          const refPt = normalizedSeries[syms[0]]?.[i];
          row['date'] = refPt ? formatFullDate(refPt.t) : '';
          for (const sym of syms) {
            const pt = normalizedSeries[sym]?.[i];
            row[sym] = pt?.norm != null ? pt.norm.toFixed(2) : '';
          }
          rows.push(row);
        }
        const headers = ['date', ...syms];
        exportCSV(rows, `overlay_chart_${defaultTicker}_${date}.csv`, headers);
      });
    } else {
      unregister('OVERLAY_CHART');
    }
    return () => unregister('OVERLAY_CHART');
  }, [normalizedSeries, tickers, defaultTicker, register, unregister]);

  // ── Render helpers ──────────────────────────────────────────────────────────

  const hoverX = hoverIdx != null && refSeries.length > 0
    ? xOf(hoverIdx, refSeries.length)
    : null;

  // For each ticker at hover index: find closest point
  const hoverValues = useMemo(() => {
    if (hoverIdx == null) return {};
    const out = {};
    for (const sym of tickers) {
      const series = normalizedSeries[sym];
      if (!series?.length) continue;
      // Map hoverIdx (relative to refSeries) to this series' index
      const frac = refSeries.length > 1 ? hoverIdx / (refSeries.length - 1) : 0;
      const idx = Math.round(frac * (series.length - 1));
      out[sym] = series[Math.max(0, Math.min(series.length - 1, idx))];
    }
    return out;
  }, [hoverIdx, tickers, normalizedSeries, refSeries]);

  // ── Loading state ────────────────────────────────────────────────────────────

  if (loading && Object.keys(allBars).length === 0) {
    return (
      <div style={S.container}>
        <div style={S.header}>
          <span style={S.headerTitle}>MULTI-TICKER OVERLAY</span>
        </div>
        <div style={S.loading}>LOADING {tickers.join(', ')}...</div>
      </div>
    );
  }

  const hasData = Object.keys(normalizedSeries).length > 0;

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.headerTitle}>MULTI-TICKER OVERLAY — NORMALIZED PERFORMANCE</span>
        <span style={S.headerSub}>
          {loading ? 'UPDATING...' : `${tickers.length} TICKERS · BASE = 100`}
        </span>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        {/* Ticker chips */}
        {tickers.map((sym, i) => {
          const color = COLORS[i % COLORS.length];
          const isDefault = sym === defaultTicker;
          return (
            <span key={sym} style={S.chip(color)}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', background: color, marginRight: '3px' }} />
              {sym}
              {errors[sym] && <span style={{ color: '#ff4444', fontSize: '9px', marginLeft: '3px' }}>!</span>}
              {!isDefault && (
                <button
                  style={S.chipRemove}
                  onClick={() => removeTicker(sym)}
                  title={`Remove ${sym}`}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}

        {/* Add ticker input */}
        {tickers.length < MAX_TICKERS && (
          <>
            <div style={S.divider} />
            <input
              style={S.input}
              value={inputVal}
              onChange={e => setInputVal(e.target.value.toUpperCase())}
              onKeyDown={handleInputKey}
              placeholder="TICKER"
              maxLength={10}
            />
            <button style={S.toolBtn(false)} onClick={addTicker}>GO</button>
          </>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Range buttons */}
        {RANGES.map(r => (
          <button
            key={r.label}
            style={S.toolBtn(range === r.label)}
            onClick={() => setRange(r.label)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {!hasData ? (
        <div style={S.noData}>NO CHART DATA AVAILABLE</div>
      ) : (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', display: 'block', cursor: 'crosshair', userSelect: 'none' }}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Background */}
          <rect x={0} y={0} width={W} height={H} fill="#000000" />
          <rect x={PAD_LEFT} y={PAD_TOP} width={CHART_W} height={CHART_H} fill="#020208" />

          {/* Horizontal grid lines + Y-axis labels */}
          {yTicks.map(({ v, y }, i) => (
            <g key={i}>
              <line
                x1={PAD_LEFT} y1={y.toFixed(1)}
                x2={W - PAD_RIGHT} y2={y.toFixed(1)}
                stroke="#1a1a2e" strokeWidth="0.8"
              />
              <text
                x={(PAD_LEFT - 4).toFixed(1)} y={y.toFixed(1)}
                fill="#555555" fontSize="9" textAnchor="end" dominantBaseline="middle"
                fontFamily="Consolas,monospace"
              >
                {v.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Baseline reference line at 100 */}
          {(() => {
            const baseY = yOf(100);
            if (baseY >= PAD_TOP && baseY <= PAD_TOP + CHART_H) {
              return (
                <line
                  x1={PAD_LEFT} y1={baseY.toFixed(1)}
                  x2={W - PAD_RIGHT} y2={baseY.toFixed(1)}
                  stroke="#444444" strokeWidth="1" strokeDasharray="4,3" opacity="0.8"
                />
              );
            }
            return null;
          })()}

          {/* Y-axis border */}
          <line
            x1={PAD_LEFT} y1={PAD_TOP}
            x2={PAD_LEFT} y2={PAD_TOP + CHART_H}
            stroke="#333333" strokeWidth="1"
          />

          {/* Polylines for each ticker */}
          {tickers.map((sym, tickerIdx) => {
            const series = normalizedSeries[sym];
            if (!series?.length) return null;
            const color = COLORS[tickerIdx % COLORS.length];
            const pts = series
              .map((pt, i) => `${xOf(i, series.length).toFixed(1)},${yOf(pt.norm).toFixed(1)}`)
              .join(' ');
            return (
              <polyline
                key={sym}
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth="1.6"
                strokeLinejoin="round"
                opacity="0.9"
              />
            );
          })}

          {/* Crosshair vertical line */}
          {hoverX != null && (
            <line
              x1={hoverX.toFixed(1)} y1={PAD_TOP}
              x2={hoverX.toFixed(1)} y2={PAD_TOP + CHART_H}
              stroke="#ff8c00" strokeWidth="0.7" strokeDasharray="3,3" opacity="0.7"
            />
          )}

          {/* Colored dots on each series at hover index */}
          {hoverX != null && tickers.map((sym, tickerIdx) => {
            const pt = hoverValues[sym];
            if (!pt?.norm) return null;
            const color = COLORS[tickerIdx % COLORS.length];
            const dotY = yOf(pt.norm);
            return (
              <g key={sym}>
                <circle cx={hoverX.toFixed(1)} cy={dotY.toFixed(1)} r="5" fill={color} opacity="0.9" />
                <circle cx={hoverX.toFixed(1)} cy={dotY.toFixed(1)} r="2.5" fill="#000000" />
              </g>
            );
          })}

          {/* Hover tooltip bar */}
          {hoverX != null && Object.keys(hoverValues).length > 0 && (() => {
            const sym0 = tickers.find(sym => hoverValues[sym]?.t);
            const ts = sym0 ? hoverValues[sym0].t : null;
            const lineH = 14;
            const symCount = tickers.filter(sym => hoverValues[sym]?.norm).length;
            const boxH = 14 + symCount * lineH + 6;
            const boxW = 140;
            // Position tooltip: left or right of crosshair
            const flip = hoverX > W * 0.65;
            const boxX = flip ? hoverX - boxW - 8 : hoverX + 8;
            const boxY = PAD_TOP + 10;

            return (
              <g>
                <rect
                  x={boxX} y={boxY}
                  width={boxW} height={boxH}
                  fill="#0d0d1a" stroke="#444444" strokeWidth="0.8" rx="2"
                />
                {ts && (
                  <text
                    x={boxX + 6} y={boxY + 10}
                    fill="#ffcc00" fontSize="9"
                    fontFamily="Consolas,monospace"
                  >
                    {formatFullDate(ts)}
                  </text>
                )}
                {tickers.map((sym, tickerIdx) => {
                  const pt = hoverValues[sym];
                  if (!pt?.norm) return null;
                  const color = COLORS[tickerIdx % COLORS.length];
                  const lineY = boxY + 20 + tickerIdx * lineH;
                  return (
                    <g key={sym}>
                      <rect x={boxX + 6} y={lineY - 4} width={6} height={6} fill={color} />
                      <text
                        x={boxX + 16} y={lineY}
                        fill={color} fontSize="9"
                        fontFamily="Consolas,monospace"
                        dominantBaseline="middle"
                      >
                        {sym}: {pt.norm.toFixed(1)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* X-axis date labels */}
          {xLabels.map(({ i, ts }) => (
            <text
              key={i}
              x={xOf(i, refSeries.length).toFixed(1)}
              y={(PAD_TOP + CHART_H + 14).toFixed(1)}
              fill="#555555" fontSize="9" textAnchor="middle"
              fontFamily="Consolas,monospace"
            >
              {formatDate(ts)}
            </text>
          ))}

          {/* Legend in bottom-right of chart area */}
          {(() => {
            const legendX = W - PAD_RIGHT - 10;
            const legendY = PAD_TOP + 8;
            const itemH = 14;
            return tickers.map((sym, tickerIdx) => {
              const color = COLORS[tickerIdx % COLORS.length];
              const ly = legendY + tickerIdx * itemH;
              return (
                <g key={sym}>
                  <line
                    x1={legendX - 60} y1={ly}
                    x2={legendX - 46} y2={ly}
                    stroke={color} strokeWidth="2"
                  />
                  <text
                    x={legendX - 42} y={ly}
                    fill={color} fontSize="9"
                    fontFamily="Consolas,monospace"
                    dominantBaseline="middle"
                  >
                    {sym}
                  </text>
                </g>
              );
            });
          })()}

          {/* Invisible overlay for mouse events */}
          <rect
            x={PAD_LEFT} y={PAD_TOP}
            width={CHART_W} height={CHART_H}
            fill="transparent"
          />
        </svg>
      )}

      {/* Bottom hint bar */}
      <div style={{
        padding: '2px 8px',
        background: '#050505',
        borderTop: '1px solid #111111',
        color: '#333333',
        fontFamily: "'Consolas','Courier New',monospace",
        fontSize: '10px',
        display: 'flex',
        gap: '12px',
      }}>
        <span>NORMALIZED TO 100 AT START OF RANGE</span>
        <span style={{ marginLeft: 'auto' }}>
          {tickers.length < MAX_TICKERS ? `ADD UP TO ${MAX_TICKERS - tickers.length} MORE TICKER${MAX_TICKERS - tickers.length !== 1 ? 'S' : ''}` : 'MAX TICKERS REACHED'}
        </span>
      </div>
    </div>
  );
}
