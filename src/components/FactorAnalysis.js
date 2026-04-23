import React, { useState } from 'react';

const FONT = "'Consolas','Courier New',monospace";

const FACTORS = ['Value', 'Momentum', 'Quality', 'Volatility', 'Size'];

function scoreColor(score) {
  if (score == null) return '#333';
  const t = score / 100;
  const r = Math.round(255 * (1 - t));
  const g = Math.round(255 * t);
  return `rgb(${r},${g},0)`;
}

function scoreTextColor(score) {
  return score != null && (score > 30 && score < 70) ? '#000' : '#fff';
}

const S = {
  container: { background: '#000', fontFamily: FONT, display: 'flex', flexDirection: 'column', height: '100%' },
  header: {
    background: '#0d0d1a', borderBottom: '2px solid #ff8c00',
    padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#ff8c00', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase',
    letterSpacing: '1px', fontFamily: FONT,
  },
  headerSub: { color: '#888', fontSize: '10px', fontFamily: FONT },
  toolbar: {
    background: '#1a1a2e', borderBottom: '1px solid #333', padding: '6px 10px',
    display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap',
  },
  label: { color: '#888', fontSize: '10px', textTransform: 'uppercase', fontFamily: FONT, marginRight: '4px' },
  input: {
    fontFamily: FONT, fontSize: '11px', background: '#000', color: '#ffcc00',
    border: '1px solid #333', borderRadius: '2px', padding: '3px 6px', outline: 'none', width: '220px',
  },
  select: {
    fontFamily: FONT, fontSize: '11px', background: '#000', color: '#ffcc00',
    border: '1px solid #333', borderRadius: '2px', padding: '3px 6px', outline: 'none',
  },
  btn: {
    fontFamily: FONT, fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase',
    cursor: 'pointer', border: '1px solid #ff8c00', borderRadius: '2px',
    padding: '4px 14px', background: '#ff8c00', color: '#000', fontWeight: 'bold',
  },
  loading: { padding: '40px', color: '#ff8c00', fontFamily: FONT, fontSize: '13px', textAlign: 'center', textTransform: 'uppercase' },
  error: { padding: '20px', color: '#ff4444', fontFamily: FONT, fontSize: '12px', textAlign: 'center' },
  sectionHeader: {
    background: '#0d0d1a', borderBottom: '1px solid #333', borderTop: '1px solid #333',
    padding: '4px 10px', color: '#ff8c00', fontSize: '11px', fontFamily: FONT,
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: '11px' },
  th: {
    background: '#0d0d1a', color: '#888', fontSize: '10px', textTransform: 'uppercase',
    fontFamily: FONT, padding: '4px 8px', borderBottom: '1px solid #333', textAlign: 'center',
    letterSpacing: '0.5px',
  },
  td: { color: '#ccc', padding: '3px 8px', borderBottom: '1px solid #1a1a2e', fontFamily: FONT, fontSize: '11px', textAlign: 'center' },
  svgWrapper: { padding: '8px 10px', background: '#000' },
};

function Heatmap({ results }) {
  const tickers = results.map(r => r.ticker);
  const cellW = 90, cellH = 32, labelW = 70, headerH = 24;
  const W = labelW + FACTORS.length * cellW;
  const H = headerH + tickers.length * cellH;

  return (
    <div style={S.svgWrapper}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* Column headers */}
        {FACTORS.map((f, ci) => (
          <text key={f} x={labelW + ci * cellW + cellW / 2} y={16} fill="#888" fontFamily={FONT} fontSize="9" textAnchor="middle" style={{ textTransform: 'uppercase' }}>
            {f.toUpperCase()}
          </text>
        ))}
        {/* Rows */}
        {results.map((r, ri) => (
          <g key={r.ticker}>
            <text x={labelW - 6} y={headerH + ri * cellH + cellH / 2 + 4} fill="#ffcc00" fontFamily={FONT} fontSize="11" textAnchor="end" fontWeight="bold">
              {r.ticker}
            </text>
            {FACTORS.map((f, ci) => {
              const score = r.factors?.[f.toLowerCase()] ?? null;
              return (
                <g key={f}>
                  <rect
                    x={labelW + ci * cellW + 2} y={headerH + ri * cellH + 2}
                    width={cellW - 4} height={cellH - 4}
                    rx="2" fill={scoreColor(score)}
                  />
                  <text
                    x={labelW + ci * cellW + cellW / 2} y={headerH + ri * cellH + cellH / 2 + 4}
                    fill={scoreTextColor(score)} fontFamily={FONT} fontSize="11" textAnchor="middle" fontWeight="bold"
                  >
                    {score != null ? score.toFixed(0) : '--'}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

function CompositeBarChart({ results }) {
  const sorted = [...results].sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0));
  const maxScore = Math.max(...sorted.map(r => r.composite_score || 0), 1);
  const barH = 24, gap = 4, labelW = 70, scoreW = 50, padR = 10;
  const W = 600;
  const H = sorted.length * (barH + gap) + 10;
  const barAreaW = W - labelW - scoreW - padR;

  return (
    <div style={S.svgWrapper}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {sorted.map((r, i) => {
          const score = r.composite_score || 0;
          const w = (score / maxScore) * barAreaW;
          const y = i * (barH + gap) + 4;
          const barColor = score >= 70 ? '#00ff41' : score >= 40 ? '#ffcc00' : '#ff4444';
          return (
            <g key={r.ticker}>
              <text x={labelW - 6} y={y + barH / 2 + 4} fill="#ffcc00" fontFamily={FONT} fontSize="11" textAnchor="end" fontWeight="bold">
                {r.ticker}
              </text>
              <rect x={labelW} y={y} width={w} height={barH} rx="2" fill={barColor} fillOpacity="0.8" />
              <text x={labelW + w + 6} y={y + barH / 2 + 4} fill="#ccc" fontFamily={FONT} fontSize="11" textAnchor="start">
                {score.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RadarChart({ result }) {
  const factors = FACTORS;
  const n = factors.length;
  const cx = 120, cy = 120, R = 90;
  const W = 240, H = 260;

  const angles = factors.map((_, i) => (Math.PI * 2 * i) / n - Math.PI / 2);
  const pointAt = (angle, r) => ({
    x: cx + Math.cos(angle) * r,
    y: cy + Math.sin(angle) * r,
  });

  const rings = [20, 40, 60, 80, 100];
  const scores = factors.map(f => result.factors?.[f.toLowerCase()] ?? 0);
  const dataPts = scores.map((s, i) => pointAt(angles[i], (s / 100) * R));
  const dataPath = dataPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <div style={{ display: 'inline-block', margin: '4px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="220" style={{ display: 'block' }}>
        {/* Rings */}
        {rings.map(r => {
          const pts = angles.map(a => pointAt(a, (r / 100) * R));
          const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
          return <path key={r} d={path} fill="none" stroke="#222" strokeWidth="0.5" />;
        })}
        {/* Axis lines */}
        {angles.map((a, i) => {
          const p = pointAt(a, R);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#333" strokeWidth="0.5" />;
        })}
        {/* Data fill */}
        <path d={dataPath} fill="#ff8c00" fillOpacity="0.15" stroke="#ff8c00" strokeWidth="1.5" />
        {/* Data points */}
        {dataPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#ff8c00" />
        ))}
        {/* Labels */}
        {factors.map((f, i) => {
          const lp = pointAt(angles[i], R + 14);
          return (
            <text key={f} x={lp.x} y={lp.y + 3} fill="#888" fontFamily={FONT} fontSize="8" textAnchor="middle">
              {f.toUpperCase()}
            </text>
          );
        })}
        {/* Ticker label */}
        <text x={cx} y={H - 4} fill="#ffcc00" fontFamily={FONT} fontSize="11" textAnchor="middle" fontWeight="bold">
          {result.ticker}
        </text>
      </svg>
    </div>
  );
}

export default function FactorAnalysis() {
  const [tickersInput, setTickersInput] = useState('AAPL,MSFT,GOOG,AMZN,META');
  const [period, setPeriod] = useState('1y');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const tickers = tickersInput.split(',').map(t => t.trim().toUpperCase()).filter(Boolean).slice(0, 10).join(',');
      const params = new URLSearchParams({ tickers, period });
      const res = await fetch(`/analytics/factors?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const results = data?.results || [];

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.headerTitle}>MULTI-FACTOR ANALYSIS</span>
        <span style={S.headerSub}>ANALYTICS ENGINE</span>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={S.label}>TICKERS</span>
          <input style={S.input} value={tickersInput} onChange={e => setTickersInput(e.target.value)} placeholder="AAPL,MSFT,GOOG (max 10)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={S.label}>PERIOD</span>
          <select style={S.select} value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="6mo">6M</option>
            <option value="1y">1Y</option>
            <option value="2y">2Y</option>
          </select>
        </div>
        <button style={S.btn} onClick={run}>ANALYZE</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={S.loading}>LOADING...</div>}
        {error && <div style={S.error}>ERROR: {error}</div>}

        {data && !loading && results.length > 0 && (
          <>
            {/* Factor Heatmap */}
            <div style={S.sectionHeader}>FACTOR HEATMAP</div>
            <Heatmap results={results} />

            {/* Composite Score Ranking */}
            <div style={S.sectionHeader}>COMPOSITE SCORE RANKING</div>
            <CompositeBarChart results={results} />

            {/* Radar Charts */}
            <div style={S.sectionHeader}>FACTOR PROFILES</div>
            <div style={{ padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {results.map(r => <RadarChart key={r.ticker} result={r} />)}
            </div>

            {/* Detailed Metrics Table */}
            <div style={S.sectionHeader}>DETAILED METRICS</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, textAlign: 'left' }}>TICKER</th>
                    <th style={S.th}>P/E</th>
                    <th style={S.th}>P/B</th>
                    <th style={S.th}>ROE</th>
                    <th style={S.th}>DEBT/EQ</th>
                    <th style={S.th}>REVENUE GR</th>
                    <th style={S.th}>MARGIN</th>
                    <th style={S.th}>BETA</th>
                    <th style={S.th}>MKT CAP</th>
                    <th style={S.th}>COMPOSITE</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => {
                    const m = r.metrics || {};
                    const fmtV = (v, suffix) => v != null ? v.toFixed(2) + (suffix || '') : '--';
                    const fmtCap = (v) => {
                      if (v == null) return '--';
                      if (v >= 1e12) return (v / 1e12).toFixed(1) + 'T';
                      if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
                      if (v >= 1e6) return (v / 1e6).toFixed(0) + 'M';
                      return String(v);
                    };
                    return (
                      <tr key={r.ticker}>
                        <td style={{ ...S.td, textAlign: 'left', color: '#ffcc00', fontWeight: 'bold' }}>{r.ticker}</td>
                        <td style={S.td}>{fmtV(m.pe)}</td>
                        <td style={S.td}>{fmtV(m.pb)}</td>
                        <td style={S.td}>{fmtV(m.roe, '%')}</td>
                        <td style={S.td}>{fmtV(m.debt_equity)}</td>
                        <td style={S.td}>{fmtV(m.revenue_growth, '%')}</td>
                        <td style={S.td}>{fmtV(m.margin, '%')}</td>
                        <td style={S.td}>{fmtV(m.beta)}</td>
                        <td style={S.td}>{fmtCap(m.market_cap)}</td>
                        <td style={{
                          ...S.td,
                          color: r.composite_score >= 70 ? '#00ff41' : r.composite_score >= 40 ? '#ffcc00' : '#ff4444',
                          fontWeight: 'bold',
                        }}>
                          {r.composite_score != null ? r.composite_score.toFixed(1) : '--'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {data && !loading && results.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#555', fontSize: '12px', fontFamily: FONT, textTransform: 'uppercase' }}>
            NO FACTOR DATA AVAILABLE
          </div>
        )}

        {!data && !loading && !error && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ color: '#555', fontSize: '12px', fontFamily: FONT, textTransform: 'uppercase' }}>
              ENTER UP TO 10 TICKERS AND CLICK ANALYZE
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
