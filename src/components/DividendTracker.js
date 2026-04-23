import React, { useState, useMemo } from 'react';

const FONT = "'Consolas','Courier New',monospace";

const S = {
  container: { background: '#000', minHeight: '600px', display: 'flex', flexDirection: 'column' },
  header: { background: '#0d0d1a', borderBottom: '2px solid #ff8c00', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#ff8c00', fontFamily: FONT, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  body: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 },
  row: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' },
  label: { color: '#888', fontFamily: FONT, fontSize: '10px', textTransform: 'uppercase' },
  input: { background: '#0d0d1a', border: '1px solid #333', color: '#e0e0e0', fontFamily: FONT, fontSize: '12px', padding: '4px 8px', width: '340px', outline: 'none' },
  btn: { background: '#ff8c00', color: '#000', border: 'none', fontFamily: FONT, fontSize: '11px', padding: '5px 16px', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' },
  loadingTxt: { padding: '40px', color: '#ff8c00', fontFamily: FONT, fontSize: '12px', textAlign: 'center', textTransform: 'uppercase' },
  errorTxt: { padding: '20px', color: '#ff4444', fontFamily: FONT, fontSize: '12px' },
  sectionTitle: { color: '#ff8c00', fontFamily: FONT, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #333', paddingBottom: '4px', marginBottom: '8px' },
  metricsRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  metricCard: { background: '#0d0d1a', border: '1px solid #333', padding: '8px 14px', minWidth: '140px' },
  metricLabel: { color: '#888', fontFamily: FONT, fontSize: '9px', textTransform: 'uppercase', marginBottom: '2px' },
  metricValue: (color) => ({ color: color || '#e0e0e0', fontFamily: FONT, fontSize: '16px', fontWeight: 'bold' }),
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: '11px' },
  th: { background: '#0d0d1a', color: '#888', fontFamily: FONT, fontSize: '10px', textTransform: 'uppercase', padding: '4px 8px', border: '1px solid #222', fontWeight: 'normal', letterSpacing: '0.5px', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' },
  td: { fontFamily: FONT, fontSize: '11px', color: '#ccc', padding: '3px 8px', border: '1px solid #222', whiteSpace: 'nowrap' },
  tdRight: { textAlign: 'right' },
  svgWrap: { background: '#000', padding: '8px' },
};

const ARISTOCRATS = new Set([
  'JNJ', 'PG', 'KO', 'PEP', 'MMM', 'ABT', 'ABBV', 'AFL', 'APD', 'BDX',
  'BEN', 'CAH', 'CAT', 'CB', 'CINF', 'CL', 'CLX', 'CVX', 'DOV', 'ECL',
  'ED', 'EMR', 'ESS', 'EXPD', 'FRT', 'GD', 'GPC', 'GWW', 'HRL', 'IBM',
  'ITW', 'JNJ', 'KMB', 'KO', 'LEG', 'LIN', 'LOW', 'MCD', 'MKC', 'MMM',
  'NEE', 'NUE', 'O', 'PBCT', 'PEP', 'PFE', 'PG', 'PNR', 'PPG', 'ROP',
  'SHW', 'SJM', 'SPGI', 'SWK', 'SYY', 'T', 'TGT', 'TROW', 'VFC', 'WBA',
  'WMT', 'XOM',
]);

function fmtDollar(v) { return v != null ? '$' + v.toFixed(2) : '--'; }
function fmtDate(epoch) {
  if (!epoch) return '--';
  const d = new Date(epoch * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export default function DividendTracker() {
  const [input, setInput] = useState('JNJ,PG,KO,PEP,XOM,T,VZ,MO,IBM,MMM');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortCol, setSortCol] = useState('divYield');
  const [sortDir, setSortDir] = useState('desc');

  const analyze = async () => {
    setLoading(true);
    setError(null);
    const tickers = input.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    if (!tickers.length) { setLoading(false); return; }

    try {
      const results = await Promise.allSettled(tickers.map(async (ticker) => {
        const chartRes = await fetch(
          `/yf/v8/finance/chart/${encodeURIComponent(ticker)}?range=5y&interval=1mo&includePrePost=false`,
          { signal: AbortSignal.timeout(15000) }
        );
        if (!chartRes.ok) throw new Error(`${ticker}: ${chartRes.status}`);
        const cJson = await chartRes.json();
        const result = cJson?.chart?.result?.[0];
        if (!result) throw new Error(`${ticker}: no data`);

        const meta = result.meta || {};
        const price = meta.regularMarketPrice ?? null;
        const name = meta.shortName || meta.longName || ticker;

        // Extract dividend events from the 5Y chart
        const divEvents = result.events?.dividends || {};
        const divList = Object.values(divEvents)
          .map(d => ({ amount: d.amount, date: d.date }))
          .filter(d => d.amount != null && d.date != null)
          .sort((a, b) => a.date - b.date);

        let annualDiv = null;
        let divYield = null;
        let exDivDate = null;
        let divGrowth = null;
        let divRate = meta.dividendRate ?? null;

        if (divList.length > 0) {
          // Most recent dividend event date as ex-date proxy
          exDivDate = divList[divList.length - 1].date;

          // Annual dividend: sum of last 4 payments (quarterly assumption)
          const recent4 = divList.slice(-4);
          annualDiv = recent4.reduce((sum, d) => sum + d.amount, 0);

          // If we have fewer than 4 dividends, scale up
          if (recent4.length < 4 && recent4.length > 0) {
            annualDiv = (annualDiv / recent4.length) * 4;
          }

          // Override with meta dividendRate if available and reasonable
          if (divRate != null && divRate > 0) {
            annualDiv = divRate;
          }

          // Yield
          if (price != null && price > 0) {
            divYield = annualDiv / price;
          }

          // Dividend growth: compare last year's total to prior year's total
          const now = Date.now() / 1000;
          const oneYearAgo = now - 365 * 86400;
          const twoYearsAgo = now - 730 * 86400;
          const lastYearDivs = divList.filter(d => d.date >= oneYearAgo);
          const priorYearDivs = divList.filter(d => d.date >= twoYearsAgo && d.date < oneYearAgo);
          if (lastYearDivs.length > 0 && priorYearDivs.length > 0) {
            const lastTotal = lastYearDivs.reduce((s, d) => s + d.amount, 0);
            const priorTotal = priorYearDivs.reduce((s, d) => s + d.amount, 0);
            if (priorTotal > 0) {
              divGrowth = (lastTotal - priorTotal) / priorTotal;
            }
          }
        } else {
          // No dividend events found; try meta fields
          if (meta.dividendYield != null) divYield = meta.dividendYield;
          if (divRate != null && divRate > 0) annualDiv = divRate;
          if (annualDiv != null && divYield == null && price > 0) {
            divYield = annualDiv / price;
          }
        }

        return {
          ticker,
          name,
          price,
          divYield,
          divRate: annualDiv,
          exDivDate,
          divGrowth,
          divCount: divList.length,
          isAristocrat: ARISTOCRATS.has(ticker),
        };
      }));

      const rows = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);

      if (!rows.length) throw new Error('No dividend data returned');
      setData(rows);
    } catch (e) {
      setError(e.message || 'Failed to fetch dividend data');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };
  const arrow = (col) => sortCol === col ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const va = a[sortCol] ?? -Infinity;
      const vb = b[sortCol] ?? -Infinity;
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [data, sortCol, sortDir]);

  // Aggregate stats
  const aggStats = useMemo(() => {
    if (!data.length) return null;
    const yields = data.map(d => d.divYield).filter(v => v != null);
    const avgYield = yields.length ? yields.reduce((s, v) => s + v, 0) / yields.length : null;
    const maxYield = yields.length ? Math.max(...yields) : null;
    const maxTicker = data.find(d => d.divYield === maxYield)?.ticker || '--';
    // Portfolio income: $10K invested equally, annual dividend = (10000/numStocks) * divRate for each
    const perStock = 10000 / data.length;
    let totalIncome = 0;
    data.forEach(d => {
      if (d.divRate != null && d.price != null && d.price > 0) {
        const shares = perStock / d.price;
        totalIncome += shares * d.divRate;
      }
    });
    return { avgYield, maxYield, maxTicker, totalIncome };
  }, [data]);

  // Bar chart data sorted by yield
  const barData = useMemo(() => {
    return [...data]
      .filter(d => d.divYield != null)
      .sort((a, b) => (b.divYield || 0) - (a.divYield || 0));
  }, [data]);

  const renderBarChart = () => {
    if (!barData.length) return null;
    const W = 700, barH = 22, gap = 4;
    const padL = 60, padR = 60;
    const H = barData.length * (barH + gap) + 20;
    const chartW = W - padL - padR;
    const maxYield = Math.max(...barData.map(d => (d.divYield || 0) * 100));

    return (
      <div>
        <div style={S.sectionTitle}>YIELD COMPARISON</div>
        <div style={S.svgWrap}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
            {barData.map((d, i) => {
              const y = 10 + i * (barH + gap);
              const yieldPct = (d.divYield || 0) * 100;
              const bw = maxYield > 0 ? (yieldPct / maxYield) * chartW : 0;
              const color = yieldPct >= 4 ? '#00ff41' : yieldPct < 1 ? '#666' : '#ff8c00';
              return (
                <g key={d.ticker}>
                  <text x={padL - 4} y={y + barH / 2 + 4} fill="#ccc" fontSize="10" fontFamily={FONT} textAnchor="end">{d.ticker}</text>
                  <rect x={padL} y={y} width={Math.max(bw, 1)} height={barH} fill={color} opacity="0.85" rx="1" />
                  <text x={padL + bw + 4} y={y + barH / 2 + 4} fill="#ccc" fontSize="10" fontFamily={FONT}>{yieldPct.toFixed(2)}%</text>
                  {d.isAristocrat && (
                    <text x={padL + bw + 50} y={y + barH / 2 + 4} fill="#ffcc00" fontSize="9" fontFamily={FONT}>ARISTOCRAT</text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  const TH = ({ col, label, align }) => (
    <th style={{ ...S.th, textAlign: align || 'right' }} onClick={() => handleSort(col)}>
      {label}{arrow(col)}
    </th>
  );

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>DIVIDEND TRACKER</span>
        <span style={{ fontFamily: FONT, fontSize: 10, color: '#666' }}>YAHOO FINANCE</span>
      </div>

      <div style={S.body}>
        {/* Input row */}
        <div style={S.row}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={S.label}>Tickers (comma-separated)</span>
            <input
              style={S.input}
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && analyze()}
            />
          </div>
          <button style={S.btn} onClick={analyze} disabled={loading}>ANALYZE</button>
        </div>

        {loading && <div style={S.loadingTxt}>LOADING...</div>}
        {error && !loading && <div style={S.errorTxt}>{error}</div>}

        {data.length > 0 && !loading && (
          <>
            {/* Aggregate stat cards */}
            {aggStats && (
              <div style={S.metricsRow}>
                <div style={S.metricCard}>
                  <div style={S.metricLabel}>AVG YIELD</div>
                  <div style={S.metricValue('#ff8c00')}>{aggStats.avgYield != null ? (aggStats.avgYield * 100).toFixed(2) + '%' : '--'}</div>
                </div>
                <div style={S.metricCard}>
                  <div style={S.metricLabel}>HIGHEST YIELD</div>
                  <div style={S.metricValue('#00ff41')}>{aggStats.maxYield != null ? (aggStats.maxYield * 100).toFixed(2) + '%' : '--'}</div>
                  <div style={{ color: '#888', fontFamily: FONT, fontSize: 9 }}>{aggStats.maxTicker}</div>
                </div>
                <div style={S.metricCard}>
                  <div style={S.metricLabel}>PORTFOLIO INCOME ($10K)</div>
                  <div style={S.metricValue('#00ff41')}>${aggStats.totalIncome.toFixed(2)}</div>
                  <div style={{ color: '#888', fontFamily: FONT, fontSize: 9 }}>ANNUAL / EQUAL WEIGHT</div>
                </div>
                <div style={S.metricCard}>
                  <div style={S.metricLabel}>STOCKS TRACKED</div>
                  <div style={S.metricValue('#e0e0e0')}>{data.length}</div>
                </div>
                <div style={S.metricCard}>
                  <div style={S.metricLabel}>ARISTOCRATS</div>
                  <div style={S.metricValue('#ffcc00')}>{data.filter(d => d.isAristocrat).length}</div>
                </div>
              </div>
            )}

            {/* Summary table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <TH col="ticker" label="TICKER" align="left" />
                    <TH col="name" label="NAME" align="left" />
                    <TH col="price" label="PRICE" />
                    <TH col="divYield" label="DIV YIELD %" />
                    <TH col="divRate" label="ANNUAL DIV $" />
                    <TH col="divGrowth" label="DIV GROWTH (YOY)" />
                    <TH col="exDivDate" label="LAST DIV DATE" />
                    <TH col="divCount" label="DIVS (5Y)" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(d => {
                    const yieldPct = d.divYield != null ? d.divYield * 100 : null;
                    const yieldColor = yieldPct != null
                      ? (yieldPct >= 4 ? '#00ff41' : yieldPct < 1 ? '#666' : '#ccc')
                      : '#ccc';
                    const growthColor = d.divGrowth != null
                      ? (d.divGrowth >= 0 ? '#00ff41' : '#ff4444')
                      : '#ccc';
                    return (
                      <tr key={d.ticker}>
                        <td style={{ ...S.td, textAlign: 'left', color: '#ffcc00', fontWeight: 'bold' }}>
                          {d.ticker}
                          {d.isAristocrat && <span style={{ color: '#ffcc00', fontSize: 9, marginLeft: 4 }} title="Dividend Aristocrat (25+ years)">*</span>}
                        </td>
                        <td style={{ ...S.td, textAlign: 'left', color: '#b0b0b0', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</td>
                        <td style={{ ...S.td, ...S.tdRight }}>{d.price != null ? '$' + d.price.toFixed(2) : '--'}</td>
                        <td style={{ ...S.td, ...S.tdRight, color: yieldColor, fontWeight: 'bold' }}>
                          {yieldPct != null ? yieldPct.toFixed(2) + '%' : '--'}
                        </td>
                        <td style={{ ...S.td, ...S.tdRight }}>{fmtDollar(d.divRate)}</td>
                        <td style={{ ...S.td, ...S.tdRight, color: growthColor, fontWeight: 'bold' }}>
                          {d.divGrowth != null ? (d.divGrowth >= 0 ? '+' : '') + (d.divGrowth * 100).toFixed(1) + '%' : '--'}
                        </td>
                        <td style={{ ...S.td, ...S.tdRight }}>{fmtDate(d.exDivDate)}</td>
                        <td style={{ ...S.td, ...S.tdRight }}>{d.divCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Yield comparison bar chart */}
            {renderBarChart()}
          </>
        )}
      </div>
    </div>
  );
}
