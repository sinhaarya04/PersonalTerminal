import React, { useState, useEffect } from 'react';
import { formatValue, formatChange, formatPct, getChangeColor } from '../utils/formatting';
import { fetchWorldIndices } from '../hooks/useYahooFinance';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

const S = {
  container: { padding: '0', background: '#000000' },
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
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  headerRight: {
    color: '#888888',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  toolbar: {
    background: '#0d0d1a',
    borderBottom: '1px solid #333333',
    padding: '3px 8px',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  toolBtn: (active) => ({
    background: active ? '#1a3a5c' : 'transparent',
    color: active ? '#ff8c00' : '#888888',
    border: `1px solid ${active ? '#ff8c00' : '#333333'}`,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    padding: '1px 8px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  }),
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: "'Consolas','Courier New',monospace" },
  regionCell: {
    color: '#ffcc00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    padding: '4px 8px',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    borderBottom: '1px solid #333333',
    borderTop: '2px solid #444444',
    background: '#0d0d1a',
  },
  th: {
    background: '#1a1a2e',
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    padding: '3px 8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    border: '1px solid #333333',
    fontWeight: 'normal',
    textAlign: 'right',
  },
  td: { border: '1px solid #222222', padding: '3px 8px', fontFamily: "'Consolas','Courier New',monospace", fontSize: '12px', textAlign: 'right', color: '#ffffff' },
  loading: { padding: '20px', color: '#ff8c00', fontFamily: "'Consolas','Courier New',monospace", fontSize: '12px', textAlign: 'center' },
  error:   { padding: '20px', color: '#ff4444', fontFamily: "'Consolas','Courier New',monospace", fontSize: '12px' },
};

function IndexRow({ idx, selected, onSelect }) {
  const [hover, setHover] = useState(false);
  const bg = selected ? '#0d2035' : hover ? '#1a3a5c' : 'transparent';
  const bl = selected ? '3px solid #ff8c00' : '3px solid transparent';
  const cc = getChangeColor(idx.pctChg);

  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSelect && onSelect(idx)}
      style={{ cursor: 'pointer' }}
    >
      <td style={{ ...S.td, background: bg, borderLeft: bl, color: '#555555', fontSize: '11px', width: '28px', textAlign: 'right' }}>{idx.id})</td>
      <td style={{ ...S.td, background: bg, textAlign: 'left', color: '#b0b0b0' }}>{idx.name}</td>
      <td style={{ ...S.td, background: bg }}>{formatValue(idx.value, 2)}</td>
      <td style={{ ...S.td, background: bg, color: cc }}>{formatChange(idx.netChg, 2)}</td>
      <td style={{ ...S.td, background: bg, color: cc }}>{formatPct(idx.pctChg, 2)}</td>
      <td style={{ ...S.td, background: bg, color: '#888888', fontSize: '11px' }}>{idx.time}</td>
      <td style={{ ...S.td, background: bg, color: getChangeColor(idx.ytd) }}>
        {idx.ytd != null ? formatPct(idx.ytd, 2) : '--'}
      </td>
    </tr>
  );
}

const FILTERS = ['MOVERS', 'VOLATILITY', 'RATIOS', 'PRE-MARKET'];

function applyFilter(rows, filter) {
  if (!rows) return [];
  const copy = [...rows];
  switch (filter) {
    case 'MOVERS':
      return copy.sort((a, b) => Math.abs(b.pctChg || 0) - Math.abs(a.pctChg || 0));
    case 'VOLATILITY':
      return copy.sort((a, b) => Math.abs(b.netChg || 0) - Math.abs(a.netChg || 0));
    default:
      return copy;
  }
}

export default function WorldEquityIndices({ onSelectIndex }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [source, setSource]     = useState('');
  const [activeFilter, setActiveFilter] = useState('MOVERS');
  const [selectedRow, setSelectedRow]   = useState(null);
  const { register, unregister } = useExport();

  useEffect(() => {
    setLoading(true);
    fetchWorldIndices()
      .then(d => {
        const ok = d.americas.some(r => r.value != null);
        if (!ok) throw new Error('No data returned from Yahoo Finance');
        setData(d);
        setSource('YAHOO FINANCE');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (data) {
      const all = [...(data.americas || []), ...(data.emea || []), ...(data.asia || [])];
      register('WORLD_INDICES', 'World Equity Indices', () => {
        const date = new Date().toISOString().split('T')[0];
        const rows = all.map(idx => ({
          symbol: idx.symbol, name: idx.name, value: idx.value,
          net_chg: idx.netChg, pct_chg: idx.pctChg, time: idx.time, ytd: idx.ytd,
        }));
        exportCSV(rows, `world_indices_${date}.csv`);
      });
    } else {
      unregister('WORLD_INDICES');
    }
    return () => unregister('WORLD_INDICES');
  }, [data, register, unregister]);

  const handleSelect = (idx) => {
    setSelectedRow(idx.name);
    if (onSelectIndex) onSelectIndex(idx);
  };

  const regions = data ? [
    { label: '1) AMERICAS',     rows: applyFilter(data.americas, activeFilter) },
    { label: '2) EMEA',         rows: applyFilter(data.emea, activeFilter) },
    { label: '3) ASIA/PACIFIC', rows: applyFilter(data.asia, activeFilter) },
  ] : [];

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.headerTitle}>WEI — WORLD EQUITY INDICES</span>
        <div style={S.headerRight}>
          {loading && <span style={{ color: '#ff8c00' }}>FETCHING...</span>}
          {source && !loading && <span style={{ color: '#00cc00' }}>● {source}</span>}
          {error && !loading && <span style={{ color: '#ff4444' }}>⚠ {error}</span>}
          <span style={{ color: '#555555', fontSize: '10px' }}>
            {activeFilter === 'RATIOS' || activeFilter === 'PRE-MARKET'
              ? `${activeFilter}: DEFAULT ORDER`
              : `SORTED BY ${activeFilter}`}
          </span>
        </div>
      </div>

      <div style={S.toolbar}>
        {FILTERS.map(f => (
          <button key={f} style={S.toolBtn(activeFilter === f)} onClick={() => setActiveFilter(f)}>
            ■ {f}
          </button>
        ))}
      </div>

      {loading && <div style={S.loading}>LOADING WORLD EQUITY INDICES FROM YAHOO FINANCE...</div>}
      {error && !loading && <div style={S.error}>⚠ FAILED TO LOAD: {error}</div>}

      {data && (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '28px' }}>#</th>
              <th style={{ ...S.th, textAlign: 'left', width: '260px' }}>INDEX</th>
              <th style={S.th}>VALUE</th>
              <th style={S.th}>NET CHG</th>
              <th style={S.th}>% CHG</th>
              <th style={S.th}>TIME</th>
              <th style={S.th}>% YTD</th>
            </tr>
          </thead>
          <tbody>
            {regions.map(({ label, rows }) => (
              <React.Fragment key={label}>
                <tr>
                  <td colSpan={7} style={S.regionCell}>{label}</td>
                </tr>
                {rows.map(idx => (
                  <IndexRow
                    key={idx.id}
                    idx={idx}
                    selected={selectedRow === idx.name}
                    onSelect={handleSelect}
                  />
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
