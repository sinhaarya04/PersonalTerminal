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
    border: '1px solid #333', borderRadius: 2, padding: '3px 8px', outline: 'none', width: 280,
  },
  btn: {
    fontFamily: FONT, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase',
    cursor: 'pointer', border: '1px solid #ff8c00', borderRadius: 2,
    padding: '4px 14px', background: '#ff8c00', color: '#000', fontWeight: 'bold',
  },
  loading: { padding: 40, color: '#ff8c00', fontFamily: FONT, fontSize: 13, textAlign: 'center', textTransform: 'uppercase' },
  error: { padding: 20, color: '#ff4444', fontFamily: FONT, fontSize: 12, textAlign: 'center' },
  sectionHeader: {
    background: '#0d0d1a', borderBottom: '1px solid #333', borderTop: '1px solid #333',
    padding: '4px 10px', color: '#ff8c00', fontSize: 11, fontFamily: FONT,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: FONT },
  th: {
    background: '#1a1a2e', color: '#ff8c00', fontFamily: FONT, fontSize: 11,
    textAlign: 'right', padding: '3px 8px', border: '1px solid #333',
    textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 'normal',
  },
  thFirst: { textAlign: 'left', minWidth: 160 },
  td: {
    fontFamily: FONT, fontSize: 11, textAlign: 'right', padding: '3px 8px',
    border: '1px solid #222', color: '#ccc',
  },
  tdFirst: { textAlign: 'left', color: '#888', fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase' },
  groupRow: {
    background: '#0a0a14', color: '#ff8c00', fontFamily: FONT, fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 1, padding: '4px 8px',
    border: '1px solid #222', fontWeight: 'bold',
  },
  rankSection: { padding: '10px', background: '#000' },
  rankCard: {
    display: 'inline-block', background: '#0d0d1a', border: '1px solid #333',
    borderRadius: 2, padding: '8px 14px', margin: '4px 6px', minWidth: 140,
  },
  rankLabel: { color: '#888', fontSize: 9, textTransform: 'uppercase', fontFamily: FONT, letterSpacing: 0.5 },
  rankValue: (color) => ({ color: color || '#fff', fontSize: 14, fontFamily: FONT, fontWeight: 'bold', marginTop: 2 }),
  svgSection: { padding: '8px 10px' },
};

// ── Formatting helpers ──────────────────────────────────────────────────────
function fmtPrice(n) {
  if (n == null || isNaN(n)) return '--';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPctRaw(n) {
  if (n == null || isNaN(n)) return '--';
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}

function fmtRatio(n) {
  if (n == null || isNaN(n)) return '--';
  return n.toFixed(2);
}

function fmtVol(n) {
  if (n == null || isNaN(n)) return '--';
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toLocaleString('en-US');
}

// ── Compute metrics from v8 chart data ──────────────────────────────────────
function computePeerMetrics(meta, chartResult) {
  const price = meta.regularMarketPrice ?? null;
  const prevClose = meta.chartPreviousClose ?? null;
  const change = price != null && prevClose != null ? price - prevClose : null;
  const changePct = change != null && prevClose ? (change / prevClose) * 100 : null;
  const high52 = meta.fiftyTwoWeekHigh ?? null;
  const low52 = meta.fiftyTwoWeekLow ?? null;
  const volume = meta.regularMarketVolume ?? null;
  const name = meta.shortName || meta.longName || meta.symbol || '';

  const distFrom52High = price != null && high52 != null && high52 > 0
    ? ((price - high52) / high52) * 100 : null;

  // Historical closes
  const timestamps = chartResult?.timestamp || [];
  const closes = chartResult?.indicators?.quote?.[0]?.close || [];
  const volumes = chartResult?.indicators?.quote?.[0]?.volume || [];
  const validCloses = closes.filter(c => c != null);
  const validVolumes = volumes.filter(v => v != null);

  // Average daily volume
  const avgVolume = validVolumes.length > 0
    ? validVolumes.reduce((s, v) => s + v, 0) / validVolumes.length : null;

  // Period returns using timestamps to find correct offset
  function computeReturn(daysAgo) {
    if (validCloses.length < 2) return null;
    const now = Date.now();
    const cutoff = now - daysAgo * 24 * 60 * 60 * 1000;
    // Find closest bar at or after cutoff
    let idx = 0;
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] * 1000 >= cutoff && closes[i] != null) { idx = i; break; }
    }
    const startPrice = closes[idx];
    const endPrice = validCloses[validCloses.length - 1];
    if (startPrice == null || endPrice == null || startPrice === 0) return null;
    return ((endPrice - startPrice) / startPrice) * 100;
  }

  // YTD return
  function computeYTDReturn() {
    if (validCloses.length < 2) return null;
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    let idx = 0;
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] * 1000 >= yearStart && closes[i] != null) { idx = i; break; }
    }
    const startPrice = closes[idx];
    const endPrice = validCloses[validCloses.length - 1];
    if (startPrice == null || endPrice == null || startPrice === 0) return null;
    return ((endPrice - startPrice) / startPrice) * 100;
  }

  const ret1M = computeReturn(30);
  const ret3M = computeReturn(90);
  const ret6M = computeReturn(180);
  const ret1Y = computeReturn(365);
  const retYTD = computeYTDReturn();

  // Annualized volatility
  let volatility = null;
  const dailyReturns = [];
  for (let i = 1; i < validCloses.length; i++) {
    if (validCloses[i - 1] > 0) dailyReturns.push(Math.log(validCloses[i] / validCloses[i - 1]));
  }
  if (dailyReturns.length > 10) {
    const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
    volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  // Max drawdown
  let maxDrawdown = null;
  if (validCloses.length > 5) {
    let peak = validCloses[0];
    let maxDD = 0;
    for (let i = 1; i < validCloses.length; i++) {
      if (validCloses[i] > peak) peak = validCloses[i];
      const dd = (validCloses[i] - peak) / peak;
      if (dd < maxDD) maxDD = dd;
    }
    maxDrawdown = maxDD * 100;
  }

  // Sharpe ratio (simple: annualized return / annualized vol, no risk-free rate)
  let sharpe = null;
  if (ret1Y != null && volatility != null && volatility > 0) {
    sharpe = ret1Y / volatility;
  } else if (dailyReturns.length > 10 && volatility != null && volatility > 0) {
    const annReturn = (dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length) * 252 * 100;
    sharpe = annReturn / volatility;
  }

  return {
    name, price, change, changePct,
    high52, low52, distFrom52High,
    volume, avgVolume,
    ret1M, ret3M, ret6M, ret1Y, retYTD,
    volatility, maxDrawdown, sharpe,
    closes: validCloses,
  };
}

// ── Fetch peer data using v8/chart 1Y ───────────────────────────────────────
async function fetchPeerData(tickers) {
  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const res = await fetch(
        `/yf/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y&includePrePost=false`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      const chartResult = json?.chart?.result?.[0];
      if (!chartResult) throw new Error('No data');
      const meta = chartResult.meta || {};
      const metrics = computePeerMetrics(meta, chartResult);
      return { ticker, ...metrics };
    })
  );

  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

// ── Metric definitions grouped ──────────────────────────────────────────────
const METRIC_GROUPS = [
  {
    group: 'PRICE & MARKET',
    metrics: [
      { key: 'price', label: 'Price', fmt: fmtPrice, higherBetter: null },
      { key: 'changePct', label: 'Change %', fmt: fmtPctRaw, higherBetter: true },
      { key: 'volume', label: 'Volume', fmt: fmtVol, higherBetter: null },
      { key: 'avgVolume', label: 'Avg Daily Volume', fmt: fmtVol, higherBetter: null },
    ],
  },
  {
    group: 'RETURNS',
    metrics: [
      { key: 'ret1M', label: '1 Month Return', fmt: fmtPctRaw, higherBetter: true },
      { key: 'ret3M', label: '3 Month Return', fmt: fmtPctRaw, higherBetter: true },
      { key: 'ret6M', label: '6 Month Return', fmt: fmtPctRaw, higherBetter: true },
      { key: 'retYTD', label: 'YTD Return', fmt: fmtPctRaw, higherBetter: true },
      { key: 'ret1Y', label: '1 Year Return', fmt: fmtPctRaw, higherBetter: true },
    ],
  },
  {
    group: 'RISK METRICS',
    metrics: [
      { key: 'volatility', label: 'Ann. Volatility', fmt: (n) => n != null ? n.toFixed(1) + '%' : '--', higherBetter: false },
      { key: 'maxDrawdown', label: 'Max Drawdown', fmt: (n) => n != null ? n.toFixed(1) + '%' : '--', higherBetter: false },
      { key: 'sharpe', label: 'Sharpe Ratio', fmt: fmtRatio, higherBetter: true },
    ],
  },
  {
    group: 'TRADING RANGE',
    metrics: [
      { key: 'high52', label: '52W High', fmt: fmtPrice, higherBetter: null },
      { key: 'low52', label: '52W Low', fmt: fmtPrice, higherBetter: null },
      { key: 'distFrom52High', label: '% From 52W High', fmt: fmtPctRaw, higherBetter: true },
    ],
  },
];

// ── Bar chart SVG ───────────────────────────────────────────────────────────
function HBarChart({ data, label, fmt, width = 700 }) {
  if (!data || !data.length) return null;
  const H = data.length * 28 + 30;
  const padL = 70, padR = 80, padT = 20;
  const barMax = Math.max(...data.map(d => Math.abs(d.value || 0)), 0.01);
  const barW = width - padL - padR;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: '#888', fontSize: 10, fontFamily: FONT, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
        {label}
      </div>
      <svg width={width} height={H} style={{ display: 'block' }}>
        {data.map((d, i) => {
          const w = (Math.abs(d.value || 0) / barMax) * barW;
          const y = padT + i * 28;
          return (
            <g key={d.ticker}>
              <text x={padL - 6} y={y + 15} fill="#ffcc00" fontSize={10} fontFamily={FONT} textAnchor="end">{d.ticker}</text>
              <rect x={padL} y={y + 2} width={Math.max(w, 2)} height={18} fill={d.color || '#ff8c00'} rx={1} opacity={0.85} />
              <text x={padL + w + 6} y={y + 15} fill="#ccc" fontSize={10} fontFamily={FONT}>{fmt ? fmt(d.value) : d.value}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function PeerComparison() {
  const [input, setInput] = useState('AAPL,MSFT,GOOG,AMZN,META');
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const compare = useCallback(async () => {
    const tickers = input.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    if (!tickers.length) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPeerData(tickers);
      if (!data.length) throw new Error('No data returned');
      setPeers(data);
    } catch (e) {
      setError(e.message || 'Failed to fetch data');
    }
    setLoading(false);
  }, [input]);

  // Find best/worst in a row
  function getBestWorst(metricKey, higherBetter) {
    if (higherBetter == null) return { best: null, worst: null };
    const vals = peers.map(p => ({ ticker: p.ticker, v: p[metricKey] })).filter(x => x.v != null && !isNaN(x.v));
    if (vals.length < 2) return { best: null, worst: null };
    vals.sort((a, b) => a.v - b.v);
    if (higherBetter) {
      return { best: vals[vals.length - 1].ticker, worst: vals[0].ticker };
    }
    return { best: vals[0].ticker, worst: vals[vals.length - 1].ticker };
  }

  // Compute rankings
  function computeRankings() {
    const scores = {};
    peers.forEach(p => { scores[p.ticker] = 0; });
    const categories = { Returns: {}, 'Risk Metrics': {}, 'Trading Range': {} };
    peers.forEach(p => {
      Object.keys(categories).forEach(c => { categories[c][p.ticker] = 0; });
    });

    const groupToCat = {
      RETURNS: 'Returns',
      'RISK METRICS': 'Risk Metrics',
      'TRADING RANGE': 'Trading Range',
    };

    METRIC_GROUPS.forEach(g => {
      const cat = groupToCat[g.group];
      g.metrics.forEach(m => {
        if (m.higherBetter == null) return;
        const { best } = getBestWorst(m.key, m.higherBetter);
        if (best) {
          scores[best] = (scores[best] || 0) + 1;
          if (cat && categories[cat]) categories[cat][best] = (categories[cat][best] || 0) + 1;
        }
      });
    });

    return { scores, categories };
  }

  const rankings = peers.length > 0 ? computeRankings() : null;
  const overallWinner = rankings ? Object.entries(rankings.scores).sort((a, b) => b[1] - a[1])[0] : null;

  // Bar chart data
  const barCharts = peers.length > 0 ? [
    {
      label: '1 Year Return',
      data: peers.map(p => ({
        ticker: p.ticker,
        value: p.ret1Y,
        color: p.ret1Y != null && p.ret1Y >= 0 ? '#00ff41' : '#ff4444',
      })).filter(d => d.value != null),
      fmt: fmtPctRaw,
    },
    {
      label: 'Annualized Volatility',
      data: peers.map(p => ({
        ticker: p.ticker,
        value: p.volatility,
        color: '#ffcc00',
      })).filter(d => d.value != null),
      fmt: (n) => n != null ? n.toFixed(1) + '%' : '--',
    },
    {
      label: 'Max Drawdown',
      data: peers.map(p => ({
        ticker: p.ticker,
        value: p.maxDrawdown != null ? Math.abs(p.maxDrawdown) : null,
        color: '#ff4444',
      })).filter(d => d.value != null),
      fmt: (n) => n != null ? '-' + n.toFixed(1) + '%' : '--',
    },
    {
      label: 'Sharpe Ratio',
      data: peers.map(p => ({
        ticker: p.ticker,
        value: p.sharpe != null ? Math.max(p.sharpe, 0) : null,
        color: p.sharpe != null && p.sharpe > 0 ? '#00ff41' : '#ff4444',
      })).filter(d => d.value != null),
      fmt: fmtRatio,
    },
  ] : [];

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>PEER COMPARISON</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && compare()}
          placeholder="AAPL,MSFT,GOOG..."
          style={S.input}
        />
        <button onClick={compare} style={S.btn}>COMPARE</button>
        {peers.length > 0 && (
          <span style={{ color: '#555', fontSize: 10, fontFamily: FONT }}>
            {peers.length} PEERS LOADED
          </span>
        )}
      </div>

      {/* Loading / Error */}
      {loading && <div style={S.loading}>LOADING...</div>}
      {error && <div style={S.error}>ERROR: {error}</div>}

      {/* No data prompt */}
      {!loading && !error && peers.length === 0 && (
        <div style={{ padding: 40, color: '#555', fontFamily: FONT, fontSize: 12, textAlign: 'center' }}>
          ENTER TICKERS AND CLICK COMPARE TO BEGIN PEER ANALYSIS
        </div>
      )}

      {/* Comparison Table */}
      {peers.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, ...S.thFirst }}>METRIC</th>
                  {peers.map(p => (
                    <th key={p.ticker} style={S.th}>
                      <div style={{ color: '#ffcc00', fontSize: 12, fontWeight: 'bold' }}>{p.ticker}</div>
                      <div style={{ color: '#666', fontSize: 9, fontWeight: 'normal' }}>{p.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRIC_GROUPS.map(g => (
                  <React.Fragment key={g.group}>
                    <tr>
                      <td colSpan={peers.length + 1} style={S.groupRow}>{g.group}</td>
                    </tr>
                    {g.metrics.map(m => {
                      const { best, worst } = getBestWorst(m.key, m.higherBetter);
                      return (
                        <tr key={m.key}>
                          <td style={{ ...S.td, ...S.tdFirst }}>{m.label}</td>
                          {peers.map(p => {
                            const val = p[m.key];
                            let bg = 'transparent';
                            let color = '#ccc';
                            if (best && p.ticker === best) { bg = 'rgba(0,255,65,0.1)'; color = '#00ff41'; }
                            if (worst && p.ticker === worst) { bg = 'rgba(255,68,68,0.1)'; color = '#ff4444'; }
                            return (
                              <td key={p.ticker} style={{ ...S.td, background: bg, color, fontWeight: (best === p.ticker || worst === p.ticker) ? 'bold' : 'normal' }}>
                                {m.fmt(val)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bar Charts */}
          <div style={S.sectionHeader}>VISUAL COMPARISON</div>
          <div style={S.svgSection}>
            {barCharts.map(bc => (
              <HBarChart key={bc.label} label={bc.label} data={bc.data} fmt={bc.fmt} />
            ))}
          </div>

          {/* Rankings */}
          <div style={S.sectionHeader}>RANKINGS SUMMARY</div>
          <div style={S.rankSection}>
            {overallWinner && (
              <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(0,255,65,0.08)', border: '1px solid #00ff41', borderRadius: 2 }}>
                <span style={{ color: '#888', fontSize: 10, fontFamily: FONT }}>OVERALL LEADER: </span>
                <span style={{ color: '#00ff41', fontSize: 16, fontFamily: FONT, fontWeight: 'bold' }}>{overallWinner[0]}</span>
                <span style={{ color: '#888', fontSize: 10, fontFamily: FONT, marginLeft: 8 }}>
                  ({overallWinner[1]} BEST-IN-CLASS METRICS)
                </span>
              </div>
            )}
            {rankings && Object.entries(rankings.categories).map(([cat, catScores]) => {
              const sorted = Object.entries(catScores).sort((a, b) => b[1] - a[1]);
              const winner = sorted[0];
              if (!winner || winner[1] === 0) return null;
              return (
                <div key={cat} style={S.rankCard}>
                  <div style={S.rankLabel}>{cat}</div>
                  <div style={S.rankValue('#00ff41')}>{winner[0]}</div>
                  <div style={{ color: '#555', fontSize: 9, fontFamily: FONT }}>{winner[1]} wins</div>
                </div>
              );
            })}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {rankings && Object.entries(rankings.scores).sort((a, b) => b[1] - a[1]).map(([ticker, score], i) => (
                <div key={ticker} style={{ ...S.rankCard, borderColor: i === 0 ? '#00ff41' : '#333' }}>
                  <div style={{ color: '#ffcc00', fontSize: 12, fontFamily: FONT, fontWeight: 'bold' }}>#{i + 1} {ticker}</div>
                  <div style={{ color: '#888', fontSize: 10, fontFamily: FONT }}>{score} best metrics</div>
                </div>
              ))}
            </div>
          </div>

          {/* Data source note */}
          <div style={{ padding: '6px 10px', color: '#444', fontSize: 9, fontFamily: FONT, textAlign: 'right' }}>
            DATA SOURCE: YAHOO FINANCE V8 CHART API (1Y HISTORICAL)
          </div>
        </>
      )}
    </div>
  );
}
