import React, { useState, useEffect, useMemo, useCallback } from 'react';

const FONT = "'Consolas','Courier New',monospace";

const S = {
  container: { background: '#000', minHeight: '600px', display: 'flex', flexDirection: 'column' },
  header: { background: '#0d0d1a', borderBottom: '2px solid #ff8c00', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#ff8c00', fontFamily: FONT, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  body: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 },
  loadingTxt: { padding: '40px', color: '#ff8c00', fontFamily: FONT, fontSize: '12px', textAlign: 'center', textTransform: 'uppercase' },
  errorTxt: { padding: '20px', color: '#ff4444', fontFamily: FONT, fontSize: '12px' },
  sectionTitle: { color: '#ff8c00', fontFamily: FONT, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #333', paddingBottom: '4px', marginBottom: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: '11px' },
  th: { background: '#0d0d1a', color: '#888', fontFamily: FONT, fontSize: '10px', textTransform: 'uppercase', padding: '4px 8px', border: '1px solid #222', fontWeight: 'normal', letterSpacing: '0.5px', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' },
  td: { fontFamily: FONT, fontSize: '11px', color: '#ccc', padding: '3px 8px', border: '1px solid #222', whiteSpace: 'nowrap' },
  tdRight: { textAlign: 'right' },
};

const MAJOR_PAIRS = ['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'USDCHF=X', 'AUDUSD=X', 'USDCAD=X', 'NZDUSD=X'];
const ALL_PAIRS = [
  'EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'USDCHF=X', 'AUDUSD=X', 'USDCAD=X', 'NZDUSD=X',
  'EURGBP=X', 'EURJPY=X', 'GBPJPY=X', 'USDCNY=X', 'USDINR=X', 'USDMXN=X', 'USDBRL=X',
  'USDKRW=X', 'USDSGD=X', 'USDHKD=X', 'USDTRY=X', 'USDZAR=X', 'USDNOK=X',
];
const DXY_SYMBOL = 'DX-Y.NYB';

const CROSS_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'];

function pairLabel(sym) {
  return sym.replace('=X', '').replace(/(.{3})(.{3})/, '$1/$2');
}

function fmtRate(v, pair) {
  if (v == null) return '--';
  // JPY pairs show 3 decimals, others show 4-5
  const sym = pair || '';
  if (sym.includes('JPY') || sym.includes('KRW') || sym.includes('INR')) return v.toFixed(3);
  return v.toFixed(4);
}

function Sparkline({ prices, color }) {
  if (!prices || prices.length < 2) return null;
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const w = 100, h = 28;
  const pts = prices.map((p, i) => `${(i / (prices.length - 1)) * w},${h - ((p - min) / range) * h}`).join(' ');
  return <svg width={w} height={h} style={{ verticalAlign: 'middle' }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" /></svg>;
}

export default function ForexDashboard() {
  const [quotes, setQuotes] = useState({});
  const [dxy, setDxy] = useState(null);
  const [sparklines, setSparklines] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchQuotes = useCallback(async () => {
    try {
      // Fetch all pairs + DXY using v8/chart (reliable)
      const allSymbols = [...ALL_PAIRS, DXY_SYMBOL];
      const results = await Promise.allSettled(allSymbols.map(async (sym) => {
        const res = await fetch(`/yf/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d&includePrePost=false`, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) return null;
        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result) return null;
        const meta = result.meta;
        const price = meta.regularMarketPrice ?? null;
        const prev = meta.chartPreviousClose ?? price;
        const change = price != null && prev != null ? price - prev : null;
        const changePct = change != null && prev ? (change / prev) * 100 : null;
        return {
          symbol: meta.symbol || sym,
          shortName: meta.shortName || pairLabel(sym),
          regularMarketPrice: price,
          regularMarketChange: change,
          regularMarketChangePercent: changePct,
          regularMarketDayHigh: meta.regularMarketDayHigh ?? null,
          regularMarketDayLow: meta.regularMarketDayLow ?? null,
          fiftyDayAverage: meta.fiftyDayAverage ?? null,
          twoHundredDayAverage: null, // not in chart meta
        };
      }));

      const qMap = {};
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value) qMap[r.value.symbol] = r.value;
      });

      // DXY might come back with different symbol
      const dxyQ = qMap[DXY_SYMBOL] || qMap['DX-Y.NYB'] || null;
      setDxy(dxyQ);
      setQuotes(qMap);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSparklines = useCallback(async () => {
    const results = await Promise.allSettled(MAJOR_PAIRS.map(async (sym) => {
      const res = await fetch(`/yf/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=15m`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return { sym, prices: [] };
      const json = await res.json();
      const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
      return { sym, prices: closes.filter(c => c != null) };
    }));
    const sMap = {};
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) sMap[r.value.sym] = r.value.prices;
    });
    setSparklines(sMap);
  }, []);

  useEffect(() => {
    fetchQuotes();
    fetchSparklines();
    const id = setInterval(fetchQuotes, 30000);
    return () => clearInterval(id);
  }, [fetchQuotes, fetchSparklines]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };
  const arrowStr = (col) => sortCol === col ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  // Cross rates matrix
  const crossMatrix = useMemo(() => {
    // Build USD-based rates: usdRates['EUR'] = how many EUR per 1 USD
    const usdRates = { USD: 1 };
    // Pairs where base is USD (USDXXX=X): rate = price
    // Pairs where quote is USD (XXXUSD=X): rate = 1/price
    ALL_PAIRS.forEach(sym => {
      const q = quotes[sym];
      if (!q || q.regularMarketPrice == null) return;
      const pair = sym.replace('=X', '');
      const base = pair.substring(0, 3);
      const quote = pair.substring(3, 6);
      if (base === 'USD') {
        usdRates[quote] = q.regularMarketPrice;
      } else if (quote === 'USD') {
        usdRates[base] = 1 / q.regularMarketPrice;
      }
    });

    // Matrix[from][to] = how many 'to' units per 1 'from' unit
    const matrix = {};
    CROSS_CURRENCIES.forEach(from => {
      matrix[from] = {};
      CROSS_CURRENCIES.forEach(to => {
        if (from === to) { matrix[from][to] = 1; return; }
        const fromUsd = usdRates[from]; // how many 'from' per 1 USD
        const toUsd = usdRates[to];     // how many 'to' per 1 USD
        if (fromUsd != null && toUsd != null && fromUsd !== 0) {
          matrix[from][to] = toUsd / fromUsd;
        } else {
          matrix[from][to] = null;
        }
      });
    });
    return matrix;
  }, [quotes]);

  // Sorted table data
  const tableData = useMemo(() => {
    const rows = ALL_PAIRS.map(sym => {
      const q = quotes[sym];
      return { symbol: sym, ...(q || {}) };
    }).filter(r => r.regularMarketPrice != null);

    if (!sortCol) return rows;

    return [...rows].sort((a, b) => {
      const va = a[sortCol] ?? -Infinity;
      const vb = b[sortCol] ?? -Infinity;
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [quotes, sortCol, sortDir]);

  if (loading) return (
    <div style={S.container}>
      <div style={S.header}><span style={S.title}>FOREX DASHBOARD</span></div>
      <div style={S.loadingTxt}>LOADING...</div>
    </div>
  );

  const chgColor = (v) => v > 0 ? '#00ff41' : v < 0 ? '#ff4444' : '#888';

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>FOREX DASHBOARD</span>
        <span style={{ fontFamily: FONT, fontSize: 10, color: '#666' }}>
          AUTO-REFRESH 30s {lastUpdate ? '| ' + lastUpdate.toLocaleTimeString() : ''}
        </span>
      </div>

      <div style={S.body}>
        {error && <div style={S.errorTxt}>{error}</div>}

        {/* DXY Banner */}
        {dxy && (
          <div style={{ background: '#0d0d1a', border: '1px solid #333', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: FONT, fontSize: 11, color: '#888' }}>US DOLLAR INDEX (DXY):</span>
            <span style={{ fontFamily: FONT, fontSize: 18, fontWeight: 'bold', color: '#e0e0e0' }}>
              {dxy.regularMarketPrice != null ? dxy.regularMarketPrice.toFixed(2) : '--'}
            </span>
            {dxy.regularMarketChangePercent != null && (
              <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 'bold', color: chgColor(dxy.regularMarketChangePercent) }}>
                {dxy.regularMarketChangePercent >= 0 ? '+' : ''}{dxy.regularMarketChangePercent.toFixed(2)}%
              </span>
            )}
            {dxy.regularMarketChange != null && (
              <span style={{ fontFamily: FONT, fontSize: 11, color: chgColor(dxy.regularMarketChange) }}>
                ({dxy.regularMarketChange >= 0 ? '+' : ''}{dxy.regularMarketChange.toFixed(2)})
              </span>
            )}
          </div>
        )}

        {/* Major Pairs Cards */}
        <div>
          <div style={S.sectionTitle}>MAJOR PAIRS</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MAJOR_PAIRS.map(sym => {
              const q = quotes[sym];
              if (!q) return null;
              const chg = q.regularMarketChangePercent;
              const sparkPrices = sparklines[sym];
              return (
                <div key={sym} style={{ background: '#0d0d1a', border: '1px solid #333', padding: '8px 12px', minWidth: 180, flex: '1 1 180px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontFamily: FONT, fontSize: 12, color: '#ff8c00', fontWeight: 'bold' }}>{pairLabel(sym)}</span>
                    <span style={{ fontFamily: FONT, fontSize: 9, color: '#666' }}>{q.shortName}</span>
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 'bold', color: '#e0e0e0' }}>
                    {fmtRate(q.regularMarketPrice, sym)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontFamily: FONT, fontSize: 11, color: chgColor(q.regularMarketChange) }}>
                      {q.regularMarketChange != null ? (q.regularMarketChange >= 0 ? '+' : '') + fmtRate(q.regularMarketChange, sym) : '--'}
                    </span>
                    <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 'bold', color: chgColor(chg) }}>
                      {chg != null ? (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%' : '--'}
                    </span>
                  </div>
                  {sparkPrices && sparkPrices.length > 1 && (
                    <div style={{ marginTop: 4 }}>
                      <Sparkline prices={sparkPrices} color={chg >= 0 ? '#00ff41' : '#ff4444'} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cross Rates Matrix */}
        <div>
          <div style={S.sectionTitle}>CROSS RATES MATRIX</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ ...S.table, fontSize: '10px' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, textAlign: 'left', fontSize: '9px' }}>FROM \ TO</th>
                  {CROSS_CURRENCIES.map(c => (
                    <th key={c} style={{ ...S.th, textAlign: 'center', fontSize: '9px', cursor: 'default' }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CROSS_CURRENCIES.map(from => (
                  <tr key={from}>
                    <td style={{ ...S.td, textAlign: 'left', color: '#ff8c00', fontWeight: 'bold', fontSize: '10px' }}>{from}</td>
                    {CROSS_CURRENCIES.map(to => {
                      const val = crossMatrix[from]?.[to];
                      const isSelf = from === to;
                      return (
                        <td key={to} style={{
                          ...S.td, textAlign: 'center', fontSize: '10px',
                          color: isSelf ? '#444' : '#ccc',
                          background: isSelf ? '#0a0a14' : undefined,
                        }}>
                          {isSelf ? '--' : (val != null ? (to === 'JPY' || from === 'JPY' ? val.toFixed(2) : val.toFixed(4)) : '--')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Full pairs table */}
        <div>
          <div style={S.sectionTitle}>ALL PAIRS</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, textAlign: 'left', cursor: 'default' }}>PAIR</th>
                  <th style={S.th} onClick={() => handleSort('regularMarketPrice')}>RATE{arrowStr('regularMarketPrice')}</th>
                  <th style={S.th} onClick={() => handleSort('regularMarketChange')}>CHANGE{arrowStr('regularMarketChange')}</th>
                  <th style={S.th} onClick={() => handleSort('regularMarketChangePercent')}>% CHG{arrowStr('regularMarketChangePercent')}</th>
                  <th style={S.th} onClick={() => handleSort('regularMarketDayHigh')}>DAY HIGH{arrowStr('regularMarketDayHigh')}</th>
                  <th style={S.th} onClick={() => handleSort('regularMarketDayLow')}>DAY LOW{arrowStr('regularMarketDayLow')}</th>
                  <th style={S.th} onClick={() => handleSort('fiftyDayAverage')}>50D AVG{arrowStr('fiftyDayAverage')}</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map(r => {
                  const chg = r.regularMarketChange;
                  const chgPct = r.regularMarketChangePercent;
                  return (
                    <tr key={r.symbol}>
                      <td style={{ ...S.td, textAlign: 'left', color: '#ffcc00', fontWeight: 'bold' }}>{pairLabel(r.symbol)}</td>
                      <td style={{ ...S.td, ...S.tdRight }}>{fmtRate(r.regularMarketPrice, r.symbol)}</td>
                      <td style={{ ...S.td, ...S.tdRight, color: chgColor(chg) }}>
                        {chg != null ? (chg >= 0 ? '+' : '') + fmtRate(chg, r.symbol) : '--'}
                      </td>
                      <td style={{ ...S.td, ...S.tdRight, color: chgColor(chgPct), fontWeight: 'bold' }}>
                        {chgPct != null ? (chgPct >= 0 ? '+' : '') + chgPct.toFixed(2) + '%' : '--'}
                      </td>
                      <td style={{ ...S.td, ...S.tdRight }}>{fmtRate(r.regularMarketDayHigh, r.symbol)}</td>
                      <td style={{ ...S.td, ...S.tdRight }}>{fmtRate(r.regularMarketDayLow, r.symbol)}</td>
                      <td style={{ ...S.td, ...S.tdRight }}>{r.fiftyDayAverage != null ? fmtRate(r.fiftyDayAverage, r.symbol) : '--'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
