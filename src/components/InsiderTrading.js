import React, { useState, useCallback } from 'react';

const FONT = "'Consolas','Courier New',monospace";

const S = {
  container: { background: '#000', fontFamily: FONT, minHeight: '100%' },
  header: {
    background: '#0d0d1a', borderBottom: '2px solid #ff8c00',
    padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  },
  title: { color: '#ff8c00', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, fontFamily: FONT },
  input: {
    fontFamily: FONT, fontSize: 11, background: '#000', color: '#ffcc00',
    border: '1px solid #333', borderRadius: 2, padding: '3px 8px', outline: 'none', width: 80,
  },
  btn: {
    fontFamily: FONT, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase',
    cursor: 'pointer', border: '1px solid #ff8c00', borderRadius: 2,
    padding: '4px 14px', background: '#ff8c00', color: '#000', fontWeight: 'bold',
  },
  loading: { padding: 40, color: '#ff8c00', fontFamily: FONT, fontSize: 13, textAlign: 'center', textTransform: 'uppercase' },
  error: { padding: 20, color: '#ff4444', fontFamily: FONT, fontSize: 12, textAlign: 'center' },
  hint: { padding: 40, fontFamily: FONT, fontSize: 12, color: '#555', textAlign: 'center' },
  sectionHeader: {
    background: '#0d0d1a', borderBottom: '1px solid #333', borderTop: '1px solid #333',
    padding: '4px 10px', color: '#ff8c00', fontSize: 11, fontFamily: FONT,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  cards: { display: 'flex', gap: 8, padding: '10px', flexWrap: 'wrap' },
  card: {
    flex: '1 1 140px', background: '#0d0d1a', border: '1px solid #333',
    borderRadius: 2, padding: '8px 12px', minWidth: 130,
  },
  cardLabel: { color: '#888', fontSize: 9, textTransform: 'uppercase', fontFamily: FONT, letterSpacing: 0.5 },
  cardValue: (color) => ({ color: color || '#fff', fontSize: 15, fontFamily: FONT, fontWeight: 'bold', marginTop: 2 }),
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: FONT },
  th: {
    background: '#1a1a2e', color: '#ff8c00', fontFamily: FONT, fontSize: 10,
    textAlign: 'left', padding: '3px 8px', border: '1px solid #333',
    textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 'normal',
  },
  td: {
    fontFamily: FONT, fontSize: 11, textAlign: 'left', padding: '3px 8px',
    border: '1px solid #222', color: '#ccc',
  },
  svgSection: { padding: '8px 10px' },
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtPrice(n) {
  if (n == null || isNaN(n)) return '--';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Fetch price/name from v8/chart ──────────────────────────────────────────
async function fetchChartMeta(ticker) {
  const res = await fetch(
    `/yf/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d&includePrePost=false`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta) return null;
  return {
    name: meta.shortName || meta.longName || meta.symbol || ticker,
    price: meta.regularMarketPrice ?? null,
    prevClose: meta.chartPreviousClose ?? null,
  };
}

// ── Fetch Form 4 filings from SEC EDGAR ─────────────────────────────────────
async function fetchForm4Filings(ticker) {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const res = await fetch(
    `/sec/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22&forms=4&dateRange=custom&startdt=${startDate}&enddt=${endDate}`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) throw new Error(`SEC EDGAR ${res.status}`);
  const json = await res.json();
  const hits = json?.hits?.hits || [];

  return hits.map(h => {
    const src = h._source || {};
    return {
      date: src.file_date || src.period_of_report || '--',
      insiderName: (src.display_names || []).join(', ') || src.entity_name || '--',
      company: src.entity_name || '--',
      form: src.form_type || '4',
      description: src.file_description || 'Statement of Changes in Beneficial Ownership',
      url: h._id
        ? `https://www.sec.gov/Archives/edgar/data/${src.entity_id}/${h._id.replace(/-/g, '')}/${h._id}-index.htm`
        : null,
      accession: h._id || null,
      periodOfReport: src.period_of_report || null,
    };
  });
}

// ── Filing Timeline SVG ─────────────────────────────────────────────────────
function FilingTimeline({ filings }) {
  if (!filings || filings.length < 2) return null;

  const W = 760, H = 120;
  const padL = 50, padR = 20, padT = 20, padB = 30;
  const chartW = W - padL - padR;

  // Parse dates
  const dots = filings.map(f => {
    const dateStr = f.date !== '--' ? f.date : f.periodOfReport;
    if (!dateStr) return null;
    const epoch = new Date(dateStr).getTime();
    if (isNaN(epoch)) return null;
    return { epoch, name: f.insiderName, date: dateStr };
  }).filter(Boolean);

  if (dots.length < 2) return null;

  const minT = Math.min(...dots.map(d => d.epoch));
  const maxT = Math.max(...dots.map(d => d.epoch));
  const tRange = maxT - minT || 1;

  const xAt = (epoch) => padL + ((epoch - minT) / tRange) * chartW;

  // Count filings per month for a histogram-like view
  const months = {};
  dots.forEach(d => {
    const key = new Date(d.epoch).toISOString().slice(0, 7);
    months[key] = (months[key] || 0) + 1;
  });
  const monthEntries = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
  const maxCount = Math.max(...monthEntries.map(e => e[1]), 1);
  const barH = H - padT - padB - 10;

  return (
    <div style={S.svgSection}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        {/* Axes */}
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#333" strokeWidth={1} />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#333" strokeWidth={1} />

        {/* Date labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const epoch = minT + tRange * pct;
          const dt = new Date(epoch);
          const label = dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          return (
            <text key={i} x={padL + pct * chartW} y={H - 8} fill="#555" fontSize={8} fontFamily={FONT} textAnchor="middle">
              {label}
            </text>
          );
        })}

        {/* Monthly filing bars */}
        {monthEntries.map(([monthKey, count], i) => {
          const epochMid = new Date(monthKey + '-15').getTime();
          const cx = xAt(epochMid);
          const bHeight = (count / maxCount) * barH;
          return (
            <g key={monthKey}>
              <rect
                x={cx - 8} y={padT + barH - bHeight}
                width={16} height={bHeight}
                fill="#00cccc" opacity={0.6} rx={1}
              />
              <text x={cx} y={padT + barH - bHeight - 4} fill="#00cccc" fontSize={8} fontFamily={FONT} textAnchor="middle">
                {count}
              </text>
            </g>
          );
        })}

        {/* Dots for each filing */}
        {dots.map((d, i) => {
          const cx = xAt(d.epoch);
          return (
            <circle key={i} cx={cx} cy={H - padB - 2} r={3} fill="#ff8c00" opacity={0.7} />
          );
        })}

        {/* Legend */}
        <rect x={padL + 10} y={4} width={8} height={8} fill="#00cccc" opacity={0.6} rx={1} />
        <text x={padL + 22} y={11} fill="#888" fontSize={8} fontFamily={FONT}>FILINGS / MONTH</text>
      </svg>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function InsiderTrading() {
  const [ticker, setTicker] = useState('AAPL');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = useCallback(async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const sym = ticker.trim().toUpperCase();
      const [chartMeta, filings] = await Promise.all([
        fetchChartMeta(sym).catch(() => null),
        fetchForm4Filings(sym),
      ]);
      setData({ chartMeta, filings, ticker: sym });
    } catch (e) {
      setError(e.message || 'Failed to fetch insider data');
      setData(null);
    }
    setLoading(false);
  }, [ticker]);

  const companyName = data?.chartMeta?.name || data?.ticker || ticker.toUpperCase();
  const price = data?.chartMeta?.price;
  const prevClose = data?.chartMeta?.prevClose;
  const change = price != null && prevClose != null ? price - prevClose : null;
  const changePct = change != null && prevClose ? (change / prevClose) * 100 : null;
  const filings = data?.filings || [];

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>INSIDER TRADING {data ? ' \u2014 ' + data.ticker : ''}</span>
        <input
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="TICKER"
          style={S.input}
        />
        <button onClick={search} style={S.btn}>SEARCH</button>
        {data && <span style={{ color: '#555', fontSize: 10, fontFamily: FONT }}>{companyName}</span>}
      </div>

      {/* States */}
      {loading && <div style={S.loading}>SEARCHING SEC EDGAR...</div>}
      {error && <div style={S.error}>ERROR: {error}</div>}
      {!loading && !error && !data && <div style={S.hint}>ENTER A TICKER TO VIEW INSIDER TRADING ACTIVITY (SEC FORM 4 FILINGS)</div>}

      {data && (
        <>
          {/* Summary Cards */}
          <div style={S.cards}>
            <div style={S.card}>
              <div style={S.cardLabel}>COMPANY</div>
              <div style={S.cardValue('#ffcc00')}>{companyName}</div>
            </div>
            <div style={S.card}>
              <div style={S.cardLabel}>CURRENT PRICE</div>
              <div style={S.cardValue('#00ff41')}>
                {price != null ? fmtPrice(price) : '--'}
                {changePct != null && (
                  <span style={{ fontSize: 10, color: changePct >= 0 ? '#00ff41' : '#ff4444', marginLeft: 6 }}>
                    {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
            <div style={S.card}>
              <div style={S.cardLabel}>FORM 4 FILINGS (12MO)</div>
              <div style={S.cardValue('#ff8c00')}>{filings.length}</div>
            </div>
          </div>

          {/* Recent Form 4 Filings Table */}
          <div style={S.sectionHeader}>RECENT SEC FORM 4 FILINGS (INSIDER TRANSACTIONS)</div>
          {filings.length === 0 ? (
            <div style={S.hint}>NO RECENT FORM 4 FILINGS FOUND FOR {data.ticker}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>FILING DATE</th>
                    <th style={S.th}>INSIDER / REPORTER</th>
                    <th style={S.th}>COMPANY</th>
                    <th style={S.th}>FORM</th>
                    <th style={S.th}>DESCRIPTION</th>
                    <th style={S.th}>PERIOD</th>
                    <th style={S.th}>LINK</th>
                  </tr>
                </thead>
                <tbody>
                  {filings.map((f, i) => (
                    <tr key={i}>
                      <td style={{ ...S.td, color: '#888', whiteSpace: 'nowrap' }}>
                        {f.date}
                      </td>
                      <td style={{ ...S.td, color: '#ddd', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.insiderName}
                      </td>
                      <td style={{ ...S.td, color: '#aaa', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.company}
                      </td>
                      <td style={{ ...S.td, color: '#00cccc', fontWeight: 'bold', fontSize: 10 }}>
                        {f.form}
                      </td>
                      <td style={{ ...S.td, color: '#aaa', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }}>
                        {f.description}
                      </td>
                      <td style={{ ...S.td, color: '#888', whiteSpace: 'nowrap' }}>
                        {f.periodOfReport || '--'}
                      </td>
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        {f.url ? (
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#ff8c00', textDecoration: 'none', fontSize: 10, fontFamily: FONT }}
                            onClick={e => e.stopPropagation()}
                          >
                            VIEW
                          </a>
                        ) : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Timeline */}
          <div style={S.sectionHeader}>FILING ACTIVITY TIMELINE</div>
          {filings.length > 1 ? (
            <FilingTimeline filings={filings} />
          ) : (
            <div style={S.hint}>NOT ENOUGH DATA FOR TIMELINE</div>
          )}

          {/* Data source note */}
          <div style={{ padding: '6px 10px', color: '#444', fontSize: 9, fontFamily: FONT, textAlign: 'right' }}>
            DATA SOURCE: SEC EDGAR FULL-TEXT SEARCH (FORM 4 FILINGS)
          </div>
        </>
      )}
    </div>
  );
}
