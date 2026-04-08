import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { formatChange, getCellStyle } from '../utils/formatting';
import { fetchYFChart } from '../hooks/useYahooFinance';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';
import { getDefaultPeers } from '../data/peerMap';

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
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    marginRight: '4px',
    textTransform: 'uppercase',
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
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: "'Consolas','Courier New',monospace",
  },
  th: {
    background: '#1a1a2e',
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    textAlign: 'right',
    padding: '3px 8px',
    border: '1px solid #333333',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 'normal',
  },
  thFirst: { textAlign: 'left' },
  companyCell: {
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textAlign: 'left',
    padding: '3px 8px',
    border: '1px solid #222222',
    color: '#b0b0b0',
    whiteSpace: 'nowrap',
  },
  tickerBadge: {
    color: '#ffcc00',
    marginRight: '8px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  numCell: {
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textAlign: 'right',
    padding: '3px 8px',
    border: '1px solid #222222',
    fontWeight: 'bold',
  },
  loading: {
    padding: '30px',
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textAlign: 'center',
  },
  error: {
    padding: '20px',
    color: '#ff4444',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textAlign: 'center',
  },
};

const RANGES = { '1M': 21, '3M': 63, '6M': 126, '1Y': 252, '2Y': 504 };
const PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY'];
const GROWTH = ['YOY', 'QOQ', 'MOM'];

// Compute growth columns
function computeGrowth(bars, growthType, numCols) {
  if (!bars || bars.length < 2) return { labels: [], values: [] };

  const labels = [];
  const values = [];

  const step = Math.max(1, Math.floor(bars.length / numCols));

  for (let i = 0; i < numCols; i++) {
    const endIdx = bars.length - 1 - i * step;
    if (endIdx < 0) break;

    const bar = bars[endIdx];
    const d = new Date(bar.t);
    labels.unshift(`${d.getMonth() + 1}/${d.getDate()}`);

    let prevIdx;
    if (growthType === 'YOY') prevIdx = endIdx - 252;
    else if (growthType === 'QOQ') prevIdx = endIdx - 63;
    else prevIdx = endIdx - 21; // MOM

    if (prevIdx >= 0 && bars[prevIdx]) {
      const pct = ((bar.c - bars[prevIdx].c) / bars[prevIdx].c) * 100;
      values.unshift(pct);
    } else {
      values.unshift(null);
    }
  }

  return { labels, values };
}

export default function ComparisonTable({ ticker, allBars }) {
  const [selectedRange, setSelectedRange] = useState('3M');
  const [selectedPeriod, setSelectedPeriod] = useState('WEEKLY');
  const [selectedGrowth, setSelectedGrowth] = useState('YOY');
  const [selectedRow, setSelectedRow] = useState(null);
  const [peerData, setPeerData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { register, unregister } = useExport();

  const activeTicker = ticker || 'SPY';
  const peers = useMemo(() => getDefaultPeers(activeTicker), [activeTicker]);

  // Fetch peer bars
  const fetchPeers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = {};
    try {
      const fetches = peers.map(async (sym) => {
        try {
          const data = await fetchYFChart(sym, '2y', '1d');
          if (data?.bars?.length > 0) result[sym] = data.bars;
        } catch { /* skip failed peer */ }
      });
      await Promise.all(fetches);
      setPeerData(result);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [peers]);

  useEffect(() => { fetchPeers(); }, [fetchPeers]);

  // Build table data
  const tableData = useMemo(() => {
    const rangeDays = RANGES[selectedRange] || 63;
    const numCols = Math.min(8, Math.max(4, Math.floor(rangeDays / (selectedPeriod === 'MONTHLY' ? 21 : selectedPeriod === 'WEEKLY' ? 5 : 1))));

    const companies = [];

    // Main ticker
    if (allBars?.length > 0) {
      const { labels, values } = computeGrowth(allBars.slice(-(rangeDays + 252)), selectedGrowth, numCols);
      companies.push({ ticker: activeTicker, name: activeTicker, values, isMain: true });
      if (companies.length === 1) companies[0]._labels = labels;
    }

    // Peers
    peers.forEach(sym => {
      const bars = peerData[sym];
      if (!bars || bars.length < 10) return;
      const { values } = computeGrowth(bars.slice(-(RANGES[selectedRange] + 252)), selectedGrowth, numCols);
      companies.push({ ticker: sym, name: sym, values, isMain: false });
    });

    const labels = companies[0]?._labels || [];
    return { companies, labels };
  }, [allBars, peerData, selectedRange, selectedPeriod, selectedGrowth, activeTicker, peers]);

  useEffect(() => {
    if (tableData.companies.length > 0) {
      register('PEER_COMPARISON', `Peer Comparison (${activeTicker})`, () => {
        const date = new Date().toISOString().split('T')[0];
        const headers = ['ticker', ...tableData.labels];
        const rows = tableData.companies.map(co => {
          const row = { ticker: co.ticker };
          tableData.labels.forEach((label, i) => {
            row[label] = co.values[i] != null ? co.values[i].toFixed(2) + '%' : '';
          });
          return row;
        });
        exportCSV(rows, `${activeTicker}_peers_${date}.csv`, headers);
      });
    } else {
      unregister('PEER_COMPARISON');
    }
    return () => unregister('PEER_COMPARISON');
  }, [tableData, activeTicker, register, unregister]);

  if (loading && Object.keys(peerData).length === 0) {
    return <div style={S.loading}>LOADING PEER COMPARISON DATA FOR {activeTicker}...</div>;
  }

  const growthLabel = selectedGrowth === 'YOY' ? 'Year-over-Year' : selectedGrowth === 'QOQ' ? 'Quarter-over-Quarter' : 'Month-over-Month';

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.headerTitle}>
          {activeTicker} PEER COMPARISON — {growthLabel} GROWTH %
        </span>
        <span style={S.headerSub}>
          {loading ? 'UPDATING...' : `${tableData.companies.length} TICKERS · YAHOO FINANCE`}
          {error && <span style={{ color: '#ff4444', marginLeft: '8px' }}>⚠ {error}</span>}
        </span>
      </div>

      <div style={S.toolbar}>
        <div style={S.toolGroup}>
          <span style={S.toolLabel}>GROWTH:</span>
          {GROWTH.map(g => (
            <button key={g} style={S.toolBtn(selectedGrowth === g)} onClick={() => setSelectedGrowth(g)}>
              {g}
            </button>
          ))}
        </div>
        <div style={S.toolGroup}>
          <span style={S.toolLabel}>PERIOD:</span>
          {PERIODS.map(p => (
            <button key={p} style={S.toolBtn(selectedPeriod === p)} onClick={() => setSelectedPeriod(p)}>
              {p}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
          {Object.keys(RANGES).map(r => (
            <button key={r} style={S.toolBtn(selectedRange === r)} onClick={() => setSelectedRange(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <table style={S.table}>
        <thead>
          <tr>
            <th style={{ ...S.th, ...S.thFirst }}>COMPANY</th>
            {tableData.labels.map((w, i) => (
              <th key={i} style={S.th}>{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.companies.map((co, i) => {
            const isSelected = selectedRow === co.ticker;
            return (
              <tr
                key={co.ticker}
                onClick={() => setSelectedRow(isSelected ? null : co.ticker)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{
                  ...S.companyCell,
                  background: isSelected ? '#0d2035' : co.isMain ? '#0d1520' : (i % 2 === 0 ? '#000000' : '#0d0d1a'),
                  borderLeft: isSelected ? '3px solid #ff8c00' : co.isMain ? '3px solid #ffcc00' : '3px solid transparent',
                }}>
                  <span style={S.tickerBadge}>{co.ticker}</span>
                  <span style={{ color: '#888888' }}>{co.name !== co.ticker ? co.name : ''}</span>
                  {co.isMain && <span style={{ color: '#ff8c00', marginLeft: '6px', fontSize: '10px' }}>◉</span>}
                </td>
                {co.values.map((v, j) => (
                  <td key={j} style={{ ...S.numCell, ...getCellStyle(v) }}>
                    {v !== null ? `${formatChange(v, 2)}%` : '--'}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {tableData.companies.length === 0 && !loading && (
        <div style={S.error}>NO COMPARISON DATA AVAILABLE</div>
      )}
    </div>
  );
}
