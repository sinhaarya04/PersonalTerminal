import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getDefaultPeers } from '../data/peerMap';
import { fetchYFChart } from '../hooks/useYahooFinance';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

// ── Math helpers ──────────────────────────────────────────────────────────────

function barsToReturns(bars) {
  const out = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].c;
    const curr = bars[i].c;
    if (prev > 0 && curr > 0) {
      out.push({ t: bars[i].t, r: Math.log(curr / prev) });
    }
  }
  return out;
}

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  let sumA = 0, sumB = 0, sumAA = 0, sumBB = 0, sumAB = 0;
  for (let i = 0; i < n; i++) {
    sumA  += a[i];
    sumB  += b[i];
    sumAA += a[i] * a[i];
    sumBB += b[i] * b[i];
    sumAB += a[i] * b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  const num   = sumAB - n * meanA * meanB;
  const denA  = Math.sqrt(Math.max(0, sumAA - n * meanA * meanA));
  const denB  = Math.sqrt(Math.max(0, sumBB - n * meanB * meanB));
  if (denA === 0 || denB === 0) return null;
  return Math.max(-1, Math.min(1, num / (denA * denB)));
}

function rollingCorrelation(returnsA, returnsB, window) {
  // align by timestamp — find common dates
  const mapB = new Map(returnsB.map(r => [r.t, r.r]));
  const aligned = returnsA
    .map(r => ({ t: r.t, a: r.r, b: mapB.get(r.t) }))
    .filter(r => r.b !== undefined);

  return aligned.map((_, i) => {
    if (i < window - 1) return { t: aligned[i].t, v: null };
    const slice = aligned.slice(i - window + 1, i + 1);
    const aVals = slice.map(s => s.a);
    const bVals = slice.map(s => s.b);
    return { t: aligned[i].t, v: pearson(aVals, bVals) };
  });
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function corrToColor(v) {
  if (v == null) return '#1a1a2e';
  if (v >= 0) {
    // 0 → neutral (#1a1a2e), +1 → green (#004d00)
    const t = v;
    const r = Math.round(26  * (1 - t));
    const g = Math.round(26  + (77  - 26)  * t);
    const b = Math.round(46  * (1 - t));
    return `rgb(${r},${g},${b})`;
  } else {
    // 0 → neutral (#1a1a2e), -1 → red (#4d0000)
    const t = -v;
    const r = Math.round(26  + (77  - 26) * t);
    const g = Math.round(26  * (1 - t));
    const b = Math.round(46  * (1 - t));
    return `rgb(${r},${g},${b})`;
  }
}

function corrToTextColor(v) {
  if (v == null) return '#888888';
  if (Math.abs(v) > 0.5) return '#ffffff';
  return '#cccccc';
}

// ── Style constants ───────────────────────────────────────────────────────────

const MONO = "'Consolas','Courier New',monospace";

const S = {
  container: { background: '#000000' },
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
    fontFamily: MONO,
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  headerSub: {
    color: '#888888',
    fontFamily: MONO,
    fontSize: '11px',
  },
  toolbar: {
    background: '#1a1a2e',
    borderBottom: '1px solid #333333',
    padding: '4px 8px',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  toolGroup: {
    display: 'flex',
    gap: '2px',
    alignItems: 'center',
  },
  toolLabel: {
    color: '#888888',
    fontFamily: MONO,
    fontSize: '11px',
    marginRight: '4px',
    textTransform: 'uppercase',
  },
  toolBtn: (active) => ({
    background: active ? '#ff8c00' : '#0d0d1a',
    color: active ? '#000000' : '#b0b0b0',
    border: `1px solid ${active ? '#ff8c00' : '#333333'}`,
    fontFamily: MONO,
    fontSize: '11px',
    padding: '1px 8px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  }),
  matrixWrapper: {
    padding: '12px',
    overflowX: 'auto',
  },
  table: {
    borderCollapse: 'collapse',
    fontFamily: MONO,
  },
  cornerTh: {
    background: '#0d0d1a',
    border: '1px solid #333333',
    padding: '4px 10px',
    width: '80px',
  },
  rowLabelTh: {
    background: '#0d0d1a',
    color: '#ffcc00',
    fontFamily: MONO,
    fontSize: '12px',
    padding: '6px 10px',
    border: '1px solid #333333',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    fontWeight: 'bold',
  },
  colLabelTh: {
    background: '#0d0d1a',
    color: '#ffcc00',
    fontFamily: MONO,
    fontSize: '12px',
    padding: '6px 10px',
    border: '1px solid #333333',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    fontWeight: 'bold',
    minWidth: '72px',
  },
  cell: (v, isDiag, isSelected) => ({
    background: isDiag
      ? '#2a2a3e'
      : isSelected
      ? '#0d3050'
      : corrToColor(v),
    color: isDiag ? '#888888' : corrToTextColor(v),
    fontFamily: MONO,
    fontSize: '12px',
    textAlign: 'center',
    padding: '6px 10px',
    border: isSelected ? '2px solid #ff8c00' : '1px solid #2a2a3e',
    cursor: isDiag ? 'default' : 'pointer',
    fontWeight: isDiag ? 'normal' : 'bold',
    userSelect: 'none',
    transition: 'background 0.15s',
    minWidth: '72px',
  }),
  loading: {
    padding: '40px',
    color: '#ff8c00',
    fontFamily: MONO,
    fontSize: '12px',
    textAlign: 'center',
  },
  error: {
    padding: '20px',
    color: '#ff4444',
    fontFamily: MONO,
    fontSize: '12px',
    textAlign: 'center',
  },
  chartSection: {
    borderTop: '1px solid #333333',
    padding: '0',
  },
  chartHeader: {
    background: '#0d0d1a',
    borderBottom: '1px solid #333333',
    padding: '4px 8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartTitle: {
    color: '#ff8c00',
    fontFamily: MONO,
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  chartToolbar: {
    background: '#1a1a2e',
    borderBottom: '1px solid #333333',
    padding: '3px 8px',
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  svgWrapper: {
    padding: '8px',
    background: '#000000',
  },
  legendRow: {
    display: 'flex',
    gap: '16px',
    padding: '4px 12px 8px',
    alignItems: 'center',
  },
  legendItem: (color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: '#888888',
    fontFamily: MONO,
    fontSize: '10px',
  }),
  legendSwatch: (color) => ({
    width: '16px',
    height: '3px',
    background: color,
    display: 'inline-block',
  }),
};

// ── Range / window constants ──────────────────────────────────────────────────

const RANGES = [
  { label: '3M', days: 63 },
  { label: '6M', days: 126 },
  { label: '1Y', days: 252 },
];

const WINDOWS = [
  { label: '20D', days: 20 },
  { label: '30D', days: 30 },
  { label: '60D', days: 60 },
];

// ── Rolling correlation SVG chart ─────────────────────────────────────────────

function RollingChart({ rollingData, tickerA, tickerB, window: winDays }) {
  if (!rollingData || rollingData.length === 0) {
    return (
      <div style={{ padding: '20px', color: '#555555', fontFamily: MONO, fontSize: '12px', textAlign: 'center' }}>
        INSUFFICIENT DATA FOR ROLLING CHART
      </div>
    );
  }

  const valid = rollingData.filter(d => d.v !== null);
  if (valid.length < 2) {
    return (
      <div style={{ padding: '20px', color: '#555555', fontFamily: MONO, fontSize: '12px', textAlign: 'center' }}>
        NOT ENOUGH OVERLAPPING DATES
      </div>
    );
  }

  const W = 1000, H = 150;
  const padL = 38, padR = 10, padT = 12, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  // map corr value (-1..+1) to Y pixel
  const yScale = (v) => padT + ((1 - v) / 2) * chartH;
  // map index to X pixel
  const xScale = (i) => padL + (i / (valid.length - 1)) * chartW;

  // build polyline segments colored by sign
  const segments = [];
  { // eslint-disable-line
    let segStart = 0;
    for (let i = 1; i <= valid.length; i++) {
      const sign = valid[i - 1]?.v >= 0 ? 1 : -1;
      const nextSign = valid[i]?.v >= 0 ? 1 : -1;
      if (i === valid.length || sign !== nextSign) {
        const start = segStart;
        const pts = valid.slice(start, i).map((d, j) => `${xScale(start + j)},${yScale(d.v)}`).join(' ');
        segments.push({ pts, color: sign >= 0 ? '#00cc44' : '#ff4444' });
        segStart = i - 1;
      }
    }
  }

  // X-axis date labels — pick ~5 evenly spaced
  const labelCount = Math.min(5, valid.length);
  const labelIndices = Array.from({ length: labelCount }, (_, i) =>
    Math.round((i / (labelCount - 1)) * (valid.length - 1))
  );
  const dateLabels = labelIndices.map(i => {
    const d = new Date(valid[i].t);
    return { x: xScale(i), label: `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}` };
  });

  // Y-axis reference lines: -1, -0.5, 0, +0.5, +1
  const refLines = [-1, -0.5, 0, 0.5, 1];

  return (
    <div style={S.svgWrapper}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* Reference lines */}
        {refLines.map(rv => {
          const y = yScale(rv);
          const isZero = rv === 0;
          return (
            <g key={rv}>
              <line
                x1={padL} y1={y} x2={W - padR} y2={y}
                stroke={isZero ? '#444444' : '#222222'}
                strokeWidth={isZero ? 1.5 : 0.5}
                strokeDasharray={isZero ? 'none' : '3,3'}
              />
              <text
                x={padL - 4} y={y + 4}
                fill="#666666"
                fontFamily={MONO}
                fontSize="9"
                textAnchor="end"
              >
                {rv > 0 ? `+${rv.toFixed(1)}` : rv.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Shaded area between 0-line and correlation line */}
        {valid.length > 1 && (() => {
          const zeroY = yScale(0);
          const firstX = xScale(0);
          const lastX = xScale(valid.length - 1);
          // positive fill
          const posPoints = [
            `${firstX},${zeroY}`,
            ...valid.map((d, i) => `${xScale(i)},${yScale(Math.max(0, d.v))}`),
            `${lastX},${zeroY}`,
          ].join(' ');
          // negative fill
          const negPoints = [
            `${firstX},${zeroY}`,
            ...valid.map((d, i) => `${xScale(i)},${yScale(Math.min(0, d.v))}`),
            `${lastX},${zeroY}`,
          ].join(' ');
          return (
            <>
              <polygon points={posPoints} fill="#00cc44" fillOpacity="0.08" />
              <polygon points={negPoints} fill="#ff4444" fillOpacity="0.08" />
            </>
          );
        })()}

        {/* Correlation line segments */}
        {segments.map((seg, i) => (
          <polyline
            key={i}
            points={seg.pts}
            fill="none"
            stroke={seg.color}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        ))}

        {/* X-axis date labels */}
        {dateLabels.map((dl, i) => (
          <text
            key={i}
            x={dl.x}
            y={H - padB + 12}
            fill="#555555"
            fontFamily={MONO}
            fontSize="8"
            textAnchor="middle"
          >
            {dl.label}
          </text>
        ))}

        {/* Axis border */}
        <rect
          x={padL} y={padT}
          width={chartW} height={chartH}
          fill="none"
          stroke="#333333"
          strokeWidth="0.5"
        />
      </svg>

      {/* Legend */}
      <div style={S.legendRow}>
        <span style={S.legendItem('#00cc44')}>
          <span style={S.legendSwatch('#00cc44')} />
          POSITIVE CORRELATION
        </span>
        <span style={S.legendItem('#ff4444')}>
          <span style={S.legendSwatch('#ff4444')} />
          NEGATIVE CORRELATION
        </span>
        <span style={{ ...S.legendItem('#888888'), marginLeft: 'auto' }}>
          {winDays}-DAY ROLLING WINDOW · {valid.length} DATA POINTS
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CorrelationMatrix({ ticker, allBars }) {
  const [peerData, setPeerData]           = useState({});
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [rangeDays, setRangeDays]         = useState(63);   // 3M default
  const [rollingWindow, setRollingWindow] = useState(20);   // 20D default
  const [selectedPair, setSelectedPair]   = useState(null); // { rowTicker, colTicker }

  const { register, unregister } = useExport();

  const activeTicker = ticker || 'SPY';
  const peers = useMemo(() => getDefaultPeers(activeTicker), [activeTicker]);
  const tickers = useMemo(() => [activeTicker, ...peers], [activeTicker, peers]);

  // ── Fetch peer bars ─────────────────────────────────────────────────────────
  const fetchPeers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = {};
    try {
      await Promise.all(
        peers.map(async (sym) => {
          try {
            const data = await fetchYFChart(sym, '2y', '1d');
            if (data?.bars?.length > 0) result[sym] = data.bars;
          } catch { /* skip failed peer */ }
        })
      );
      setPeerData(result);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [peers]);

  useEffect(() => { fetchPeers(); }, [fetchPeers]);

  // ── Clear pair selection when ticker/peers change ───────────────────────────
  useEffect(() => { setSelectedPair(null); }, [activeTicker]);

  // ── Build returns map ───────────────────────────────────────────────────────
  const returnsMap = useMemo(() => {
    const map = {};
    if (allBars?.length > 1) {
      map[activeTicker] = barsToReturns(allBars);
    }
    peers.forEach(sym => {
      const bars = peerData[sym];
      if (bars?.length > 1) map[sym] = barsToReturns(bars);
    });
    return map;
  }, [allBars, peerData, activeTicker, peers]);

  // ── Build correlation matrix values ─────────────────────────────────────────
  const corrMatrix = useMemo(() => {
    const matrix = {};
    tickers.forEach(rowTicker => {
      matrix[rowTicker] = {};
      const rA = returnsMap[rowTicker];
      tickers.forEach(colTicker => {
        if (rowTicker === colTicker) {
          matrix[rowTicker][colTicker] = 1;
          return;
        }
        const rB = returnsMap[colTicker];
        if (!rA || !rB || rA.length < 2 || rB.length < 2) {
          matrix[rowTicker][colTicker] = null;
          return;
        }
        // align by time, slice to last rangeDays
        const mapB = new Map(rB.map(r => [r.t, r.r]));
        const aligned = rA
          .filter(r => mapB.has(r.t))
          .slice(-rangeDays);
        const aVals = aligned.map(r => r.r);
        const bVals = aligned.map(r => mapB.get(r.t));
        matrix[rowTicker][colTicker] = pearson(aVals, bVals);
      });
    });
    return matrix;
  }, [returnsMap, tickers, rangeDays]);

  // ── Rolling correlation for selected pair ───────────────────────────────────
  const rollingData = useMemo(() => {
    if (!selectedPair) return null;
    const { rowTicker, colTicker } = selectedPair;
    const rA = returnsMap[rowTicker];
    const rB = returnsMap[colTicker];
    if (!rA || !rB) return null;
    return rollingCorrelation(rA, rB, rollingWindow);
  }, [selectedPair, returnsMap, rollingWindow]);

  // ── Export registration ──────────────────────────────────────────────────────
  useEffect(() => {
    const hasData = tickers.some(t => returnsMap[t]?.length > 0);
    if (hasData) {
      register('CORRELATION', 'Correlation Matrix', () => {
        const date = new Date().toISOString().split('T')[0];
        const headers = ['ticker', ...tickers];
        const rows = tickers.map(rowTicker => {
          const row = { ticker: rowTicker };
          tickers.forEach(colTicker => {
            const v = corrMatrix[rowTicker]?.[colTicker];
            row[colTicker] = v != null ? v.toFixed(2) : '';
          });
          return row;
        });
        exportCSV(rows, `${activeTicker}_correlation_${date}.csv`, headers);
      });
    } else {
      unregister('CORRELATION');
    }
    return () => unregister('CORRELATION');
  }, [corrMatrix, tickers, activeTicker, returnsMap, register, unregister]);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading && Object.keys(peerData).length === 0) {
    return (
      <div style={S.loading}>
        LOADING CORRELATION DATA FOR {activeTicker}...
      </div>
    );
  }

  const rangeLabel = RANGES.find(r => r.days === rangeDays)?.label || '3M';

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.headerTitle}>
          {activeTicker} — KPI CORRELATION MATRIX
        </span>
        <span style={S.headerSub}>
          {loading
            ? 'UPDATING...'
            : `${tickers.length} TICKERS · ${rangeLabel} WINDOW · YAHOO FINANCE`}
          {error && (
            <span style={{ color: '#ff4444', marginLeft: '8px' }}>
              WARN: {error}
            </span>
          )}
        </span>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={S.toolGroup}>
          <span style={S.toolLabel}>RANGE:</span>
          {RANGES.map(r => (
            <button
              key={r.label}
              style={S.toolBtn(rangeDays === r.days)}
              onClick={() => setRangeDays(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
        {selectedPair && (
          <div style={S.toolGroup}>
            <span style={S.toolLabel}>ROLLING WINDOW:</span>
            {WINDOWS.map(w => (
              <button
                key={w.label}
                style={S.toolBtn(rollingWindow === w.days)}
                onClick={() => setRollingWindow(w.days)}
              >
                {w.label}
              </button>
            ))}
          </div>
        )}
        {selectedPair && (
          <button
            style={{ ...S.toolBtn(false), marginLeft: 'auto', color: '#ff4444', borderColor: '#ff4444' }}
            onClick={() => setSelectedPair(null)}
          >
            CLEAR SELECTION
          </button>
        )}
      </div>

      {/* Matrix Table */}
      <div style={S.matrixWrapper}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.cornerTh} />
              {tickers.map(colTicker => (
                <th key={colTicker} style={S.colLabelTh}>
                  {colTicker}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map(rowTicker => (
              <tr key={rowTicker}>
                <th style={S.rowLabelTh}>{rowTicker}</th>
                {tickers.map(colTicker => {
                  const isDiag = rowTicker === colTicker;
                  const v = corrMatrix[rowTicker]?.[colTicker];
                  const isSelected =
                    selectedPair &&
                    ((selectedPair.rowTicker === rowTicker && selectedPair.colTicker === colTicker) ||
                      (selectedPair.rowTicker === colTicker && selectedPair.colTicker === rowTicker));
                  return (
                    <td
                      key={colTicker}
                      style={S.cell(v, isDiag, isSelected)}
                      onClick={() => {
                        if (isDiag) return;
                        setSelectedPair(
                          isSelected
                            ? null
                            : { rowTicker, colTicker }
                        );
                      }}
                      title={
                        isDiag
                          ? `${rowTicker} vs itself`
                          : `${rowTicker} vs ${colTicker}: click to view rolling correlation`
                      }
                    >
                      {isDiag
                        ? '1.00'
                        : v != null
                        ? v.toFixed(2)
                        : '--'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Color scale legend */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '10px',
          fontFamily: MONO,
          fontSize: '10px',
          color: '#666666',
        }}>
          <span>-1.00</span>
          <div style={{
            width: '160px',
            height: '8px',
            background: 'linear-gradient(to right, #4d0000, #1a1a2e, #004d00)',
            border: '1px solid #333333',
          }} />
          <span>+1.00</span>
          <span style={{ marginLeft: '12px', color: '#555555' }}>
            CLICK A CELL TO VIEW ROLLING CORRELATION CHART
          </span>
        </div>
      </div>

      {/* Rolling Correlation Chart */}
      {selectedPair && (
        <div style={S.chartSection}>
          <div style={S.chartHeader}>
            <span style={S.chartTitle}>
              ROLLING {rollingWindow}-DAY CORRELATION:
              {' '}{selectedPair.rowTicker} vs {selectedPair.colTicker}
            </span>
            <span style={{ color: '#888888', fontFamily: MONO, fontSize: '11px' }}>
              {(() => {
                const v = corrMatrix[selectedPair.rowTicker]?.[selectedPair.colTicker];
                return v != null
                  ? `${rangeLabel} PEARSON: ${v >= 0 ? '+' : ''}${v.toFixed(4)}`
                  : '';
              })()}
            </span>
          </div>
          <div style={S.chartToolbar}>
            <span style={{ color: '#888888', fontFamily: MONO, fontSize: '11px', textTransform: 'uppercase' }}>
              WINDOW:
            </span>
            {WINDOWS.map(w => (
              <button
                key={w.label}
                style={S.toolBtn(rollingWindow === w.days)}
                onClick={() => setRollingWindow(w.days)}
              >
                {w.label}
              </button>
            ))}
          </div>
          <RollingChart
            rollingData={rollingData}
            tickerA={selectedPair.rowTicker}
            tickerB={selectedPair.colTicker}
            window={rollingWindow}
          />
        </div>
      )}

      {/* Empty state */}
      {tickers.every(t => !returnsMap[t]) && !loading && (
        <div style={S.error}>NO RETURN DATA AVAILABLE FOR CORRELATION ANALYSIS</div>
      )}
    </div>
  );
}
