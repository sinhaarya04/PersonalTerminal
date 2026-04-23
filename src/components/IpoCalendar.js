import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchYFQuotes } from '../hooks/useYahooFinance';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

const FONT = "'Consolas','Courier New',monospace";
const S = {
  container: { padding: 0, background: '#000' },
  header: { background: '#0d0d1a', borderBottom: '2px solid #ff8c00', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#ff8c00', fontFamily: FONT, fontSize: 13, letterSpacing: 1 },
  thRow: { display: 'flex', padding: '3px 8px', background: '#0d0d1a', borderBottom: '1px solid #333' },
  row: { display: 'flex', padding: '3px 8px', borderBottom: '1px solid #111', alignItems: 'center' },
  cell: (w, align) => ({ fontFamily: FONT, fontSize: 11, width: w, textAlign: align || 'right', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  loading: { padding: 20, fontFamily: FONT, fontSize: 12, color: '#ff8c00', textAlign: 'center' },
  badge: (color) => ({ fontFamily: FONT, fontSize: 8, fontWeight: 700, color: '#000', background: color, padding: '1px 5px' }),
};

function fmt(v) { return v != null ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'; }
function fmtCap(n) { if (!n) return '--'; if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'; if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M'; return '$' + n.toLocaleString(); }

export default function IpoCalendar() {
  const [filings, setFilings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const { register, unregister } = useExport();

  const load = useCallback(async () => {
    try {
      // Step 1: Fetch recent S-1 filings from SEC EDGAR
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/sec/LATEST/search-index?q=%22S-1%22&forms=S-1&startdt=${sixMonthsAgo}&enddt=${today}`, { signal: AbortSignal.timeout(15000) });

      if (!res.ok) throw new Error('SEC fetch failed');
      const data = await res.json();
      const hits = data?.hits?.hits || [];

      // Extract filings, prefer ones with tickers
      const seen = new Set();
      const ipoFilings = [];
      for (const h of hits) {
        const src = h._source || {};
        const displayName = (src.display_names || [])[0] || '';
        const tickerMatch = displayName.match(/\(([A-Z]{1,6}(?:,\s*[A-Z]{1,6})*)\)/);
        const ticker = tickerMatch ? tickerMatch[1].split(',')[0].trim() : null;
        const company = displayName.replace(/\s*\([^)]*\)/g, '').trim();
        const key = ticker || company;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        ipoFilings.push({
          ticker: ticker || '--',
          company,
          date: src.file_date || '--',
          form: src.file_type || 'S-1',
          accession: src.adsh,
          location: (src.biz_locations || [])[0] || '--',
        });
      }

      // Step 2: Fetch live prices for the tickers we found
      const tickers = ipoFilings.map(f => f.ticker).filter(t => t !== '--').slice(0, 30);
      let quotes = {};
      if (tickers.length) {
        try {
          const qData = await fetchYFQuotes(tickers);
          if (qData) qData.forEach(q => { quotes[q.symbol] = q; });
        } catch { /* prices optional */ }
      }

      // Step 3: Merge
      setFilings(ipoFilings.map(f => {
        const q = quotes[f.ticker];
        return {
          ...f,
          price: q?.regularMarketPrice,
          changePct: q?.regularMarketChangePercent,
          marketCap: q?.marketCap,
          volume: q?.regularMarketVolume,
          exchange: q?.fullExchangeName || '--',
        };
      }));
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (filings.length) register('IPO_CALENDAR', 'IPO Calendar', () => {
      exportCSV(filings.map(f => ({ Ticker: f.ticker, Company: f.company, FilingDate: f.date, Form: f.form, Price: f.price, 'Change%': f.changePct, MarketCap: f.marketCap, Location: f.location })), 'ipo_calendar.csv');
    });
    return () => unregister('IPO_CALENDAR');
  }, [filings, register, unregister]);

  const handleSort = (col) => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc'); } };
  const arrow = (col) => sortCol === col ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  const sorted = useMemo(() => {
    return [...filings].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (typeof va === 'string') return sortDir === 'asc' ? (va || '').localeCompare(vb || '') : (vb || '').localeCompare(va || '');
      va = va ?? 0; vb = vb ?? 0; return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [filings, sortCol, sortDir]);

  if (loading) return <div style={S.loading}>LOADING IPO FILINGS...</div>;

  const TH = ({ col, label, w, align }) => (
    <span style={{ ...S.cell(w, align), color: '#888', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleSort(col)}>{label}{arrow(col)}</span>
  );

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>IPO CALENDAR</span>
        <span style={{ fontFamily: FONT, fontSize: 10, color: '#666' }}>SEC EDGAR S-1 FILINGS | LAST 6 MONTHS</span>
      </div>
      <div style={S.thRow}>
        <TH col="ticker" label="TICKER" w={70} align="left" />
        <TH col="company" label="COMPANY" w={200} align="left" />
        <TH col="date" label="FILING DATE" w={100} align="left" />
        <span style={{ ...S.cell(60, 'left'), color: '#888', fontWeight: 600 }}>FORM</span>
        <TH col="price" label="PRICE" w={80} />
        <TH col="changePct" label="CHG %" w={70} />
        <TH col="marketCap" label="MKT CAP" w={100} />
        <TH col="location" label="LOCATION" w={140} align="left" />
      </div>
      {sorted.length === 0 && <div style={{ padding: 30, fontFamily: FONT, fontSize: 12, color: '#555', textAlign: 'center' }}>NO S-1 FILINGS FOUND</div>}
      {sorted.map((ipo, i) => {
        const cc = ipo.changePct > 0 ? '#00cc00' : ipo.changePct < 0 ? '#ff4444' : '#888';
        return (
          <div key={i} style={S.row}>
            <span style={{ ...S.cell(70, 'left'), color: '#ff8c00', fontWeight: 700 }}>{ipo.ticker}</span>
            <span style={{ ...S.cell(200, 'left'), color: '#ddd' }}>{ipo.company}</span>
            <span style={{ ...S.cell(100, 'left'), color: '#888' }}>{ipo.date}</span>
            <span style={S.cell(60, 'left')}><span style={S.badge('#9D4EDD')}>{ipo.form}</span></span>
            <span style={S.cell(80)}>{ipo.price ? '$' + fmt(ipo.price) : '--'}</span>
            <span style={{ ...S.cell(70), color: cc }}>{ipo.changePct != null ? `${ipo.changePct >= 0 ? '+' : ''}${ipo.changePct.toFixed(2)}%` : '--'}</span>
            <span style={S.cell(100)}>{fmtCap(ipo.marketCap)}</span>
            <span style={{ ...S.cell(140, 'left'), color: '#666' }}>{ipo.location}</span>
          </div>
        );
      })}
    </div>
  );
}
