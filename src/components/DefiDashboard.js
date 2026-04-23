import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

const FONT = "'Consolas','Courier New',monospace";
const S = {
  container: { padding: 0, background: '#000' },
  header: { background: '#0d0d1a', borderBottom: '2px solid #ff8c00', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { color: '#ff8c00', fontFamily: FONT, fontSize: 13, letterSpacing: 1 },
  search: { background: '#111', border: '1px solid #333', color: '#ddd', fontFamily: FONT, fontSize: 11, padding: '2px 8px', width: 160, outline: 'none' },
  toggle: (active) => ({ background: active ? '#1a1a2e' : 'transparent', border: `1px solid ${active ? '#ff8c00' : '#333'}`, color: active ? '#ff8c00' : '#666', fontFamily: FONT, fontSize: 10, padding: '2px 10px', cursor: 'pointer' }),
  thRow: { display: 'flex', padding: '3px 8px', background: '#0d0d1a', borderBottom: '1px solid #333' },
  row: { display: 'flex', padding: '3px 8px', borderBottom: '1px solid #111', alignItems: 'center' },
  cell: (w, align) => ({ fontFamily: FONT, fontSize: 11, width: w, textAlign: align || 'right', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  loading: { padding: 20, fontFamily: FONT, fontSize: 12, color: '#ff8c00', textAlign: 'center' },
};

function fmtTvl(n) { if (!n) return '--'; if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'; if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'; return '$' + Math.round(n); }

export default function DefiDashboard() {
  const [protocols, setProtocols] = useState([]);
  const [chains, setChains] = useState([]);
  const [view, setView] = useState('PROTOCOLS');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('tvl');
  const [sortDir, setSortDir] = useState('desc');
  const { register, unregister } = useExport();

  const load = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.allSettled([
        fetch('/defillama/protocols', { signal: AbortSignal.timeout(15000) }),
        fetch('/defillama/v2/chains', { signal: AbortSignal.timeout(15000) }),
      ]);
      if (pRes.status === 'fulfilled' && pRes.value.ok) { const d = await pRes.value.json(); if (Array.isArray(d)) setProtocols(d.slice(0, 100)); }
      if (cRes.status === 'fulfilled' && cRes.value.ok) { const d = await cRes.value.json(); if (Array.isArray(d)) setChains(d); }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const data = view === 'PROTOCOLS' ? protocols : chains;
    if (data.length) register('DEFI_DATA', `DeFi ${view}`, () => {
      exportCSV(data.map(d => ({ Name: d.name, TVL: d.tvl, Chain: d.chain || d.name, Category: d.category || '--' })), `defi_${view.toLowerCase()}.csv`);
    });
    return () => unregister('DEFI_DATA');
  }, [protocols, chains, view, register, unregister]);

  const handleSort = (col) => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc'); } };
  const arrow = (col) => sortCol === col ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  const totalTvl = useMemo(() => protocols.reduce((s, p) => s + (p.tvl || 0), 0), [protocols]);

  const filtered = useMemo(() => {
    const data = view === 'PROTOCOLS' ? protocols : chains;
    let list = data;
    if (search) { const s = search.toLowerCase(); list = list.filter(d => d.name?.toLowerCase().includes(s)); }
    return [...list].sort((a, b) => { const va = a[sortCol] ?? 0, vb = b[sortCol] ?? 0; return sortDir === 'asc' ? va - vb : vb - va; });
  }, [view, protocols, chains, search, sortCol, sortDir]);

  if (loading) return <div style={S.loading}>LOADING DEFI DATA...</div>;

  const TH = ({ col, label, w, align }) => (
    <span style={{ ...S.cell(w, align), color: '#888', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleSort(col)}>{label}{arrow(col)}</span>
  );
  const cc = v => v > 0 ? '#00cc00' : v < 0 ? '#ff4444' : '#888';

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>DEFI DASHBOARD</span>
        <span style={{ fontFamily: FONT, fontSize: 11, color: '#00cc00' }}>TOTAL TVL: {fmtTvl(totalTvl)}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={S.toggle(view === 'PROTOCOLS')} onClick={() => setView('PROTOCOLS')}>PROTOCOLS</button>
          <button style={S.toggle(view === 'CHAINS')} onClick={() => setView('CHAINS')}>CHAINS</button>
        </div>
        <input placeholder="SEARCH..." value={search} onChange={e => setSearch(e.target.value)} style={S.search} />
      </div>
      {view === 'PROTOCOLS' ? (
        <>
          <div style={S.thRow}>
            <TH col="name" label="PROTOCOL" w={160} align="left" />
            <TH col="chain" label="CHAIN" w={100} align="left" />
            <TH col="category" label="CATEGORY" w={100} align="left" />
            <TH col="tvl" label="TVL" w={120} />
            <TH col="change_1d" label="1D %" w={70} />
            <TH col="change_7d" label="7D %" w={70} />
          </div>
          {filtered.slice(0, 50).map((p, i) => (
            <div key={p.slug || i} style={S.row}>
              <span style={{ ...S.cell(160, 'left'), color: '#ddd', fontWeight: 600 }}>{p.name}</span>
              <span style={{ ...S.cell(100, 'left'), color: '#888' }}>{p.chain || 'Multi'}</span>
              <span style={{ ...S.cell(100, 'left'), color: '#666' }}>{p.category || '--'}</span>
              <span style={S.cell(120)}>{fmtTvl(p.tvl)}</span>
              <span style={{ ...S.cell(70), color: cc(p.change_1d) }}>{p.change_1d != null ? `${p.change_1d >= 0 ? '+' : ''}${p.change_1d.toFixed(2)}%` : '--'}</span>
              <span style={{ ...S.cell(70), color: cc(p.change_7d) }}>{p.change_7d != null ? `${p.change_7d >= 0 ? '+' : ''}${p.change_7d.toFixed(2)}%` : '--'}</span>
            </div>
          ))}
        </>
      ) : (
        <>
          <div style={S.thRow}>
            <TH col="name" label="CHAIN" w={160} align="left" />
            <TH col="tvl" label="TVL" w={140} />
            <TH col="tokenSymbol" label="TOKEN" w={80} align="left" />
          </div>
          {filtered.slice(0, 30).map((c, i) => (
            <div key={c.gecko_id || i} style={S.row}>
              <span style={{ ...S.cell(160, 'left'), color: '#ddd', fontWeight: 600 }}>{c.name}</span>
              <span style={S.cell(140)}>{fmtTvl(c.tvl)}</span>
              <span style={{ ...S.cell(80, 'left'), color: '#ff8c00' }}>{c.tokenSymbol || '--'}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
