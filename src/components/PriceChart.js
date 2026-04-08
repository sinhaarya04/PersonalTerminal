import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { computeSMA, computeEMA, computeBollinger, computeRSI } from '../utils/indicators';
import Tooltip from './Tooltip';

const RANGES = [
  { label: '1M',  days: 21 },
  { label: '3M',  days: 63 },
  { label: '6M',  days: 126 },
  { label: '1Y',  days: 252 },
  { label: '2Y',  days: 504 },
];

const INDICATOR_DEFS = [
  { key: 'SMA20',  label: 'SMA20',  color: '#ffcc00', type: 'overlay' },
  { key: 'SMA50',  label: 'SMA50',  color: '#00cccc', type: 'overlay' },
  { key: 'EMA20',  label: 'EMA20',  color: '#ff8c00', type: 'overlay' },
  { key: 'BB',     label: 'BB',     color: '#aa66ff', type: 'overlay' },
  { key: 'RSI',    label: 'RSI',    color: '#ff8c00', type: 'sub' },
];

const INDICATOR_TOOLTIP_MAP = {
  SMA20: 'sma', SMA50: 'sma', EMA20: 'ema', BB: 'bollinger-bands', RSI: 'rsi',
};

// SVG coordinate space
const W = 1000;
const PRICE_TOP    = 20;
const PRICE_BOTTOM = 250;
const VOL_TOP      = 268;
const VOL_BOTTOM   = 320;
const RSI_TOP      = 338;
const RSI_BOTTOM   = 398;
const LEFT         = 72;
const RIGHT        = 16;
const CHART_W      = W - LEFT - RIGHT;

function formatPrice(v) {
  if (v >= 10000) return v.toFixed(0);
  if (v >= 1000)  return v.toFixed(1);
  return v.toFixed(2);
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.toLocaleString('en-US', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`;
}

function formatFullDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatVol(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return String(v);
}

// Build polyline points skipping nulls
function buildLine(values, xOf, yScale) {
  const segments = [];
  let current = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] != null) {
      current.push(`${xOf(i).toFixed(1)},${yScale(values[i]).toFixed(1)}`);
    } else if (current.length) {
      segments.push(current.join(' '));
      current = [];
    }
  }
  if (current.length) segments.push(current.join(' '));
  return segments;
}

export default function PriceChart({ bars, ticker, quote, events }) {
  const [range, setRange] = useState('1Y');
  const [chartMode, setChartMode] = useState('CANDLE');
  const [activeIndicators, setActiveIndicators] = useState([]);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [hoverEventIdx, setHoverEventIdx] = useState(null);
  const [zoomSlice, setZoomSlice] = useState(null);
  const [dragStartIdx, setDragStartIdx] = useState(null);
  const [dragCurrentIdx, setDragCurrentIdx] = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [drawMode, setDrawMode] = useState(null); // null | 'trendline' | 'hline' | 'fib'
  const [pendingDraw, setPendingDraw] = useState(null);
  const [selectedDrawing, setSelectedDrawing] = useState(null);
  const [mousePos, setMousePos] = useState(null); // SVG coords for rubber-band preview
  const svgRef = useRef(null);
  const isDragging = useRef(false);
  const priceInfoRef = useRef({ minPrice: 0, priceRange: 1 });

  const showRSI = activeIndicators.includes('RSI');
  const svgH = showRSI ? 420 : 340;

  const toggleIndicator = useCallback((key) => {
    setActiveIndicators(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }, []);

  // Bars sliced by the selected range button
  const rangedBars = useMemo(() => {
    if (!bars?.length) return [];
    const r = RANGES.find(r => r.label === range) || RANGES[3];
    return bars.slice(-r.days);
  }, [bars, range]);

  // Final visible bars: apply zoom if active
  const visible = useMemo(() => {
    if (!rangedBars.length) return [];
    if (zoomSlice) {
      const s = Math.max(0, zoomSlice.start);
      const e = Math.min(rangedBars.length, zoomSlice.end + 1);
      if (e - s >= 2) return rangedBars.slice(s, e);
    }
    return rangedBars;
  }, [rangedBars, zoomSlice]);

  // Technical indicators computed on visible bars
  const sma20 = useMemo(() => activeIndicators.includes('SMA20') ? computeSMA(visible, 20) : [], [visible, activeIndicators]);
  const sma50 = useMemo(() => activeIndicators.includes('SMA50') ? computeSMA(visible, 50) : [], [visible, activeIndicators]);
  const ema20 = useMemo(() => activeIndicators.includes('EMA20') ? computeEMA(visible, 20) : [], [visible, activeIndicators]);
  const bb = useMemo(() => activeIndicators.includes('BB') ? computeBollinger(visible, 20, 2) : [], [visible, activeIndicators]);
  const rsi = useMemo(() => activeIndicators.includes('RSI') ? computeRSI(visible, 14) : [], [visible, activeIndicators]);

  // Convert mouse event to SVG coordinates
  const eventToSvg = useCallback((e) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * svgH,
    };
  }, [svgH]);

  // Delete selected drawing on Delete/Backspace
  useEffect(() => {
    const handler = (e) => {
      if (selectedDrawing != null && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        setDrawings(prev => prev.filter(d => d.id !== selectedDrawing));
        setSelectedDrawing(null);
      }
      if (e.key === 'Escape') {
        setDrawMode(null);
        setPendingDraw(null);
        setSelectedDrawing(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedDrawing]);

  // Convert mouse event to bar index
  const eventToIdx = useCallback((e) => {
    if (!svgRef.current || !visible.length) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    if (mouseX < LEFT || mouseX > W - RIGHT) return null;
    const frac = (mouseX - LEFT) / CHART_W;
    return Math.max(0, Math.min(visible.length - 1, Math.round(frac * (visible.length - 1))));
  }, [visible]);

  const eventToRangedIdx = useCallback((e) => {
    if (!svgRef.current || !rangedBars.length) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    if (mouseX < LEFT || mouseX > W - RIGHT) return null;
    const frac = (mouseX - LEFT) / CHART_W;
    const visIdx = Math.round(frac * (visible.length - 1));
    if (zoomSlice) return Math.max(0, Math.min(rangedBars.length - 1, zoomSlice.start + visIdx));
    return Math.max(0, Math.min(rangedBars.length - 1, visIdx));
  }, [rangedBars, visible, zoomSlice]);

  const handleMouseMove = useCallback((e) => {
    const idx = eventToIdx(e);
    setHoverIdx(idx);
    // Track SVG position for drawing rubber-band
    if (pendingDraw || drawMode) {
      const svg = eventToSvg(e);
      if (svg) setMousePos(svg);
    }
    if (isDragging.current && dragStartIdx != null) {
      const rIdx = eventToRangedIdx(e);
      if (rIdx != null) setDragCurrentIdx(rIdx);
    }
  }, [eventToIdx, eventToRangedIdx, eventToSvg, dragStartIdx, pendingDraw, drawMode]);

  const handleMouseLeave = useCallback(() => {
    setHoverIdx(null);
    setMousePos(null);
    if (isDragging.current) {
      isDragging.current = false;
      setDragStartIdx(null);
      setDragCurrentIdx(null);
    }
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const svg = eventToSvg(e);
    if (!svg || svg.x < LEFT || svg.x > W - RIGHT || svg.y < PRICE_TOP || svg.y > PRICE_BOTTOM) {
      // Click outside chart area — deselect drawing if any
      if (drawMode) return;
      if (selectedDrawing != null) { setSelectedDrawing(null); return; }
    }

    // Drawing mode active
    if (drawMode && visible.length > 0) {
      const idx = Math.round(Math.max(0, Math.min(visible.length - 1, (svg.x - LEFT) / CHART_W * (visible.length - 1))));
      const { minPrice: mp, priceRange: pr } = priceInfoRef.current;
      const price = mp + (PRICE_BOTTOM - svg.y) / (PRICE_BOTTOM - PRICE_TOP) * pr;
      const anchor = { t: visible[idx].t, price };

      if (drawMode === 'hline') {
        setDrawings(prev => [...prev, { id: Date.now(), type: 'hline', anchors: [anchor], color: '#ffcc00' }]);
        setDrawMode(null);
        return;
      }
      // trendline or fib — need two anchors
      if (!pendingDraw) {
        setPendingDraw({ type: drawMode, anchors: [anchor], color: drawMode === 'fib' ? '#00cccc' : '#ffcc00' });
        return;
      }
      // Second anchor — complete the drawing
      setDrawings(prev => [...prev, {
        id: Date.now(),
        type: pendingDraw.type,
        anchors: [...pendingDraw.anchors, anchor],
        color: pendingDraw.color,
      }]);
      setPendingDraw(null);
      setDrawMode(null);
      return;
    }

    // No draw mode — normal zoom drag
    const rIdx = eventToRangedIdx(e);
    if (rIdx == null) return;
    isDragging.current = true;
    setDragStartIdx(rIdx);
    setDragCurrentIdx(rIdx);
  }, [eventToSvg, eventToRangedIdx, drawMode, pendingDraw, visible, selectedDrawing]);

  const handleMouseUp = useCallback((e) => {
    if (!isDragging.current || dragStartIdx == null) return;
    isDragging.current = false;
    const endIdx = eventToRangedIdx(e);
    setDragStartIdx(null);
    setDragCurrentIdx(null);
    if (endIdx == null) return;
    const s = Math.min(dragStartIdx, endIdx);
    const en = Math.max(dragStartIdx, endIdx);
    if (en - s >= 2) setZoomSlice({ start: s, end: en });
  }, [dragStartIdx, eventToRangedIdx]);

  const handleDoubleClick = useCallback(() => {
    if (pendingDraw) { setPendingDraw(null); return; } // cancel pending drawing
    setZoomSlice(null);
  }, [pendingDraw]);
  const resetZoom = useCallback(() => setZoomSlice(null), []);
  const handleRangeChange = useCallback((label) => { setRange(label); setZoomSlice(null); }, []);

  // Map macro events to bar indices
  const visibleEventBars = useMemo(() => {
    if (!events?.length || !visible.length) return [];
    const startTs = visible[0].t;
    const endTs = visible[visible.length - 1].t;
    return events
      .filter(ev => ev.t >= startTs && ev.t <= endTs)
      .map(ev => {
        let bestIdx = 0, bestDist = Infinity;
        for (let i = 0; i < visible.length; i++) {
          const dist = Math.abs(visible[i].t - ev.t);
          if (dist < bestDist) { bestDist = dist; bestIdx = i; }
        }
        return { ...ev, barIdx: bestIdx };
      });
  }, [events, visible]);

  if (!visible.length) {
    return (
      <div style={{ padding: '20px', color: '#555', fontFamily: 'Consolas,monospace', fontSize: '12px' }}>
        NO CHART DATA
      </div>
    );
  }

  const closes = visible.map(b => b.c).filter(Boolean);
  const highs  = visible.map(b => b.h).filter(Boolean);
  const lows   = visible.map(b => b.l).filter(Boolean);

  const minPrice = Math.min(...lows)  * 0.998;
  const maxPrice = Math.max(...highs) * 1.002;
  const priceRange = maxPrice - minPrice || 1;
  const maxVol = Math.max(...visible.map(b => b.v || 0)) || 1;
  priceInfoRef.current = { minPrice, priceRange };

  const xOf = i => LEFT + (i / (visible.length - 1 || 1)) * CHART_W;
  const yOf = p => PRICE_BOTTOM - ((p - minPrice) / priceRange) * (PRICE_BOTTOM - PRICE_TOP);
  const yVol = v => VOL_BOTTOM - (v / maxVol) * (VOL_BOTTOM - VOL_TOP);
  const yRSI = v => RSI_BOTTOM - ((v / 100) * (RSI_BOTTOM - RSI_TOP));

  // Price line path (for LINE mode)
  const linePts = visible.map((b, i) => `${xOf(i).toFixed(1)},${yOf(b.c).toFixed(1)}`).join(' ');
  const areaPath = [
    `M ${xOf(0).toFixed(1)},${PRICE_BOTTOM}`,
    ...visible.map((b, i) => `L ${xOf(i).toFixed(1)},${yOf(b.c).toFixed(1)}`),
    `L ${xOf(visible.length - 1).toFixed(1)},${PRICE_BOTTOM}`,
    'Z',
  ].join(' ');

  const isUp = closes[closes.length - 1] >= closes[0];
  const lineColor = isUp ? '#00cc00' : '#ff4444';
  const areaColor = isUp ? 'rgba(0,180,0,0.08)' : 'rgba(255,60,60,0.08)';

  // Candlestick width
  const candleW = Math.max(1.5, Math.min(12, (CHART_W / visible.length) * 0.7));

  // Y-axis labels
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const price = minPrice + (i / 4) * priceRange;
    return { price, y: yOf(price) };
  });

  // X-axis labels
  const step = Math.max(1, Math.floor(visible.length / 7));
  const xLabels = [];
  for (let i = 0; i < visible.length; i += step) xLabels.push({ i, ts: visible[i].t });

  // Volume bar width
  const barW = Math.max(1, (CHART_W / visible.length) * 0.7);

  const pctChange = closes.length >= 2
    ? ((closes[closes.length - 1] - closes[0]) / closes[0] * 100).toFixed(2) : null;

  const hoverBar = hoverIdx != null ? visible[hoverIdx] : null;
  const hoverX = hoverIdx != null ? xOf(hoverIdx) : 0;
  const hoverY = hoverBar ? yOf(hoverBar.c) : 0;

  // Drag selection
  let selLeft = null, selRight = null;
  if (isDragging.current && dragStartIdx != null && dragCurrentIdx != null) {
    const s = Math.min(dragStartIdx, dragCurrentIdx);
    const en = Math.max(dragStartIdx, dragCurrentIdx);
    const mapToVisX = (rIdx) => {
      if (zoomSlice) return xOf(Math.max(0, Math.min(visible.length - 1, rIdx - zoomSlice.start)));
      return xOf(Math.max(0, Math.min(visible.length - 1, rIdx)));
    };
    selLeft = mapToVisX(s);
    selRight = mapToVisX(en);
  }

  // Bollinger band fill path
  let bbFillPath = null;
  if (bb.length > 0) {
    const upper = [], lower = [];
    for (let i = 0; i < bb.length; i++) {
      if (bb[i]) {
        upper.push(`${xOf(i).toFixed(1)},${yOf(bb[i].upper).toFixed(1)}`);
        lower.unshift(`${xOf(i).toFixed(1)},${yOf(bb[i].lower).toFixed(1)}`);
      }
    }
    if (upper.length > 1) {
      bbFillPath = `M ${upper[0]} ${upper.map(p => `L ${p}`).join(' ')} ${lower.map(p => `L ${p}`).join(' ')} Z`;
    }
  }

  const Styles = {
    wrap: { background: '#000', borderBottom: '1px solid #333' },
    toolbar: {
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 8px', background: '#0d0d1a', borderBottom: '1px solid #333',
      flexWrap: 'wrap',
    },
    title: {
      color: '#ff8c00', fontFamily: 'Consolas,monospace', fontSize: '13px',
      textTransform: 'uppercase', letterSpacing: '1px', marginRight: 'auto',
    },
    pct: {
      color: isUp ? '#00cc00' : '#ff4444',
      fontFamily: 'Consolas,monospace', fontSize: '12px', marginRight: '8px',
    },
    rangeBtn: (active) => ({
      background: active ? '#1a3a5c' : 'transparent',
      color: active ? '#ff8c00' : '#555',
      border: `1px solid ${active ? '#ff8c00' : '#333'}`,
      fontFamily: 'Consolas,monospace', fontSize: '11px',
      padding: '1px 8px', cursor: 'pointer', textTransform: 'uppercase',
    }),
    modeBtn: (active) => ({
      background: active ? '#ff8c00' : 'transparent',
      color: active ? '#000' : '#555',
      border: `1px solid ${active ? '#ff8c00' : '#333'}`,
      fontFamily: 'Consolas,monospace', fontSize: '11px',
      padding: '1px 8px', cursor: 'pointer', textTransform: 'uppercase',
      fontWeight: active ? 'bold' : 'normal',
    }),
    indBtn: (active, color) => ({
      background: active ? '#0d1a2e' : 'transparent',
      color: active ? color : '#444',
      border: `1px solid ${active ? color : '#222'}`,
      fontFamily: 'Consolas,monospace', fontSize: '10px',
      padding: '1px 6px', cursor: 'pointer', textTransform: 'uppercase',
    }),
    resetBtn: {
      background: '#1a0d00', color: '#ff8c00',
      border: '1px solid #ff8c00',
      fontFamily: 'Consolas,monospace', fontSize: '11px',
      padding: '1px 8px', cursor: 'pointer', textTransform: 'uppercase',
    },
    sep: { color: '#333', margin: '0 2px' },
  };

  return (
    <div style={Styles.wrap}>
      <div style={Styles.toolbar}>
        <span style={Styles.title}>PRICE CHART — {ticker}</span>
        {hoverBar ? (
          <span style={{ fontFamily: 'Consolas,monospace', fontSize: '12px', color: '#b0b0b0', marginRight: '8px' }}>
            <span style={{ color: '#ffcc00' }}>{formatFullDate(hoverBar.t)}</span>
            {' '}O:<span style={{ color: '#fff' }}>{formatPrice(hoverBar.o)}</span>
            {' '}H:<span style={{ color: '#00cc00' }}>{formatPrice(hoverBar.h)}</span>
            {' '}L:<span style={{ color: '#ff4444' }}>{formatPrice(hoverBar.l)}</span>
            {' '}C:<span style={{ color: '#fff' }}>{formatPrice(hoverBar.c)}</span>
            {' '}V:<span style={{ color: '#888' }}>{formatVol(hoverBar.v)}</span>
            {showRSI && rsi[hoverIdx] != null && (
              <>{' '}RSI:<span style={{ color: rsi[hoverIdx] > 70 ? '#ff4444' : rsi[hoverIdx] < 30 ? '#00cc00' : '#ff8c00' }}>{rsi[hoverIdx].toFixed(1)}</span></>
            )}
          </span>
        ) : pctChange ? (
          <span style={Styles.pct}>{isUp ? '+' : ''}{pctChange}% ({range}{zoomSlice ? ' ZOOMED' : ''})</span>
        ) : null}
        {zoomSlice && <button style={Styles.resetBtn} onClick={resetZoom}>RESET ZOOM</button>}
        <span style={Styles.sep}>|</span>
        <button style={Styles.modeBtn(chartMode === 'LINE')} onClick={() => setChartMode('LINE')}>LINE</button>
        <button style={Styles.modeBtn(chartMode === 'CANDLE')} onClick={() => setChartMode('CANDLE')}>CANDLE</button>
        <Tooltip termKey="candlestick" />
        <span style={Styles.sep}>|</span>
        {RANGES.map(r => (
          <button key={r.label} style={Styles.rangeBtn(range === r.label)} onClick={() => handleRangeChange(r.label)}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Indicator + Drawing toggles */}
      <div style={{ display: 'flex', gap: '4px', padding: '3px 8px', background: '#050510', borderBottom: '1px solid #111', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#444', fontFamily: 'Consolas,monospace', fontSize: '10px', marginRight: '4px' }}>INDICATORS:</span>
        {INDICATOR_DEFS.map((ind, idx) => (
          <React.Fragment key={ind.key}>
            <button style={Styles.indBtn(activeIndicators.includes(ind.key), ind.color)} onClick={() => toggleIndicator(ind.key)}>
              {ind.label}
            </button>
            {INDICATOR_TOOLTIP_MAP[ind.key] !== INDICATOR_TOOLTIP_MAP[INDICATOR_DEFS[idx + 1]?.key] && (
              <Tooltip termKey={INDICATOR_TOOLTIP_MAP[ind.key]} />
            )}
          </React.Fragment>
        ))}
        <span style={{ color: '#333', margin: '0 4px' }}>|</span>
        <span style={{ color: '#444', fontFamily: 'Consolas,monospace', fontSize: '10px', marginRight: '4px' }}>DRAW:</span>
        <button style={Styles.indBtn(drawMode === 'trendline', '#ffcc00')} onClick={() => { setDrawMode(drawMode === 'trendline' ? null : 'trendline'); setPendingDraw(null); setSelectedDrawing(null); }}>
          TREND
        </button>
        <Tooltip termKey="trendline" />
        <button style={Styles.indBtn(drawMode === 'hline', '#ffcc00')} onClick={() => { setDrawMode(drawMode === 'hline' ? null : 'hline'); setPendingDraw(null); setSelectedDrawing(null); }}>
          HLINE
        </button>
        <button style={Styles.indBtn(drawMode === 'fib', '#00cccc')} onClick={() => { setDrawMode(drawMode === 'fib' ? null : 'fib'); setPendingDraw(null); setSelectedDrawing(null); }}>
          FIB
        </button>
        <Tooltip termKey="fibonacci" />
        {drawings.length > 0 && (
          <button style={{ ...Styles.indBtn(false, '#ff4444'), color: '#ff4444', borderColor: '#ff4444' }} onClick={() => { setDrawings([]); setSelectedDrawing(null); }}>
            CLEAR
          </button>
        )}
        {drawMode && (
          <span style={{ color: '#ff8c00', fontFamily: 'Consolas,monospace', fontSize: '10px', marginLeft: '4px' }}>
            {pendingDraw ? 'CLICK 2ND POINT' : drawMode === 'hline' ? 'CLICK PRICE LEVEL' : 'CLICK 1ST POINT'}
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${svgH}`}
        style={{ width: '100%', height: `${svgH}px`, display: 'block', cursor: drawMode ? 'cell' : 'crosshair', userSelect: 'none' }}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Background */}
        <rect x={0} y={0} width={W} height={svgH} fill="#000" />
        <rect x={LEFT} y={PRICE_TOP} width={CHART_W} height={PRICE_BOTTOM - PRICE_TOP} fill="#020208" />

        {/* Horizontal grid lines */}
        {yTicks.map(({ price, y }, i) => (
          <g key={i}>
            <line x1={LEFT} y1={y.toFixed(1)} x2={W - RIGHT} y2={y.toFixed(1)} stroke="#1a1a2e" strokeWidth="0.8" />
            <text x={(LEFT - 4).toFixed(1)} y={y.toFixed(1)} fill="#555" fontSize="10" textAnchor="end" dominantBaseline="middle" fontFamily="Consolas,monospace">
              {formatPrice(price)}
            </text>
          </g>
        ))}

        {/* Macro event markers */}
        {visibleEventBars.map((ev, i) => {
          const evX = xOf(ev.barIdx);
          const isFomc = ev.label === 'FOMC';
          const color = isFomc ? '#ffcc00' : '#66aaff';
          const isHovered = hoverEventIdx === i;
          return (
            <g key={`ev-${i}`} onMouseEnter={() => setHoverEventIdx(i)} onMouseLeave={() => setHoverEventIdx(null)}>
              <line x1={evX.toFixed(1)} y1={PRICE_TOP} x2={evX.toFixed(1)} y2={PRICE_BOTTOM}
                stroke={color} strokeWidth={isHovered ? '1.2' : '0.6'} strokeDasharray="2,4" opacity={isHovered ? '0.9' : '0.4'} />
              <polygon points={`${(evX - 4).toFixed(1)},${PRICE_TOP} ${(evX + 4).toFixed(1)},${PRICE_TOP} ${evX.toFixed(1)},${(PRICE_TOP + 7).toFixed(1)}`}
                fill={color} opacity={isHovered ? '1' : '0.6'} />
              {isHovered && (
                <g>
                  <rect x={evX - 80} y={PRICE_TOP + 10} width={160} height={16} fill="#0d0d1a" stroke={color} strokeWidth="0.5" rx="1" />
                  <text x={evX.toFixed(1)} y={(PRICE_TOP + 20).toFixed(1)} fill={color} fontSize="8" textAnchor="middle" dominantBaseline="middle" fontFamily="Consolas,monospace">
                    {ev.detail}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Bollinger Band fill */}
        {bbFillPath && <path d={bbFillPath} fill="rgba(170,102,255,0.06)" />}

        {/* LINE mode: area fill + price line */}
        {chartMode === 'LINE' && (
          <>
            <path d={areaPath} fill={areaColor} />
            <polyline points={linePts} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" />
          </>
        )}

        {/* CANDLE mode: candlesticks */}
        {chartMode === 'CANDLE' && visible.map((b, i) => {
          if (!b.h || !b.l) return null;
          const x = xOf(i);
          const bullish = b.c >= b.o;
          const bodyTop = yOf(Math.max(b.o, b.c));
          const bodyBot = yOf(Math.min(b.o, b.c));
          const bodyH = Math.max(1, bodyBot - bodyTop);
          const col = bullish ? '#00cc00' : '#ff4444';
          return (
            <g key={`candle-${i}`}>
              {/* Upper wick */}
              <line x1={x.toFixed(1)} y1={yOf(b.h).toFixed(1)} x2={x.toFixed(1)} y2={bodyTop.toFixed(1)}
                stroke={col} strokeWidth="1" />
              {/* Lower wick */}
              <line x1={x.toFixed(1)} y1={bodyBot.toFixed(1)} x2={x.toFixed(1)} y2={yOf(b.l).toFixed(1)}
                stroke={col} strokeWidth="1" />
              {/* Body */}
              <rect x={(x - candleW / 2).toFixed(1)} y={bodyTop.toFixed(1)}
                width={candleW.toFixed(1)} height={bodyH.toFixed(1)}
                fill={bullish ? '#000' : col} stroke={col} strokeWidth="0.8" />
            </g>
          );
        })}

        {/* Indicator overlays */}
        {sma20.length > 0 && buildLine(sma20, xOf, yOf).map((pts, i) => (
          <polyline key={`sma20-${i}`} points={pts} fill="none" stroke="#ffcc00" strokeWidth="1" opacity="0.8" />
        ))}
        {sma50.length > 0 && buildLine(sma50, xOf, yOf).map((pts, i) => (
          <polyline key={`sma50-${i}`} points={pts} fill="none" stroke="#00cccc" strokeWidth="1" opacity="0.8" />
        ))}
        {ema20.length > 0 && buildLine(ema20, xOf, yOf).map((pts, i) => (
          <polyline key={`ema20-${i}`} points={pts} fill="none" stroke="#ff8c00" strokeWidth="1" opacity="0.8" />
        ))}
        {bb.length > 0 && (
          <>
            {buildLine(bb.map(b => b?.upper), xOf, yOf).map((pts, i) => (
              <polyline key={`bbu-${i}`} points={pts} fill="none" stroke="#aa66ff" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.7" />
            ))}
            {buildLine(bb.map(b => b?.mid), xOf, yOf).map((pts, i) => (
              <polyline key={`bbm-${i}`} points={pts} fill="none" stroke="#aa66ff" strokeWidth="0.6" opacity="0.5" />
            ))}
            {buildLine(bb.map(b => b?.lower), xOf, yOf).map((pts, i) => (
              <polyline key={`bbl-${i}`} points={pts} fill="none" stroke="#aa66ff" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.7" />
            ))}
          </>
        )}

        {/* Drawing layer */}
        {(() => {
          const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 1];
          const anchorToX = (anchor) => {
            let bestIdx = 0, bestDist = Infinity;
            for (let i = 0; i < visible.length; i++) {
              const dist = Math.abs(visible[i].t - anchor.t);
              if (dist < bestDist) { bestDist = dist; bestIdx = i; }
            }
            return xOf(bestIdx);
          };

          const renderDrawing = (d, opacity = 1) => {
            const isSel = selectedDrawing === d.id;
            const sw = isSel ? 2.5 : 1.5;
            const col = isSel ? '#ffffff' : d.color;

            if (d.type === 'hline') {
              const y = yOf(d.anchors[0].price);
              if (y < PRICE_TOP || y > PRICE_BOTTOM) return null;
              return (
                <g key={d.id} onClick={(e) => { e.stopPropagation(); setSelectedDrawing(isSel ? null : d.id); }} style={{ cursor: 'pointer' }}>
                  <line x1={LEFT} y1={y.toFixed(1)} x2={W - RIGHT} y2={y.toFixed(1)}
                    stroke={col} strokeWidth={sw} strokeDasharray="6,3" opacity={opacity} />
                  <rect x={W - RIGHT + 1} y={y - 7} width={50} height={14} fill={d.color} opacity={opacity} rx="1" />
                  <text x={W - RIGHT + 4} y={y.toFixed(1)} fill="#000" fontSize="9" dominantBaseline="middle"
                    fontFamily="Consolas,monospace" fontWeight="bold" opacity={opacity}>
                    {formatPrice(d.anchors[0].price)}
                  </text>
                </g>
              );
            }

            if (d.type === 'trendline') {
              const x1 = anchorToX(d.anchors[0]), y1 = yOf(d.anchors[0].price);
              const x2 = anchorToX(d.anchors[1]), y2 = yOf(d.anchors[1].price);
              // Extend line to chart edges
              const dx = x2 - x1, dy = y2 - y1;
              let ex1 = x1, ey1 = y1, ex2 = x2, ey2 = y2;
              if (dx !== 0) {
                const slope = dy / dx;
                ex1 = LEFT; ey1 = y1 + slope * (LEFT - x1);
                ex2 = W - RIGHT; ey2 = y1 + slope * (W - RIGHT - x1);
              }
              return (
                <g key={d.id} onClick={(e) => { e.stopPropagation(); setSelectedDrawing(isSel ? null : d.id); }} style={{ cursor: 'pointer' }}>
                  <line x1={ex1.toFixed(1)} y1={ey1.toFixed(1)} x2={ex2.toFixed(1)} y2={ey2.toFixed(1)}
                    stroke={col} strokeWidth={sw} strokeDasharray="6,3" opacity={opacity} />
                  {/* Hit area (wider invisible line for easier clicking) */}
                  <line x1={ex1.toFixed(1)} y1={ey1.toFixed(1)} x2={ex2.toFixed(1)} y2={ey2.toFixed(1)}
                    stroke="transparent" strokeWidth="8" />
                  <circle cx={x1.toFixed(1)} cy={y1.toFixed(1)} r="3" fill={col} opacity={opacity} />
                  <circle cx={x2.toFixed(1)} cy={y2.toFixed(1)} r="3" fill={col} opacity={opacity} />
                </g>
              );
            }

            if (d.type === 'fib') {
              const x1 = anchorToX(d.anchors[0]), x2 = anchorToX(d.anchors[1]);
              const p1 = d.anchors[0].price, p2 = d.anchors[1].price;
              const high = Math.max(p1, p2), low = Math.min(p1, p2);
              return (
                <g key={d.id} onClick={(e) => { e.stopPropagation(); setSelectedDrawing(isSel ? null : d.id); }} style={{ cursor: 'pointer' }}>
                  {FIB_LEVELS.map((level, li) => {
                    const price = high - level * (high - low);
                    const y = yOf(price);
                    const isEdge = level === 0 || level === 1;
                    return (
                      <g key={li}>
                        <line x1={LEFT} y1={y.toFixed(1)} x2={W - RIGHT} y2={y.toFixed(1)}
                          stroke={col} strokeWidth={isEdge ? sw : 1} strokeDasharray={isEdge ? 'none' : '4,3'}
                          opacity={opacity * (isEdge ? 1 : 0.6)} />
                        <text x={W - RIGHT + 2} y={y.toFixed(1)} fill={col} fontSize="8" dominantBaseline="middle"
                          fontFamily="Consolas,monospace" opacity={opacity * 0.8}>
                          {(level * 100).toFixed(1)}%
                        </text>
                      </g>
                    );
                  })}
                  {/* Shaded area between 38.2% and 61.8% */}
                  {(() => {
                    const y382 = yOf(high - 0.382 * (high - low));
                    const y618 = yOf(high - 0.618 * (high - low));
                    return <rect x={LEFT} y={Math.min(y382, y618)} width={CHART_W}
                      height={Math.abs(y618 - y382)} fill={col} opacity={0.04 * opacity} />;
                  })()}
                  <circle cx={x1.toFixed(1)} cy={yOf(p1).toFixed(1)} r="3" fill={col} opacity={opacity} />
                  <circle cx={x2.toFixed(1)} cy={yOf(p2).toFixed(1)} r="3" fill={col} opacity={opacity} />
                </g>
              );
            }
            return null;
          };

          return (
            <g>
              {/* Completed drawings */}
              {drawings.map(d => renderDrawing(d))}
              {/* Rubber-band preview for pending drawing */}
              {pendingDraw && mousePos && (() => {
                const idx = Math.round(Math.max(0, Math.min(visible.length - 1, (mousePos.x - LEFT) / CHART_W * (visible.length - 1))));
                const { minPrice: mp, priceRange: pr } = priceInfoRef.current;
                const price = mp + (PRICE_BOTTOM - mousePos.y) / (PRICE_BOTTOM - PRICE_TOP) * pr;
                const preview = {
                  ...pendingDraw,
                  id: 'preview',
                  anchors: [...pendingDraw.anchors, { t: visible[idx].t, price }],
                };
                return renderDrawing(preview, 0.5);
              })()}
            </g>
          );
        })()}

        {/* Current price marker */}
        {(() => {
          const last = visible[visible.length - 1];
          const x = xOf(visible.length - 1);
          const y = yOf(last.c);
          return (
            <g>
              <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="3" fill={lineColor} />
              <text x={(W - RIGHT + 2).toFixed(1)} y={y.toFixed(1)} fill={lineColor} fontSize="9"
                dominantBaseline="middle" fontFamily="Consolas,monospace">
                {formatPrice(last.c)}
              </text>
            </g>
          );
        })()}

        {/* Drag selection highlight */}
        {selLeft != null && selRight != null && (
          <g>
            <rect x={selLeft} y={PRICE_TOP} width={Math.max(1, selRight - selLeft)} height={VOL_BOTTOM - PRICE_TOP}
              fill="rgba(255,140,0,0.15)" stroke="#ff8c00" strokeWidth="1" strokeDasharray="4,2" />
            {(() => {
              const s = Math.min(dragStartIdx, dragCurrentIdx);
              const en = Math.max(dragStartIdx, dragCurrentIdx);
              const sBar = rangedBars[s];
              const eBar = rangedBars[en];
              return (
                <>
                  {sBar && <text x={selLeft} y={VOL_BOTTOM + 12} fill="#ff8c00" fontSize="9" textAnchor="start" fontFamily="Consolas,monospace">{formatFullDate(sBar.t)}</text>}
                  {eBar && <text x={selRight} y={VOL_BOTTOM + 12} fill="#ff8c00" fontSize="9" textAnchor="end" fontFamily="Consolas,monospace">{formatFullDate(eBar.t)}</text>}
                </>
              );
            })()}
          </g>
        )}

        {/* Hover crosshair */}
        {hoverBar && !isDragging.current && (
          <g>
            <line x1={hoverX.toFixed(1)} y1={PRICE_TOP} x2={hoverX.toFixed(1)} y2={showRSI ? RSI_BOTTOM : VOL_BOTTOM}
              stroke="#ff8c00" strokeWidth="0.7" strokeDasharray="3,3" opacity="0.7" />
            <line x1={LEFT} y1={hoverY.toFixed(1)} x2={W - RIGHT} y2={hoverY.toFixed(1)}
              stroke="#ff8c00" strokeWidth="0.7" strokeDasharray="3,3" opacity="0.7" />
            <rect x={0} y={hoverY - 7} width={LEFT - 2} height={14} fill="#ff8c00" rx="1" />
            <text x={(LEFT - 4).toFixed(1)} y={hoverY.toFixed(1)} fill="#000" fontSize="9" textAnchor="end"
              dominantBaseline="middle" fontFamily="Consolas,monospace" fontWeight="bold">
              {formatPrice(hoverBar.c)}
            </text>
            <rect x={hoverX - 40} y={(showRSI ? RSI_BOTTOM : VOL_BOTTOM) + 2} width={80} height={14} fill="#ff8c00" rx="1" />
            <text x={hoverX.toFixed(1)} y={((showRSI ? RSI_BOTTOM : VOL_BOTTOM) + 9).toFixed(1)} fill="#000" fontSize="9"
              textAnchor="middle" dominantBaseline="middle" fontFamily="Consolas,monospace" fontWeight="bold">
              {formatFullDate(hoverBar.t)}
            </text>
            <circle cx={hoverX.toFixed(1)} cy={hoverY.toFixed(1)} r="4" fill="#ff8c00" />
            <circle cx={hoverX.toFixed(1)} cy={hoverY.toFixed(1)} r="2" fill="#000" />
          </g>
        )}

        {/* Volume bars */}
        <rect x={LEFT} y={VOL_TOP - 2} width={CHART_W} height={VOL_BOTTOM - VOL_TOP + 4} fill="#020208" />
        {visible.map((b, i) => {
          const x = xOf(i) - barW / 2;
          const y = yVol(b.v || 0);
          const h = VOL_BOTTOM - y;
          const isHovered = i === hoverIdx;
          const col = isHovered ? '#ff8c00' : (b.c >= b.o) ? 'rgba(0,180,0,0.5)' : 'rgba(220,50,50,0.5)';
          return <rect key={i} x={x.toFixed(1)} y={y.toFixed(1)} width={barW.toFixed(1)} height={Math.max(1, h).toFixed(1)} fill={col} />;
        })}
        <text x={(LEFT - 4)} y={((VOL_TOP + VOL_BOTTOM) / 2).toFixed(1)} fill="#444" fontSize="9"
          textAnchor="end" dominantBaseline="middle" fontFamily="Consolas,monospace">VOL</text>

        {/* RSI sub-chart */}
        {showRSI && (
          <g>
            <rect x={LEFT} y={RSI_TOP - 2} width={CHART_W} height={RSI_BOTTOM - RSI_TOP + 4} fill="#020208" />
            {/* Reference lines */}
            {[70, 50, 30].map(level => (
              <g key={`rsi-ref-${level}`}>
                <line x1={LEFT} y1={yRSI(level).toFixed(1)} x2={W - RIGHT} y2={yRSI(level).toFixed(1)}
                  stroke={level === 50 ? '#333' : '#1a1a2e'} strokeWidth="0.8" strokeDasharray={level === 50 ? '4,4' : '2,3'} />
                <text x={(LEFT - 4).toFixed(1)} y={yRSI(level).toFixed(1)} fill={level === 70 ? '#ff4444' : level === 30 ? '#00cc00' : '#444'}
                  fontSize="8" textAnchor="end" dominantBaseline="middle" fontFamily="Consolas,monospace">{level}</text>
              </g>
            ))}
            {/* RSI line */}
            {buildLine(rsi, xOf, yRSI).map((pts, i) => (
              <polyline key={`rsi-${i}`} points={pts} fill="none" stroke="#ff8c00" strokeWidth="1.2" />
            ))}
            {/* Overbought/oversold zones */}
            <rect x={LEFT} y={yRSI(100).toFixed(1)} width={CHART_W} height={(yRSI(70) - yRSI(100)).toFixed(1)}
              fill="rgba(255,60,60,0.05)" />
            <rect x={LEFT} y={yRSI(30).toFixed(1)} width={CHART_W} height={(yRSI(0) - yRSI(30)).toFixed(1)}
              fill="rgba(0,180,0,0.05)" />
            {/* Hover dot on RSI */}
            {hoverIdx != null && rsi[hoverIdx] != null && (
              <circle cx={hoverX.toFixed(1)} cy={yRSI(rsi[hoverIdx]).toFixed(1)} r="3" fill="#ff8c00" />
            )}
            <text x={(LEFT - 4)} y={((RSI_TOP + RSI_BOTTOM) / 2).toFixed(1)} fill="#444" fontSize="9"
              textAnchor="end" dominantBaseline="middle" fontFamily="Consolas,monospace">RSI</text>
          </g>
        )}

        {/* X-axis date labels */}
        {xLabels.map(({ i, ts }) => (
          <text key={i} x={xOf(i).toFixed(1)} y={svgH - 3} fill="#555" fontSize="9" textAnchor="middle" fontFamily="Consolas,monospace">
            {formatDate(ts)}
          </text>
        ))}

        {/* Y-axis border */}
        <line x1={LEFT} y1={PRICE_TOP} x2={LEFT} y2={showRSI ? RSI_BOTTOM : VOL_BOTTOM} stroke="#333" strokeWidth="1" />

        {/* Invisible overlay for mouse events */}
        <rect x={LEFT} y={PRICE_TOP} width={CHART_W} height={(showRSI ? RSI_BOTTOM : VOL_BOTTOM) - PRICE_TOP} fill="transparent" />
      </svg>

      <div style={{
        padding: '2px 8px', background: '#050505', borderTop: '1px solid #111',
        color: '#333', fontFamily: 'Consolas,monospace', fontSize: '10px',
      }}>
        {drawMode
          ? 'CLICK TO PLACE POINTS · ESC TO CANCEL · DOUBLE-CLICK TO CANCEL'
          : selectedDrawing
          ? 'DELETE/BACKSPACE TO REMOVE · CLICK ELSEWHERE TO DESELECT'
          : 'DRAG TO ZOOM · DOUBLE-CLICK TO RESET · CLICK A DRAWING TO SELECT'}
      </div>
    </div>
  );
}
