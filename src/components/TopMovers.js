import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTopMovers } from '../hooks/useYahooFinance';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatVolume(n) {
  if (n == null || n === 0) return '--';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function formatPrice(p) {
  if (p == null) return '--';
  return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(p) {
  if (p == null) return '--';
  const sign = p >= 0 ? '+' : '';
  return sign + p.toFixed(2) + '%';
}

function pctColor(p) {
  if (p == null) return '#888888';
  return p >= 0 ? '#00cc00' : '#ff4444';
}

// ── Styles ────────────────────────────────────────────────────────────────────
const FONT = "'Consolas','Courier New',monospace";

const S = {
  container: {
    background: '#000000',
    fontFamily: FONT,
  },
  header: {
    background: '#0d0d1a',
    borderBottom: '2px solid #ff8c00',
    padding: '4px 8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ff8c00',
    fontFamily: FONT,
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontFamily: FONT,
    fontSize: '10px',
  },
  timestamp: {
    color: '#555555',
    fontFamily: FONT,
    fontSize: '10px',
  },
  refreshBtn: {
    background: 'transparent',
    color: '#ff8c00',
    border: '1px solid #333333',
    fontFamily: FONT,
    fontSize: '10px',
    padding: '1px 8px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '0',
    borderTop: '1px solid #222222',
  },
  column: {
    borderRight: '1px solid #222222',
  },
  columnLast: {},
  colHeader: (color) => ({
    background: '#0d0d1a',
    color,
    fontFamily: FONT,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    padding: '4px 8px',
    borderBottom: '1px solid #222222',
  }),
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: FONT,
  },
  th: {
    color: '#666666',
    fontFamily: FONT,
    fontSize: '10px',
    textTransform: 'uppercase',
    padding: '3px 6px',
    border: '1px solid #222222',
    background: '#0a0a0a',
    fontWeight: 'normal',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  thLeft: {
    color: '#666666',
    fontFamily: FONT,
    fontSize: '10px',
    textTransform: 'uppercase',
    padding: '3px 6px',
    border: '1px solid #222222',
    background: '#0a0a0a',
    fontWeight: 'normal',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  td: {
    fontFamily: FONT,
    fontSize: '12px',
    padding: '3px 6px',
    border: '1px solid #222222',
    textAlign: 'right',
    color: '#ffffff',
    whiteSpace: 'nowrap',
  },
  tdLeft: {
    fontFamily: FONT,
    fontSize: '12px',
    padding: '3px 6px',
    border: '1px solid #222222',
    textAlign: 'left',
    color: '#ffffff',
    whiteSpace: 'nowrap',
  },
  rankCell: {
    fontFamily: FONT,
    fontSize: '11px',
    padding: '3px 6px',
    border: '1px solid #222222',
    textAlign: 'right',
    color: '#555555',
    width: '20px',
  },
  loading: {
    padding: '40px 16px',
    color: '#ff8c00',
    fontFamily: FONT,
    fontSize: '12px',
    textAlign: 'center',
  },
  noData: {
    padding: '40px 16px',
    color: '#444444',
    fontFamily: FONT,
    fontSize: '12px',
    textAlign: 'center',
  },
};

// ── MoverRow ──────────────────────────────────────────────────────────────────
function MoverRow({ item, rank, onTickerChange }) {
  const [hover, setHover] = useState(false);
  const bg = hover ? '#1a3a5c' : 'transparent';

  return (
    <tr
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onTickerChange && onTickerChange(item.symbol)}
    >
      <td style={{ ...S.rankCell, background: bg }}>{rank}</td>
      <td style={{ ...S.tdLeft, background: bg, color: '#ffcc00', fontWeight: 'bold' }}>
        {item.symbol}
      </td>
      <td style={{ ...S.td, background: bg }}>{formatPrice(item.price)}</td>
      <td style={{ ...S.td, background: bg, color: pctColor(item.changePct) }}>
        {formatPct(item.changePct)}
      </td>
      <td style={{ ...S.td, background: bg, color: '#aaaaaa' }}>
        {formatVolume(item.volume)}
      </td>
    </tr>
  );
}

// ── MoverTable ────────────────────────────────────────────────────────────────
function MoverTable({ items, onTickerChange }) {
  return (
    <table style={S.table}>
      <thead>
        <tr>
          <th style={{ ...S.th, width: '20px' }}>#</th>
          <th style={S.thLeft}>SYMBOL</th>
          <th style={S.th}>PRICE</th>
          <th style={S.th}>%CHG</th>
          <th style={S.th}>VOLUME</th>
        </tr>
      </thead>
      <tbody>
        {items.slice(0, 10).map((item, i) => (
          <MoverRow
            key={item.symbol}
            item={item}
            rank={i + 1}
            onTickerChange={onTickerChange}
          />
        ))}
      </tbody>
    </table>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TopMovers({ onTickerChange }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [updateTime, setUpdateTime] = useState(null);
  const { register, unregister } = useExport();
  const dataRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTopMovers(10);
      dataRef.current = result;
      setData(result);
      setUpdateTime(new Date());
    } catch (err) {
      setError(err.message || 'Failed to fetch top movers');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 90 seconds
  useEffect(() => {
    const id = setInterval(() => { load(); }, 90000);
    return () => clearInterval(id);
  }, [load]);

  // Register CSV export
  useEffect(() => {
    if (data) {
      register('TOP_MOVERS', 'Top Movers', () => {
        const date = new Date().toISOString().split('T')[0];
        const toRows = (items, category) =>
          items.map((item, i) => ({
            category,
            rank:        i + 1,
            symbol:      item.symbol,
            name:        item.name,
            price:       item.price,
            change:      item.change != null ? item.change.toFixed(2) : '',
            change_pct:  item.changePct != null ? item.changePct.toFixed(2) : '',
            volume:      item.volume,
            avg_volume:  item.avgVolume,
          }));
        const rows = [
          ...toRows(data.gainers, 'GAINER'),
          ...toRows(data.losers,  'LOSER'),
          ...toRows(data.actives, 'ACTIVE'),
        ];
        exportCSV(rows, `top_movers_${date}.csv`);
      });
    } else {
      unregister('TOP_MOVERS');
    }
    return () => unregister('TOP_MOVERS');
  }, [data, register, unregister]);

  const timeLabel = updateTime
    ? updateTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  const hasData = data && (
    (data.gainers && data.gainers.length > 0) ||
    (data.losers  && data.losers.length  > 0) ||
    (data.actives && data.actives.length > 0)
  );

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.headerTitle}>TMV — TOP MOVERS / MOST ACTIVE</span>
        <div style={S.headerRight}>
          {loading && (
            <span style={{ color: '#ff8c00', fontFamily: FONT, fontSize: '10px' }}>
              FETCHING...
            </span>
          )}
          {error && !loading && (
            <span style={{ color: '#ff4444', fontFamily: FONT, fontSize: '10px' }}>
              &#9888; {error}
            </span>
          )}
          {timeLabel && !loading && (
            <span style={S.timestamp}>UPD {timeLabel}</span>
          )}
          <button
            style={S.refreshBtn}
            onClick={load}
            disabled={loading}
          >
            &#8635; REFRESH
          </button>
        </div>
      </div>

      {/* Loading state (no prior data) */}
      {loading && !data && (
        <div style={S.loading}>LOADING...</div>
      )}

      {/* Error with no prior data */}
      {error && !loading && !data && (
        <div style={S.noData}>NO DATA</div>
      )}

      {/* 3-column grid */}
      {(hasData || (data && !loading)) && (
        <div style={S.grid}>
          {/* TOP GAINERS */}
          <div style={S.column}>
            <div style={S.colHeader('#00cc00')}>TOP GAINERS</div>
            {data && data.gainers && data.gainers.length > 0 ? (
              <MoverTable items={data.gainers} onTickerChange={onTickerChange} />
            ) : (
              <div style={S.noData}>NO DATA</div>
            )}
          </div>

          {/* TOP LOSERS */}
          <div style={S.column}>
            <div style={S.colHeader('#ff4444')}>TOP LOSERS</div>
            {data && data.losers && data.losers.length > 0 ? (
              <MoverTable items={data.losers} onTickerChange={onTickerChange} />
            ) : (
              <div style={S.noData}>NO DATA</div>
            )}
          </div>

          {/* MOST ACTIVE */}
          <div style={{ ...S.column, ...S.columnLast }}>
            <div style={S.colHeader('#ff8c00')}>MOST ACTIVE</div>
            {data && data.actives && data.actives.length > 0 ? (
              <MoverTable items={data.actives} onTickerChange={onTickerChange} />
            ) : (
              <div style={S.noData}>NO DATA</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
