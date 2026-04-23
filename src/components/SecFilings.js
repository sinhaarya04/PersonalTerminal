import React, { useState, useCallback } from 'react';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

const FONT = "'Consolas','Courier New',monospace";
const FORMS = ['ALL', '10-K', '10-Q', '8-K', 'S-1', '4', '13F-HR'];
const FORM_COLORS = { '10-K': '#ff8c00', '10-Q': '#ffcc00', '8-K': '#00cc00', 'S-1': '#9D4EDD', '4': '#00cccc', '13F-HR': '#2563eb' };

const S = {
  container: { padding: 0, background: '#000' },
  header: { background: '#0d0d1a', borderBottom: '2px solid #ff8c00', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { color: '#ff8c00', fontFamily: FONT, fontSize: 13, letterSpacing: 1 },
  search: { background: '#111', border: '1px solid #333', color: '#ddd', fontFamily: FONT, fontSize: 11, padding: '2px 8px', width: 200, outline: 'none' },
  btn: (active) => ({ background: active ? '#1a1a2e' : 'transparent', border: `1px solid ${active ? '#ff8c00' : '#333'}`, color: active ? '#ff8c00' : '#666', fontFamily: FONT, fontSize: 9, padding: '2px 8px', cursor: 'pointer' }),
  go: { background: '#ff8c00', border: 'none', color: '#000', fontFamily: FONT, fontSize: 11, fontWeight: 700, padding: '2px 12px', cursor: 'pointer' },
  thRow: { display: 'flex', padding: '3px 8px', background: '#0d0d1a', borderBottom: '1px solid #333' },
  row: { display: 'flex', padding: '4px 8px', borderBottom: '1px solid #111', alignItems: 'center' },
  cell: (w, align) => ({ fontFamily: FONT, fontSize: 11, width: w, textAlign: align || 'right', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  loading: { padding: 20, fontFamily: FONT, fontSize: 12, color: '#ff8c00', textAlign: 'center' },
  hint: { padding: 40, fontFamily: FONT, fontSize: 12, color: '#555', textAlign: 'center' },
};

export default function SecFilings() {
  const [query, setQuery] = useState('');
  const [formFilter, setFormFilter] = useState('ALL');
  const [filings, setFilings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { register, unregister } = useExport();

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const forms = formFilter === 'ALL' ? '10-K,10-Q,8-K,S-1,4,13F-HR' : formFilter;
      const res = await fetch(`/sec/LATEST/search-index?q=${encodeURIComponent(query.trim())}&forms=${forms}&dateRange=custom&startdt=2024-01-01&enddt=2026-12-31`, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const data = await res.json();
        const hits = data?.hits?.hits || [];
        setFilings(hits.map(h => ({
          date: h._source?.file_date || h._source?.period_of_report || '--',
          company: h._source?.entity_name || '--',
          ticker: (h._source?.tickers || []).join(', '),
          form: h._source?.form_type || '--',
          title: h._source?.file_description || h._source?.entity_name || '--',
          url: h._id ? `https://www.sec.gov/Archives/edgar/data/${h._source?.entity_id}/${h._id.replace(/-/g, '')}/${h._id}-index.htm` : null,
          accession: h._id,
        })));
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [query, formFilter]);

  // Re-register export when filings change
  React.useEffect(() => {
    if (filings.length) register('SEC_FILINGS', 'SEC Filings', () => {
      exportCSV(filings.map(f => ({ Date: f.date, Company: f.company, Ticker: f.ticker, Form: f.form, Title: f.title })), 'sec_filings.csv');
    });
    return () => unregister('SEC_FILINGS');
  }, [filings, register, unregister]);

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>SEC FILINGS</span>
        <input placeholder="TICKER OR COMPANY..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} style={S.search} />
        <button onClick={search} style={S.go}>SEARCH</button>
        <div style={{ display: 'flex', gap: 3 }}>
          {FORMS.map(f => <button key={f} style={S.btn(formFilter === f)} onClick={() => setFormFilter(f)}>{f}</button>)}
        </div>
      </div>

      {!searched && <div style={S.hint}>ENTER A TICKER OR COMPANY NAME TO SEARCH SEC EDGAR FILINGS</div>}
      {loading && <div style={S.loading}>SEARCHING SEC EDGAR...</div>}

      {searched && !loading && (
        <>
          <div style={S.thRow}>
            <span style={{ ...S.cell(90, 'left'), color: '#888', fontWeight: 600 }}>DATE</span>
            <span style={{ ...S.cell(200, 'left'), color: '#888', fontWeight: 600 }}>COMPANY</span>
            <span style={{ ...S.cell(70, 'left'), color: '#888', fontWeight: 600 }}>TICKER</span>
            <span style={{ ...S.cell(70, 'left'), color: '#888', fontWeight: 600 }}>FORM</span>
            <span style={{ ...S.cell(300, 'left'), color: '#888', fontWeight: 600 }}>TITLE</span>
          </div>
          {filings.length === 0 && <div style={S.hint}>NO FILINGS FOUND</div>}
          {filings.map((f, i) => (
            <div key={i} style={S.row}
              onClick={() => f.url && window.open(f.url, '_blank')}
              onMouseEnter={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.cursor = 'pointer'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ ...S.cell(90, 'left'), color: '#888' }}>{f.date}</span>
              <span style={{ ...S.cell(200, 'left'), color: '#ddd' }}>{f.company}</span>
              <span style={{ ...S.cell(70, 'left'), color: '#ff8c00', fontWeight: 600 }}>{f.ticker}</span>
              <span style={{ ...S.cell(70, 'left'), color: FORM_COLORS[f.form] || '#888', fontWeight: 700 }}>{f.form}</span>
              <span style={{ ...S.cell(300, 'left'), color: '#aaa' }}>{f.title}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
