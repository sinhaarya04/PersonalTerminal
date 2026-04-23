import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchYFQuotes } from '../hooks/useYahooFinance';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

const FONT = "'Consolas','Courier New',monospace";

const COMMODITIES = {
  METALS:      [{ s: 'GC=F', n: 'GOLD' }, { s: 'SI=F', n: 'SILVER' }, { s: 'HG=F', n: 'COPPER' }, { s: 'PL=F', n: 'PLATINUM' }],
  ENERGY:      [{ s: 'CL=F', n: 'WTI CRUDE' }, { s: 'BZ=F', n: 'BRENT' }, { s: 'NG=F', n: 'NATURAL GAS' }],
  AGRICULTURE: [{ s: 'ZW=F', n: 'WHEAT' }, { s: 'ZC=F', n: 'CORN' }, { s: 'ZS=F', n: 'SOYBEANS' }, { s: 'KC=F', n: 'COFFEE' }, { s: 'SB=F', n: 'SUGAR' }],
};
const ALL_SYMBOLS = Object.values(COMMODITIES).flat().map(c => c.s);
const NAME_MAP = Object.fromEntries(Object.values(COMMODITIES).flat().map(c => [c.s, c.n]));

const S = {
  container: { padding: 0, background: '#000' },
  header: { background: '#0d0d1a', borderBottom: '2px solid #ff8c00', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#ff8c00', fontFamily: FONT, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  groupHead: { background: '#0a0a14', padding: '4px 8px', fontFamily: FONT, fontSize: 11, color: '#ff8c00', fontWeight: 700, borderTop: '1px solid #222', letterSpacing: 1 },
  row: { display: 'flex', padding: '3px 8px', borderBottom: '1px solid #111', alignItems: 'center' },
  cell: (w) => ({ fontFamily: FONT, fontSize: 11, width: w, textAlign: 'right', color: '#ccc' }),
  loading: { padding: 20, fontFamily: FONT, fontSize: 12, color: '#ff8c00', textAlign: 'center' },
};

function fmt(v) { return v != null ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'; }
function fmtVol(n) { if (!n) return '--'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return String(n); }

export default function CommoditiesTable() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const { register, unregister } = useExport();

  const load = useCallback(async () => {
    try {
      const data = await fetchYFQuotes(ALL_SYMBOLS);
      if (data?.length) setQuotes(data);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, [load]);

  useEffect(() => {
    if (quotes.length) register('COMMODITIES', 'Commodities', () => {
      exportCSV(quotes.map(q => ({ Name: NAME_MAP[q.symbol] || q.symbol, Symbol: q.symbol, Price: q.regularMarketPrice, Change: q.regularMarketChange, 'Change%': q.regularMarketChangePercent, Volume: q.regularMarketVolume })), 'commodities.csv');
    });
    return () => unregister('COMMODITIES');
  }, [quotes, register, unregister]);

  const qMap = useMemo(() => Object.fromEntries(quotes.map(q => [q.symbol, q])), [quotes]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };
  const arrow = (col) => sortCol === col ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  if (loading) return <div style={S.loading}>LOADING COMMODITIES...</div>;

  const renderRow = (sym) => {
    const q = qMap[sym];
    if (!q) return null;
    const chg = q.regularMarketChangePercent;
    const cc = chg > 0 ? '#00cc00' : chg < 0 ? '#ff4444' : '#888';
    return (
      <div key={sym} style={S.row}>
        <span style={{ ...S.cell(120), textAlign: 'left', color: '#ddd', fontWeight: 600 }}>{NAME_MAP[sym]}</span>
        <span style={{ ...S.cell(60), color: '#666', fontSize: 9 }}>{sym}</span>
        <span style={S.cell(90)}>{fmt(q.regularMarketPrice)}</span>
        <span style={{ ...S.cell(80), color: cc }}>{chg != null ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : '--'}</span>
        <span style={{ ...S.cell(80), color: cc }}>{q.regularMarketChange != null ? `${q.regularMarketChange >= 0 ? '+' : ''}${fmt(q.regularMarketChange)}` : '--'}</span>
        <span style={S.cell(80)}>{fmt(q.regularMarketDayHigh)}</span>
        <span style={S.cell(80)}>{fmt(q.regularMarketDayLow)}</span>
        <span style={S.cell(80)}>{fmtVol(q.regularMarketVolume)}</span>
      </div>
    );
  };

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>COMMODITIES</span>
        <span style={{ fontFamily: FONT, fontSize: 10, color: '#666' }}>FUTURES | LIVE</span>
      </div>
      {/* Column headers */}
      <div style={{ ...S.row, background: '#0d0d1a', borderBottom: '1px solid #333' }}>
        <span style={{ ...S.cell(120), textAlign: 'left', color: '#888', cursor: 'pointer' }} onClick={() => handleSort('name')}>NAME{arrow('name')}</span>
        <span style={{ ...S.cell(60), color: '#888' }}>SYMBOL</span>
        <span style={{ ...S.cell(90), color: '#888', cursor: 'pointer' }} onClick={() => handleSort('price')}>PRICE{arrow('price')}</span>
        <span style={{ ...S.cell(80), color: '#888', cursor: 'pointer' }} onClick={() => handleSort('chgPct')}>CHG%{arrow('chgPct')}</span>
        <span style={{ ...S.cell(80), color: '#888' }}>CHG</span>
        <span style={{ ...S.cell(80), color: '#888' }}>HIGH</span>
        <span style={{ ...S.cell(80), color: '#888' }}>LOW</span>
        <span style={{ ...S.cell(80), color: '#888', cursor: 'pointer' }} onClick={() => handleSort('vol')}>VOLUME{arrow('vol')}</span>
      </div>
      {Object.entries(COMMODITIES).map(([group, items]) => (
        <div key={group}>
          <div style={S.groupHead}>{group}</div>
          {items.map(c => renderRow(c.s))}
        </div>
      ))}
    </div>
  );
}
