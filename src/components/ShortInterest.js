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
    border: '1px solid #333', borderRadius: 2, padding: '3px 8px', outline: 'none', width: 220,
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
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: FONT },
  th: {
    background: '#1a1a2e', color: '#ff8c00', fontFamily: FONT, fontSize: 10,
    textAlign: 'right', padding: '3px 8px', border: '1px solid #333',
    textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 'normal',
  },
  thFirst: { textAlign: 'left' },
  td: {
    fontFamily: FONT, fontSize: 11, textAlign: 'right', padding: '3px 8px',
    border: '1px solid #222', color: '#ccc',
  },
  tdFirst: { textAlign: 'left', color: '#ffcc00', fontWeight: 'bold' },
  alertBox: {
    margin: '10px', padding: '10px 14px', borderRadius: 2,
    background: 'rgba(255,68,68,0.08)', border: '1px solid #ff4444',
  },
  alertTitle: { color: '#ff4444', fontSize: 12, fontFamily: FONT, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  alertItem: { display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #222' },
  scoreSection: { padding: '10px', display: 'flex', gap: 8, flexWrap: 'wrap' },
  scoreCard: {
    flex: '1 1 140px', background: '#0d0d1a', border: '1px solid #333',
    borderRadius: 2, padding: '8px 12px', minWidth: 130, textAlign: 'center',
  },
  scoreLabel: { color: '#888', fontSize: 9, textTransform: 'uppercase', fontFamily: FONT, letterSpacing: 0.5 },
  scoreValue: (color) => ({ color, fontSize: 20, fontFamily: FONT, fontWeight: 'bold', marginTop: 2 }),
  svgSection: { padding: '8px 10px' },
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtPrice(n) {
  if (n == null || isNaN(n)) return '--';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return '--';
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}

function fmtVol(n) {
  if (n == null || isNaN(n)) return '--';
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toLocaleString('en-US');
}

function fmtRatio(n) {
  if (n == null || isNaN(n)) return '--';
  return n.toFixed(2) + 'x';
}

function scoreColor(score) {
  if (score >= 70) return '#ff4444';
  if (score >= 50) return '#ff8c00';
  if (score >= 30) return '#ffcc00';
  return '#00ff41';
}

// ── Compute squeeze metrics from v8 chart data ─────────────────────────────
function computeMetrics(meta1d, chart3mo) {
  const price = meta1d.regularMarketPrice ?? null;
  const prevClose = meta1d.chartPreviousClose ?? null;
  const volume = meta1d.regularMarketVolume ?? null;
  const high52 = meta1d.fiftyTwoWeekHigh ?? null;
  const low52 = meta1d.fiftyTwoWeekLow ?? null;
  const dayHigh = meta1d.regularMarketDayHigh ?? null;
  const dayLow = meta1d.regularMarketDayLow ?? null;
  const name = meta1d.shortName || meta1d.longName || meta1d.symbol || '';

  const changePct = price != null && prevClose != null && prevClose !== 0
    ? ((price - prevClose) / prevClose) * 100 : null;

  // Historical closes from 3mo chart
  const closes = chart3mo?.indicators?.quote?.[0]?.close?.filter(c => c != null) || [];
  const volumes = chart3mo?.indicators?.quote?.[0]?.volume?.filter(v => v != null) || [];

  // Average volume (3mo)
  const avgVolume = volumes.length > 0 ? volumes.reduce((s, v) => s + v, 0) / volumes.length : null;

  // Volume ratio (today vs avg)
  const volumeRatio = volume != null && avgVolume != null && avgVolume > 0
    ? volume / avgVolume : null;

  // Historical volatility (annualized std dev of daily returns)
  let volatility = null;
  if (closes.length > 5) {
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i - 1] > 0) returns.push(Math.log(closes[i] / closes[i - 1]));
    }
    if (returns.length > 2) {
      const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
      const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
      volatility = Math.sqrt(variance) * Math.sqrt(252) * 100; // annualized %
    }
  }

  // Distance from 52W high/low
  const distFrom52High = price != null && high52 != null && high52 > 0
    ? ((price - high52) / high52) * 100 : null;
  const distFrom52Low = price != null && low52 != null && low52 > 0
    ? ((price - low52) / low52) * 100 : null;

  // Intraday range
  const intradayRange = dayHigh != null && dayLow != null && dayLow > 0
    ? ((dayHigh - dayLow) / dayLow) * 100 : null;

  // Squeeze score based on: volume ratio, volatility, distance from 52w high
  let score = 0;
  // Volume ratio component (max 40 pts)
  if (volumeRatio != null) {
    if (volumeRatio > 5) score += 40;
    else if (volumeRatio > 3) score += 30;
    else if (volumeRatio > 2) score += 22;
    else if (volumeRatio > 1.5) score += 14;
    else if (volumeRatio > 1) score += 6;
    else score += 2;
  }
  // Volatility component (max 30 pts)
  if (volatility != null) {
    if (volatility > 100) score += 30;
    else if (volatility > 60) score += 22;
    else if (volatility > 40) score += 15;
    else if (volatility > 25) score += 8;
    else score += 2;
  }
  // Distance from 52w high component (max 30 pts): further from high = more bounce potential
  if (distFrom52High != null) {
    const dist = Math.abs(distFrom52High);
    if (dist > 50) score += 30;
    else if (dist > 30) score += 22;
    else if (dist > 20) score += 15;
    else if (dist > 10) score += 8;
    else score += 2;
  }
  score = Math.min(100, Math.max(0, score));

  return {
    name, price, prevClose, changePct, volume, avgVolume, volumeRatio,
    high52, low52, distFrom52High, distFrom52Low,
    dayHigh, dayLow, intradayRange, volatility, score,
  };
}

// ── Fetch squeeze data ──────────────────────────────────────────────────────
async function fetchSqueezeData(tickers) {
  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const [res1d, res3mo] = await Promise.all([
        fetch(`/yf/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d&includePrePost=false`, { signal: AbortSignal.timeout(15000) })
          .then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/yf/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo&includePrePost=false`, { signal: AbortSignal.timeout(15000) })
          .then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      const meta1d = res1d?.chart?.result?.[0]?.meta || {};
      const chart3mo = res3mo?.chart?.result?.[0] || null;

      const metrics = computeMetrics(meta1d, chart3mo);
      return { ticker, ...metrics };
    })
  );

  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

// ── Volume ratio bar chart ──────────────────────────────────────────────────
function VolumeBarChart({ data }) {
  if (!data || data.length === 0) return null;

  const sorted = [...data].filter(d => d.volumeRatio != null).sort((a, b) => (b.volumeRatio || 0) - (a.volumeRatio || 0));
  if (sorted.length === 0) return null;

  const W = 700, barH = 24;
  const H = sorted.length * barH + 40;
  const padL = 70, padR = 90, padT = 20;
  const barMax = Math.max(...sorted.map(d => d.volumeRatio || 0), 1);
  const barW = W - padL - padR;

  return (
    <div style={S.svgSection}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
          <g key={i}>
            <line x1={padL + pct * barW} y1={padT - 5} x2={padL + pct * barW} y2={H - 10} stroke="#1a1a2e" strokeWidth={1} />
            <text x={padL + pct * barW} y={padT - 8} fill="#555" fontSize={8} fontFamily={FONT} textAnchor="middle">
              {(barMax * pct).toFixed(1)}x
            </text>
          </g>
        ))}

        {/* Threshold line at 2x avg */}
        {barMax > 2 && (
          <>
            <line x1={padL + (2 / barMax) * barW} y1={padT} x2={padL + (2 / barMax) * barW} y2={H - 10} stroke="#ff4444" strokeWidth={1} strokeDasharray="4,3" />
            <text x={padL + (2 / barMax) * barW + 3} y={padT + 8} fill="#ff4444" fontSize={7} fontFamily={FONT}>UNUSUAL VOLUME</text>
          </>
        )}

        {sorted.map((d, i) => {
          const y = padT + i * barH;
          const w = ((d.volumeRatio || 0) / barMax) * barW;
          const color = d.volumeRatio > 3 ? '#ff4444' : d.volumeRatio > 2 ? '#ff8c00' : d.volumeRatio > 1.5 ? '#ffcc00' : '#00ff41';
          return (
            <g key={d.ticker}>
              <text x={padL - 6} y={y + 16} fill="#ffcc00" fontSize={10} fontFamily={FONT} textAnchor="end" fontWeight="bold">{d.ticker}</text>
              <rect x={padL} y={y + 4} width={Math.max(w, 2)} height={16} fill={color} rx={1} opacity={0.75} />
              <text x={padL + w + 6} y={y + 16} fill={color} fontSize={10} fontFamily={FONT} fontWeight="bold">
                {(d.volumeRatio || 0).toFixed(2)}x
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ShortInterest() {
  const [input, setInput] = useState('GME,AMC,TSLA,AAPL,NVDA');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyze = useCallback(async () => {
    const tickers = input.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    if (!tickers.length) return;
    setLoading(true);
    setError(null);
    try {
      const results = await fetchSqueezeData(tickers);
      if (!results.length) throw new Error('No data returned');
      setData(results);
    } catch (e) {
      setError(e.message || 'Failed to fetch data');
    }
    setLoading(false);
  }, [input]);

  // Identify unusual volume candidates: volume ratio > 2x
  const squeezeCandidates = data.filter(d =>
    d.volumeRatio != null && d.volumeRatio > 2
  );

  // Sorted by score
  const scored = [...data].sort((a, b) => b.score - a.score);

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>SHORT SQUEEZE SCANNER</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && analyze()}
          placeholder="GME,AMC,TSLA..."
          style={S.input}
        />
        <button onClick={analyze} style={S.btn}>ANALYZE</button>
        {data.length > 0 && (
          <span style={{ color: '#555', fontSize: 10, fontFamily: FONT }}>
            {data.length} TICKERS LOADED
          </span>
        )}
      </div>

      {/* States */}
      {loading && <div style={S.loading}>LOADING...</div>}
      {error && <div style={S.error}>ERROR: {error}</div>}
      {!loading && !error && data.length === 0 && (
        <div style={S.hint}>ENTER TICKERS AND CLICK ANALYZE TO SCAN FOR SQUEEZE CONDITIONS</div>
      )}

      {data.length > 0 && (
        <>
          {/* Squeeze Candidates Alert */}
          {squeezeCandidates.length > 0 && (
            <div style={S.alertBox}>
              <div style={S.alertTitle}>UNUSUAL VOLUME DETECTED</div>
              <div style={{ color: '#888', fontSize: 9, fontFamily: FONT, marginBottom: 6 }}>
                VOLUME RATIO {'>'} 2x AVERAGE -- POTENTIAL SQUEEZE ACTIVITY
              </div>
              {squeezeCandidates.map(d => (
                <div key={d.ticker} style={S.alertItem}>
                  <span style={{ color: '#ffcc00', fontFamily: FONT, fontSize: 13, fontWeight: 'bold', minWidth: 50 }}>{d.ticker}</span>
                  <span style={{ color: '#ff4444', fontFamily: FONT, fontSize: 11 }}>
                    VOL RATIO: {fmtRatio(d.volumeRatio)}
                  </span>
                  <span style={{ color: '#ff8c00', fontFamily: FONT, fontSize: 11 }}>
                    VOLATILITY: {d.volatility != null ? d.volatility.toFixed(1) + '%' : '--'}
                  </span>
                  <span style={{ color: '#ccc', fontFamily: FONT, fontSize: 11 }}>
                    PRICE: {fmtPrice(d.price)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Squeeze Scores */}
          <div style={S.sectionHeader}>SQUEEZE SCORES</div>
          <div style={S.scoreSection}>
            {scored.map(d => (
              <div key={d.ticker} style={{ ...S.scoreCard, borderColor: scoreColor(d.score) }}>
                <div style={{ color: '#ffcc00', fontSize: 12, fontFamily: FONT, fontWeight: 'bold' }}>{d.ticker}</div>
                <div style={S.scoreValue(scoreColor(d.score))}>{d.score}</div>
                <div style={S.scoreLabel}>
                  {d.score >= 70 ? 'HIGH RISK' : d.score >= 50 ? 'ELEVATED' : d.score >= 30 ? 'MODERATE' : 'LOW'}
                </div>
              </div>
            ))}
          </div>

          {/* Comparison Table */}
          <div style={S.sectionHeader}>SQUEEZE SCANNER COMPARISON</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, ...S.thFirst }}>TICKER</th>
                  <th style={S.th}>PRICE</th>
                  <th style={S.th}>CHANGE</th>
                  <th style={S.th}>VOLUME</th>
                  <th style={S.th}>AVG VOL</th>
                  <th style={S.th}>VOL RATIO</th>
                  <th style={S.th}>VOLATILITY</th>
                  <th style={S.th}>52W HIGH</th>
                  <th style={S.th}>% FROM HIGH</th>
                  <th style={S.th}>52W LOW</th>
                  <th style={S.th}>% FROM LOW</th>
                  <th style={S.th}>SCORE</th>
                </tr>
              </thead>
              <tbody>
                {scored.map((d) => {
                  const volColor = d.volumeRatio == null ? '#888'
                    : d.volumeRatio > 3 ? '#ff4444'
                    : d.volumeRatio > 2 ? '#ff8c00'
                    : d.volumeRatio > 1.5 ? '#ffcc00' : '#00ff41';
                  const sc = scoreColor(d.score);

                  return (
                    <tr key={d.ticker}>
                      <td style={{ ...S.td, ...S.tdFirst }}>
                        <div>{d.ticker}</div>
                        <div style={{ color: '#555', fontSize: 9, fontWeight: 'normal' }}>{d.name}</div>
                      </td>
                      <td style={S.td}>{fmtPrice(d.price)}</td>
                      <td style={{ ...S.td, color: d.changePct != null ? (d.changePct >= 0 ? '#00ff41' : '#ff4444') : '#888', fontWeight: 'bold' }}>
                        {d.changePct != null ? fmtPct(d.changePct) : '--'}
                      </td>
                      <td style={S.td}>{fmtVol(d.volume)}</td>
                      <td style={S.td}>{fmtVol(d.avgVolume)}</td>
                      <td style={{ ...S.td, color: volColor, fontWeight: 'bold', fontSize: 12 }}>
                        {d.volumeRatio != null ? fmtRatio(d.volumeRatio) : '--'}
                      </td>
                      <td style={{ ...S.td, color: d.volatility != null && d.volatility > 60 ? '#ff4444' : d.volatility != null && d.volatility > 40 ? '#ffcc00' : '#ccc' }}>
                        {d.volatility != null ? d.volatility.toFixed(1) + '%' : '--'}
                      </td>
                      <td style={S.td}>{fmtPrice(d.high52)}</td>
                      <td style={{ ...S.td, color: d.distFrom52High != null && d.distFrom52High < -20 ? '#ff4444' : '#ccc' }}>
                        {d.distFrom52High != null ? fmtPct(d.distFrom52High) : '--'}
                      </td>
                      <td style={S.td}>{fmtPrice(d.low52)}</td>
                      <td style={{ ...S.td, color: d.distFrom52Low != null && d.distFrom52Low > 50 ? '#00ff41' : '#ccc' }}>
                        {d.distFrom52Low != null ? fmtPct(d.distFrom52Low) : '--'}
                      </td>
                      <td style={{ ...S.td, color: sc, fontWeight: 'bold', fontSize: 13 }}>
                        {d.score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bar Chart */}
          <div style={S.sectionHeader}>VOLUME RATIO -- VISUAL COMPARISON</div>
          <VolumeBarChart data={data} />

          {/* Data source note */}
          <div style={{ padding: '6px 10px', color: '#444', fontSize: 9, fontFamily: FONT, textAlign: 'right' }}>
            SCORE BASED ON: VOLUME RATIO (40%) + PRICE VOLATILITY (30%) + DISTANCE FROM 52W HIGH (30%)
          </div>
        </>
      )}
    </div>
  );
}
