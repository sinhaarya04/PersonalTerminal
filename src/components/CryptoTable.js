import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

const FONT = "'Consolas','Courier New',monospace";
const S = {
  container: { padding: 0, background: '#000' },
  header: { background: '#0d0d1a', borderBottom: '2px solid #ff8c00', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#ff8c00', fontFamily: FONT, fontSize: 13, letterSpacing: 1 },
  search: { background: '#111', border: '1px solid #333', color: '#ddd', fontFamily: FONT, fontSize: 11, padding: '2px 8px', width: 180, outline: 'none' },
  thRow: { display: 'flex', padding: '3px 8px', background: '#0d0d1a', borderBottom: '1px solid #333' },
  row: { display: 'flex', padding: '3px 8px', borderBottom: '1px solid #111', alignItems: 'center' },
  cell: (w, align) => ({ fontFamily: FONT, fontSize: 11, width: w, textAlign: align || 'right', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  loading: { padding: 20, fontFamily: FONT, fontSize: 12, color: '#ff8c00', textAlign: 'center' },
};

function fmtPrice(v) { if (v == null) return '--'; if (v >= 1) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return v.toPrecision(4); }
function fmtLarge(n) { if (!n) return '--'; if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'; if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'; return '$' + n.toLocaleString(); }

function Sparkline({ prices, color }) {
  if (!prices || prices.length < 2) return null;
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const w = 80, h = 24;
  const pts = prices.map((p, i) => `${(i / (prices.length - 1)) * w},${h - ((p - min) / range) * h}`).join(' ');
  return <svg width={w} height={h} style={{ verticalAlign: 'middle' }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1" /></svg>;
}

export default function CryptoTable() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('market_cap');
  const [sortDir, setSortDir] = useState('desc');
  const { register, unregister } = useExport();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/coingecko/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&sparkline=true&price_change_percentage=7d', { signal: AbortSignal.timeout(15000) });
      if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setCoins(data); }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, [load]);

  useEffect(() => {
    if (coins.length) register('CRYPTO_MARKETS', 'Crypto Markets', () => {
      exportCSV(coins.map(c => ({ Rank: c.market_cap_rank, Coin: c.name, Symbol: c.symbol?.toUpperCase(), Price: c.current_price, '24h%': c.price_change_percentage_24h, '7d%': c.price_change_percentage_7d_in_currency, MarketCap: c.market_cap, Volume: c.total_volume })), 'crypto_markets.csv');
    });
    return () => unregister('CRYPTO_MARKETS');
  }, [coins, register, unregister]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };
  const arrow = (col) => sortCol === col ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  const filtered = useMemo(() => {
    let list = coins;
    if (search) { const s = search.toLowerCase(); list = list.filter(c => c.name?.toLowerCase().includes(s) || c.symbol?.toLowerCase().includes(s)); }
    return [...list].sort((a, b) => { const va = a[sortCol] ?? 0, vb = b[sortCol] ?? 0; return sortDir === 'asc' ? va - vb : vb - va; });
  }, [coins, search, sortCol, sortDir]);

  if (loading) return <div style={S.loading}>LOADING CRYPTO MARKETS...</div>;

  const TH = ({ col, label, w, align }) => (
    <span style={{ ...S.cell(w, align), color: '#888', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleSort(col)}>{label}{arrow(col)}</span>
  );

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>CRYPTO MARKETS</span>
        <input placeholder="SEARCH..." value={search} onChange={e => setSearch(e.target.value)} style={S.search} />
      </div>
      <div style={S.thRow}>
        <TH col="market_cap_rank" label="#" w={30} align="left" />
        <TH col="name" label="COIN" w={130} align="left" />
        <TH col="current_price" label="PRICE" w={100} />
        <TH col="price_change_percentage_24h" label="24H %" w={70} />
        <TH col="price_change_percentage_7d_in_currency" label="7D %" w={70} />
        <TH col="market_cap" label="MKT CAP" w={100} />
        <TH col="total_volume" label="VOLUME 24H" w={100} />
        <span style={{ ...S.cell(90), color: '#888' }}>7D CHART</span>
      </div>
      {filtered.map(c => {
        const d = c.price_change_percentage_24h;
        const d7 = c.price_change_percentage_7d_in_currency;
        const cc = v => v > 0 ? '#00cc00' : v < 0 ? '#ff4444' : '#888';
        return (
          <div key={c.id} style={S.row}>
            <span style={{ ...S.cell(30, 'left'), color: '#666' }}>{c.market_cap_rank}</span>
            <span style={{ ...S.cell(130, 'left'), color: '#ddd', fontWeight: 600 }}>
              <span style={{ color: '#ff8c00', marginRight: 4 }}>{c.symbol?.toUpperCase()}</span>{c.name}
            </span>
            <span style={S.cell(100)}>${fmtPrice(c.current_price)}</span>
            <span style={{ ...S.cell(70), color: cc(d) }}>{d != null ? `${d >= 0 ? '+' : ''}${d.toFixed(2)}%` : '--'}</span>
            <span style={{ ...S.cell(70), color: cc(d7) }}>{d7 != null ? `${d7 >= 0 ? '+' : ''}${d7.toFixed(2)}%` : '--'}</span>
            <span style={S.cell(100)}>{fmtLarge(c.market_cap)}</span>
            <span style={S.cell(100)}>{fmtLarge(c.total_volume)}</span>
            <span style={S.cell(90)}><Sparkline prices={c.sparkline_in_7d?.price} color={d7 >= 0 ? '#00cc00' : '#ff4444'} /></span>
          </div>
        );
      })}
    </div>
  );
}
