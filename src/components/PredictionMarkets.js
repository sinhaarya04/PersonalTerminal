import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

const FONT = "'Consolas','Courier New',monospace";
const S = {
  container: { padding: 0, background: '#000' },
  header: { background: '#0d0d1a', borderBottom: '2px solid #ff8c00', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#ff8c00', fontFamily: FONT, fontSize: 13, letterSpacing: 1 },
  search: { background: '#111', border: '1px solid #333', color: '#ddd', fontFamily: FONT, fontSize: 11, padding: '2px 8px', width: 200, outline: 'none' },
  thRow: { display: 'flex', padding: '3px 8px', background: '#0d0d1a', borderBottom: '1px solid #333' },
  row: { display: 'flex', padding: '5px 8px', borderBottom: '1px solid #111', alignItems: 'center', cursor: 'pointer' },
  cell: (w, align) => ({ fontFamily: FONT, fontSize: 11, width: w, textAlign: align || 'right', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  loading: { padding: 20, fontFamily: FONT, fontSize: 12, color: '#ff8c00', textAlign: 'center' },
};

function fmtVol(n) { if (!n) return '--'; n = Number(n); if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'; return '$' + n.toFixed(0); }

export default function PredictionMarkets() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('volume');
  const [sortDir, setSortDir] = useState('desc');
  const { register, unregister } = useExport();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/polymarket/events?closed=false&order=volume24hr&ascending=false&limit=50', { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const data = await res.json();
        const list = (Array.isArray(data) ? data : data?.data || []).map(ev => {
          const m = ev.markets?.[0] || {};
          return {
            title: ev.title || m.question || '--',
            yesPrice: m.outcomePrices ? JSON.parse(m.outcomePrices)[0] : m.bestAsk,
            volume: Number(m.volume || ev.volume || 0),
            volume24hr: Number(m.volume24hr || 0),
            liquidity: Number(m.liquidity || 0),
            url: ev.slug ? `https://polymarket.com/event/${ev.slug}` : null,
          };
        });
        setEvents(list);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 120000); return () => clearInterval(id); }, [load]);

  useEffect(() => {
    if (events.length) register('PREDICTION_MARKETS', 'Prediction Markets', () => {
      exportCSV(events.map(e => ({ Event: e.title, 'Yes%': ((e.yesPrice || 0) * 100).toFixed(1), Volume24h: e.volume24hr, TotalVolume: e.volume })), 'prediction_markets.csv');
    });
    return () => unregister('PREDICTION_MARKETS');
  }, [events, register, unregister]);

  const handleSort = (col) => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc'); } };
  const arrow = (col) => sortCol === col ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  const filtered = useMemo(() => {
    let list = events;
    if (search) { const s = search.toLowerCase(); list = list.filter(e => e.title?.toLowerCase().includes(s)); }
    return [...list].sort((a, b) => { const va = a[sortCol] ?? 0, vb = b[sortCol] ?? 0; return sortDir === 'asc' ? va - vb : vb - va; });
  }, [events, search, sortCol, sortDir]);

  if (loading) return <div style={S.loading}>LOADING PREDICTION MARKETS...</div>;

  const TH = ({ col, label, w, align }) => (
    <span style={{ ...S.cell(w, align), color: '#888', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleSort(col)}>{label}{arrow(col)}</span>
  );

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>PREDICTION MARKETS</span>
        <span style={{ fontFamily: FONT, fontSize: 9, color: '#666' }}>POLYMARKET</span>
        <input placeholder="SEARCH EVENTS..." value={search} onChange={e => setSearch(e.target.value)} style={S.search} />
      </div>
      <div style={S.thRow}>
        <TH col="title" label="EVENT" w={400} align="left" />
        <TH col="yesPrice" label="YES" w={70} />
        <span style={{ ...S.cell(70), color: '#888', fontWeight: 600 }}>NO</span>
        <TH col="volume24hr" label="24H VOL" w={100} />
        <TH col="volume" label="TOTAL VOL" w={100} />
        <TH col="liquidity" label="LIQUIDITY" w={100} />
      </div>
      {filtered.map((e, i) => {
        const yes = Number(e.yesPrice) || 0;
        const no = 1 - yes;
        return (
          <div key={i} style={S.row}
            onClick={() => e.url && window.open(e.url, '_blank')}
            onMouseEnter={ev => { ev.currentTarget.style.background = '#111'; }}
            onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ ...S.cell(400, 'left'), color: '#ddd' }}>{e.title}</span>
            <span style={{ ...S.cell(70), color: yes > 0.5 ? '#00cc00' : '#ff8c00', fontWeight: 700 }}>{(yes * 100).toFixed(1)}%</span>
            <span style={{ ...S.cell(70), color: no > 0.5 ? '#ff4444' : '#888' }}>{(no * 100).toFixed(1)}%</span>
            <span style={S.cell(100)}>{fmtVol(e.volume24hr)}</span>
            <span style={S.cell(100)}>{fmtVol(e.volume)}</span>
            <span style={S.cell(100)}>{fmtVol(e.liquidity)}</span>
          </div>
        );
      })}
    </div>
  );
}
