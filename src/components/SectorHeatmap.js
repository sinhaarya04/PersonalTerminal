import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchYFQuotes } from '../hooks/useYahooFinance';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

// ── Sector ETF metadata ──────────────────────────────────────────────────────
const SECTORS = [
  { symbol: 'XLK',  name: 'Technology',             weight: 32 },
  { symbol: 'XLF',  name: 'Financials',             weight: 13 },
  { symbol: 'XLV',  name: 'Health Care',            weight: 12 },
  { symbol: 'XLY',  name: 'Consumer Discretionary', weight: 10 },
  { symbol: 'XLC',  name: 'Communication',          weight:  9 },
  { symbol: 'XLI',  name: 'Industrials',            weight:  9 },
  { symbol: 'XLP',  name: 'Consumer Staples',       weight:  6 },
  { symbol: 'XLE',  name: 'Energy',                 weight:  4 },
  { symbol: 'XLB',  name: 'Materials',              weight:  2 },
  { symbol: 'XLRE', name: 'Real Estate',            weight:  2 },
  { symbol: 'XLU',  name: 'Utilities',              weight:  2 },
];

// ── Color mapping ─────────────────────────────────────────────────────────────
// pct clamped to [-5, +5]; negative => red, positive => green
function pctToColor(pct) {
  if (pct == null) return '#1a1a2e';
  const clamped = Math.max(-5, Math.min(5, pct));
  const intensity = Math.abs(clamped) / 5; // 0 → 1
  if (clamped >= 0) {
    // green: #001a00 → #00cc00
    const g = Math.round(26 + intensity * (204 - 26));
    return `rgb(0,${g},0)`;
  } else {
    // red: #1a0000 → #cc0000
    const r = Math.round(26 + intensity * (204 - 26));
    return `rgb(${r},0,0)`;
  }
}

// ── Recursive treemap layout (no d3) ─────────────────────────────────────────
// items: [{ ...any, weight: number }]
// returns items annotated with { x0, y0, x1, y1 }
function computeTreemap(items, x0, y0, x1, y1) {
  if (!items || items.length === 0) return [];
  if (items.length === 1) {
    return [{ ...items[0], x0, y0, x1, y1 }];
  }

  const totalWeight = items.reduce((s, it) => s + it.weight, 0);
  const W = x1 - x0;
  const H = y1 - y0;

  // Find split point: first index where cumulative weight >= half total
  let cumulative = 0;
  let splitIdx = 0;
  for (let i = 0; i < items.length - 1; i++) {
    cumulative += items[i].weight;
    if (cumulative >= totalWeight / 2) {
      splitIdx = i + 1;
      break;
    }
    splitIdx = i + 1;
  }
  if (splitIdx === 0) splitIdx = 1;

  const leftItems  = items.slice(0, splitIdx);
  const rightItems = items.slice(splitIdx);
  const leftWeight = leftItems.reduce((s, it) => s + it.weight, 0);
  const ratio = leftWeight / totalWeight;

  let leftRect, rightRect;
  if (W >= H) {
    // Split vertically (left | right)
    const mid = x0 + W * ratio;
    leftRect  = { x0, y0, x1: mid, y1 };
    rightRect = { x0: mid, y0, x1, y1 };
  } else {
    // Split horizontally (top / bottom)
    const mid = y0 + H * ratio;
    leftRect  = { x0, y0, x1, y1: mid };
    rightRect = { x0, y0: mid, x1, y1 };
  }

  return [
    ...computeTreemap(leftItems,  leftRect.x0,  leftRect.y0,  leftRect.x1,  leftRect.y1),
    ...computeTreemap(rightItems, rightRect.x0, rightRect.y0, rightRect.x1, rightRect.y1),
  ];
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  container: {
    background: '#000000',
    minHeight: '640px',
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
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  dot: (color) => ({
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: color,
    marginRight: '4px',
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
  svgWrap: {
    flex: 1,
    padding: '4px 8px 8px',
    background: '#000000',
  },
  loadingTxt: {
    padding: '40px',
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textAlign: 'center',
  },
  errorTxt: {
    padding: '20px',
    color: '#ff4444',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
  },
  legend: {
    padding: '4px 8px 6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    borderTop: '1px solid #1a1a1a',
  },
  legendLabel: {
    color: '#555',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
    marginRight: '4px',
  },
};

// ── Gap constant (px in viewBox units) ───────────────────────────────────────
const GAP = 2;

// ── Main Component ────────────────────────────────────────────────────────────
export default function SectorHeatmap() {
  const [tiles, setTiles]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [hoveredSym, setHoveredSym] = useState(null);
  const [updateTime, setUpdateTime] = useState(null);
  const { register, unregister } = useExport();
  const tilesRef = useRef([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const symbols = SECTORS.map(s => s.symbol);
      const quotes  = await fetchYFQuotes(symbols);

      // Map quotes by symbol
      const bySymbol = {};
      quotes.forEach(q => { bySymbol[q.symbol] = q; });

      // Build items for treemap (sorted by weight desc for nicer layout)
      const items = SECTORS.map(sec => {
        const q = bySymbol[sec.symbol];
        return {
          symbol: sec.symbol,
          name:   sec.name,
          weight: sec.weight,
          price:  q?.regularMarketPrice ?? null,
          pct:    q?.regularMarketChangePercent ?? null,
          change: q?.regularMarketChange ?? null,
        };
      });

      // Compute treemap layout over viewBox 1000x600
      const laidOut = computeTreemap(items, 0, 0, 1000, 600);
      tilesRef.current = laidOut;
      setTiles(laidOut);
      setUpdateTime(new Date());
    } catch (err) {
      setError(err.message || 'Failed to fetch sector data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Register CSV export
  useEffect(() => {
    if (tilesRef.current.length > 0) {
      register('SECTOR_HEATMAP', 'Sector Heatmap', () => {
        const date = new Date().toISOString().split('T')[0];
        const rows = tilesRef.current.map(t => ({
          symbol:     t.symbol,
          sector:     t.name,
          weight_pct: t.weight,
          price:      t.price,
          change:     t.change != null ? t.change.toFixed(2) : '',
          pct_change: t.pct  != null ? t.pct.toFixed(2)  : '',
        }));
        exportCSV(rows, `sector_heatmap_${date}.csv`);
      });
    } else {
      unregister('SECTOR_HEATMAP');
    }
    return () => unregister('SECTOR_HEATMAP');
  }, [tiles, register, unregister]);

  // ── Status indicator ──────────────────────────────────────────────────────
  const statusColor = loading
    ? '#ff8c00'
    : error
    ? '#ff4444'
    : tiles.length > 0
    ? '#00cc00'
    : '#555';

  const statusLabel = loading
    ? 'FETCHING...'
    : error
    ? 'ERROR'
    : tiles.length > 0
    ? `LIVE · ${tiles.length} SECTORS`
    : 'NO DATA';

  const timeLabel = updateTime
    ? updateTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>MAP — S&amp;P SECTOR HEATMAP</span>
        <div style={S.headerRight}>
          <span>
            <span style={S.dot(statusColor)} />
            <span style={S.statusTxt(statusColor)}>{statusLabel}</span>
          </span>
          {timeLabel && (
            <span style={{ color: '#444', fontFamily: "'Consolas','Courier New',monospace", fontSize: '10px' }}>
              {timeLabel}
            </span>
          )}
          <button
            style={S.refreshBtn}
            onClick={load}
            disabled={loading}
          >
            {'\u21BB'} REFRESH
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && tiles.length === 0 && (
        <div style={S.loadingTxt}>
          FETCHING 11 SECTOR ETFs FROM YAHOO FINANCE...
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div style={S.errorTxt}>
          {'\u26A0'} {error}
        </div>
      )}

      {/* Treemap SVG */}
      {tiles.length > 0 && (
        <div style={S.svgWrap}>
          <svg
            viewBox="0 0 1000 600"
            width="100%"
            style={{ display: 'block', cursor: 'default' }}
          >
            {tiles.map(tile => {
              const isHovered = hoveredSym === tile.symbol;
              const x  = tile.x0 + GAP;
              const y  = tile.y0 + GAP;
              const w  = Math.max(0, tile.x1 - tile.x0 - GAP * 2);
              const h  = Math.max(0, tile.y1 - tile.y0 - GAP * 2);
              const cx = x + w / 2;
              const cy = y + h / 2;

              const fillColor   = pctToColor(tile.pct);
              const strokeColor = isHovered ? '#ff8c00' : 'transparent';
              const strokeWidth = isHovered ? 2 : 0;

              // Text visibility thresholds
              const showTicker = w > 40  && h > 22;
              const showName   = w > 80  && h > 48;
              const showPct    = w > 50  && h > 35;

              const pctStr = tile.pct != null
                ? (tile.pct >= 0 ? '+' : '') + tile.pct.toFixed(2) + '%'
                : 'N/A';

              const pctColor = tile.pct == null
                ? '#888'
                : tile.pct >= 0
                ? '#66ff66'
                : '#ff6666';

              // Vertical centering logic
              let tickerY = cy;
              if (showName && showPct)   tickerY = cy - 14;
              else if (showPct)          tickerY = cy - 8;
              else if (showName)         tickerY = cy - 8;

              return (
                <g
                  key={tile.symbol}
                  onMouseEnter={() => setHoveredSym(tile.symbol)}
                  onMouseLeave={() => setHoveredSym(null)}
                >
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    rx={1}
                  />

                  {/* Ticker symbol */}
                  {showTicker && (
                    <text
                      x={cx}
                      y={tickerY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#ffffff"
                      fontSize={Math.min(16, Math.max(9, w / 5))}
                      fontFamily="Consolas,'Courier New',monospace"
                      fontWeight="bold"
                    >
                      {tile.symbol}
                    </text>
                  )}

                  {/* Full sector name */}
                  {showName && (
                    <text
                      x={cx}
                      y={tickerY + Math.min(16, Math.max(9, w / 5)) + 4}
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      fill="#aaaaaa"
                      fontSize={Math.min(11, Math.max(8, w / 9))}
                      fontFamily="Consolas,'Courier New',monospace"
                    >
                      {tile.name.toUpperCase()}
                    </text>
                  )}

                  {/* Percent change */}
                  {showPct && (
                    <text
                      x={cx}
                      y={showName
                        ? tickerY + Math.min(16, Math.max(9, w / 5)) + 4 + Math.min(11, Math.max(8, w / 9)) + 6
                        : tickerY + Math.min(16, Math.max(9, w / 5)) + 4}
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      fill={pctColor}
                      fontSize={Math.min(13, Math.max(9, w / 6))}
                      fontFamily="Consolas,'Courier New',monospace"
                      fontWeight="bold"
                    >
                      {pctStr}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Color scale legend */}
      {tiles.length > 0 && (
        <div style={S.legend}>
          <span style={S.legendLabel}>SCALE:</span>
          {/* Gradient bar via a series of rects */}
          <svg width={160} height={12} viewBox="0 0 160 12" style={{ display: 'block' }}>
            {Array.from({ length: 32 }, (_, i) => {
              const pct = -5 + (i / 31) * 10;
              return (
                <rect
                  key={i}
                  x={i * 5}
                  y={0}
                  width={5}
                  height={12}
                  fill={pctToColor(pct)}
                />
              );
            })}
          </svg>
          <span style={{ ...S.legendLabel, color: '#ff6666' }}>-5%</span>
          <span style={{ ...S.legendLabel, color: '#555' }}>0%</span>
          <span style={{ ...S.legendLabel, color: '#66ff66' }}>+5%</span>
          <span style={{ ...S.legendLabel, marginLeft: '16px' }}>
            HOVER FOR HIGHLIGHT · WEIGHTS: APPROXIMATE S&amp;P 500 SECTOR CAPS
          </span>
        </div>
      )}
    </div>
  );
}
