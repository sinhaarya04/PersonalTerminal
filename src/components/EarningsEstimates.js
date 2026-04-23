import React, { useState, useMemo } from 'react';
import { fetchEarningsData, fetchYFChart } from '../hooks/useYahooFinance';

const FONT = "'Consolas','Courier New',monospace";

const S = {
  container: { background: '#000', minHeight: '600px', display: 'flex', flexDirection: 'column' },
  header: { background: '#0d0d1a', borderBottom: '2px solid #ff8c00', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#ff8c00', fontFamily: FONT, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  body: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 },
  row: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' },
  label: { color: '#888', fontFamily: FONT, fontSize: '10px', textTransform: 'uppercase' },
  input: { background: '#0d0d1a', border: '1px solid #333', color: '#e0e0e0', fontFamily: FONT, fontSize: '12px', padding: '4px 8px', width: '100px', outline: 'none' },
  btn: { background: '#ff8c00', color: '#000', border: 'none', fontFamily: FONT, fontSize: '11px', padding: '5px 16px', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' },
  loadingTxt: { padding: '40px', color: '#ff8c00', fontFamily: FONT, fontSize: '12px', textAlign: 'center', textTransform: 'uppercase' },
  errorTxt: { padding: '20px', color: '#ff4444', fontFamily: FONT, fontSize: '12px' },
  sectionTitle: { color: '#ff8c00', fontFamily: FONT, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #333', paddingBottom: '4px', marginBottom: '8px' },
  metricsRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  metricCard: { background: '#0d0d1a', border: '1px solid #333', padding: '8px 14px', minWidth: '130px' },
  metricLabel: { color: '#888', fontFamily: FONT, fontSize: '9px', textTransform: 'uppercase', marginBottom: '2px' },
  metricValue: (color) => ({ color: color || '#e0e0e0', fontFamily: FONT, fontSize: '16px', fontWeight: 'bold' }),
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: '11px' },
  th: { background: '#0d0d1a', color: '#888', fontFamily: FONT, fontSize: '10px', textTransform: 'uppercase', padding: '4px 8px', border: '1px solid #222', fontWeight: 'normal', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  td: { fontFamily: FONT, fontSize: '11px', color: '#ccc', padding: '3px 8px', border: '1px solid #222', whiteSpace: 'nowrap' },
  tdRight: { textAlign: 'right' },
  svgWrap: { background: '#000', padding: '8px' },
};

function fmtEps(v) { return v != null ? v.toFixed(2) : '--'; }
function fmtDate(epoch) {
  if (!epoch) return '--';
  const d = new Date(epoch * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export default function EarningsEstimates() {
  const [ticker, setTicker] = useState('AAPL');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    const sym = ticker.trim().toUpperCase();
    if (!sym) { setLoading(false); return; }

    try {
      // Fetch earnings meta from v8 chart via the shared hook
      const earningsArr = await fetchEarningsData([sym]);
      const earningsMeta = earningsArr?.[0] || {};

      // Fetch 2Y historical chart for price data + earnings events
      const chartData = await fetchYFChart(sym, '2y', '1d');
      if (!chartData) throw new Error('No chart data returned');

      const { bars, meta } = chartData;
      const price = meta.regularMarketPrice ?? earningsMeta.price ?? null;
      const companyName = meta.shortName || meta.longName || sym;

      // Extract earnings event timestamps from chart meta
      const earningsTimestamp = meta.earningsTimestamp ?? earningsMeta.earningsTimestamp ?? null;
      const earningsTimestampStart = meta.earningsTimestampStart ?? earningsMeta.earningsTimestampStart ?? null;
      const earningsTimestampEnd = meta.earningsTimestampEnd ?? earningsMeta.earningsTimestampEnd ?? null;

      // EPS fields from meta
      const epsTTM = meta.epsTrailingTwelveMonths ?? earningsMeta.epsTTM ?? null;
      const epsForward = meta.epsForward ?? earningsMeta.epsForward ?? null;
      const epsCurrentYear = meta.epsCurrentYear ?? earningsMeta.epsCurrentYear ?? null;

      // Extract earnings event dates from chart events if available
      const earningsEvents = [];
      const rawEarnings = chartData.meta?.earningsEvents || [];
      if (rawEarnings.length) {
        rawEarnings.forEach(e => earningsEvents.push(e));
      }

      // Also infer earnings dates: quarterly pattern from earningsTimestamp
      // We look for the timestamp and step back in ~90-day intervals
      if (earningsTimestamp) {
        // Add the known upcoming earnings date
        earningsEvents.push({ date: earningsTimestamp, type: 'upcoming' });
        // Estimate past earnings dates (roughly quarterly)
        for (let i = 1; i <= 8; i++) {
          earningsEvents.push({ date: earningsTimestamp - (i * 91 * 86400), type: 'estimated' });
        }
      }

      // Compute P/E ratios
      const peTTM = (price != null && epsTTM != null && epsTTM > 0) ? price / epsTTM : null;
      const peForward = (price != null && epsForward != null && epsForward > 0) ? price / epsForward : null;

      // Compute post-earnings drift analysis
      // For each estimated earnings date, find the closest bar and measure +/- 5 day price change
      const driftAnalysis = [];
      const barTimestamps = bars.map(b => b.t / 1000);

      const earningsDates = earningsEvents
        .filter(e => e.date != null)
        .map(e => e.date)
        .sort((a, b) => a - b);

      // Deduplicate earnings dates that are too close (within 30 days)
      const uniqueEDates = [];
      earningsDates.forEach(ed => {
        if (!uniqueEDates.length || ed - uniqueEDates[uniqueEDates.length - 1] > 30 * 86400) {
          uniqueEDates.push(ed);
        }
      });

      uniqueEDates.forEach(ed => {
        // Find closest bar index
        let closest = -1;
        let minDist = Infinity;
        barTimestamps.forEach((bt, idx) => {
          const dist = Math.abs(bt - ed);
          if (dist < minDist) { minDist = dist; closest = idx; }
        });
        // Only consider if within 5 days of a bar
        if (closest < 0 || minDist > 5 * 86400) return;

        const preIdx = Math.max(0, closest - 5);
        const postIdx = Math.min(bars.length - 1, closest + 5);
        const preBars = bars.slice(preIdx, closest);
        const postBars = bars.slice(closest, postIdx + 1);

        if (preBars.length > 0 && postBars.length > 1) {
          const preClose = preBars[0].c;
          const dayOfClose = bars[closest].c;
          const postClose = postBars[postBars.length - 1].c;

          if (preClose && dayOfClose && postClose) {
            const preDrift = ((dayOfClose - preClose) / preClose) * 100;
            const postDrift = ((postClose - dayOfClose) / dayOfClose) * 100;
            const totalDrift = ((postClose - preClose) / preClose) * 100;
            driftAnalysis.push({
              date: ed,
              preClose,
              dayOfClose,
              postClose,
              preDrift,
              postDrift,
              totalDrift,
            });
          }
        }
      });

      // Sort drift analysis by date descending
      driftAnalysis.sort((a, b) => b.date - a.date);

      setData({
        ticker: sym,
        companyName,
        price,
        epsTTM,
        epsForward,
        epsCurrentYear,
        peTTM,
        peForward,
        earningsTimestamp,
        earningsTimestampStart,
        earningsTimestampEnd,
        bars,
        earningsDates: uniqueEDates,
        driftAnalysis,
      });
    } catch (e) {
      setError(e.message || 'Failed to fetch earnings data');
    } finally {
      setLoading(false);
    }
  };

  const renderEpsCards = () => {
    if (!data) return null;
    return (
      <div style={S.metricsRow}>
        {data.price != null && (
          <div style={S.metricCard}>
            <div style={S.metricLabel}>CURRENT PRICE</div>
            <div style={S.metricValue('#ff8c00')}>${data.price.toFixed(2)}</div>
          </div>
        )}
        <div style={S.metricCard}>
          <div style={S.metricLabel}>EPS TTM</div>
          <div style={S.metricValue(data.epsTTM != null ? '#e0e0e0' : '#666')}>{fmtEps(data.epsTTM)}</div>
        </div>
        <div style={S.metricCard}>
          <div style={S.metricLabel}>EPS FORWARD</div>
          <div style={S.metricValue(data.epsForward != null ? '#e0e0e0' : '#666')}>{fmtEps(data.epsForward)}</div>
        </div>
        <div style={S.metricCard}>
          <div style={S.metricLabel}>EPS CURRENT YEAR</div>
          <div style={S.metricValue(data.epsCurrentYear != null ? '#e0e0e0' : '#666')}>{fmtEps(data.epsCurrentYear)}</div>
        </div>
        <div style={S.metricCard}>
          <div style={S.metricLabel}>P/E TTM</div>
          <div style={S.metricValue(data.peTTM != null ? '#e0e0e0' : '#666')}>
            {data.peTTM != null ? data.peTTM.toFixed(1) : '--'}
          </div>
        </div>
        <div style={S.metricCard}>
          <div style={S.metricLabel}>P/E FORWARD</div>
          <div style={S.metricValue(data.peForward != null ? '#e0e0e0' : '#666')}>
            {data.peForward != null ? data.peForward.toFixed(1) : '--'}
          </div>
        </div>
      </div>
    );
  };

  const renderUpcomingEarnings = () => {
    if (!data) return null;
    const { earningsTimestamp, earningsTimestampStart, earningsTimestampEnd } = data;
    if (!earningsTimestamp && !earningsTimestampStart) return null;

    return (
      <div style={{ background: '#0d0d1a', border: '1px solid #333', padding: '8px 14px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ fontFamily: FONT, fontSize: 11, color: '#888' }}>NEXT EARNINGS:</span>
        {earningsTimestampStart && earningsTimestampEnd ? (
          <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 'bold', color: '#ffcc00' }}>
            {fmtDate(earningsTimestampStart)} - {fmtDate(earningsTimestampEnd)}
          </span>
        ) : earningsTimestamp ? (
          <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 'bold', color: '#ffcc00' }}>
            {fmtDate(earningsTimestamp)}
          </span>
        ) : null}
      </div>
    );
  };

  // SVG price chart with vertical earnings date lines
  const renderPriceChart = useMemo(() => {
    if (!data || !data.bars || data.bars.length < 2) return null;

    const bars = data.bars;
    const earningsDates = data.earningsDates || [];
    const W = 700, H = 260;
    const padL = 60, padR = 20, padT = 20, padB = 30;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const closes = bars.map(b => b.c);
    const minP = Math.min(...closes);
    const maxP = Math.max(...closes);
    const rangeP = maxP - minP || 1;

    const tMin = bars[0].t / 1000;
    const tMax = bars[bars.length - 1].t / 1000;
    const tRange = tMax - tMin || 1;

    const xScale = (t) => padL + ((t - tMin) / tRange) * chartW;
    const yScale = (p) => padT + chartH - ((p - minP) / rangeP) * chartH;

    // Build price line path
    const pathD = bars.map((b, i) => {
      const x = xScale(b.t / 1000);
      const y = yScale(b.c);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    // Y-axis labels
    const yLabels = [];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const p = minP + (rangeP / steps) * i;
      yLabels.push({ p, y: yScale(p) });
    }

    // X-axis labels (quarterly)
    const xLabels = [];
    const seen = new Set();
    bars.forEach(b => {
      const d = new Date(b.t);
      const key = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3)}`;
      if (!seen.has(key)) {
        seen.add(key);
        xLabels.push({ t: b.t / 1000, label: `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}` });
      }
    });

    // Earnings date vertical lines
    const earningsLines = earningsDates
      .filter(ed => ed >= tMin && ed <= tMax)
      .map(ed => xScale(ed));

    return (
      <div>
        <div style={S.sectionTitle}>PRICE CHART WITH EARNINGS DATES</div>
        <div style={S.svgWrap}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
            {/* Grid */}
            {yLabels.map((yl, i) => (
              <g key={`yg-${i}`}>
                <line x1={padL} y1={yl.y} x2={W - padR} y2={yl.y} stroke="#1a1a2e" strokeWidth="0.5" />
                <text x={padL - 6} y={yl.y + 3} fill="#666" fontSize="9" fontFamily={FONT} textAnchor="end">${yl.p.toFixed(0)}</text>
              </g>
            ))}

            {/* X labels */}
            {xLabels.map((xl, i) => (
              <text key={`xl-${i}`} x={xScale(xl.t)} y={H - 6} fill="#666" fontSize="8" fontFamily={FONT} textAnchor="middle">{xl.label}</text>
            ))}

            {/* Earnings date vertical lines */}
            {earningsLines.map((x, i) => (
              <g key={`el-${i}`}>
                <line x1={x} y1={padT} x2={x} y2={padT + chartH} stroke="#ff8c00" strokeWidth="1" strokeDasharray="4,3" opacity="0.7" />
                <text x={x} y={padT - 4} fill="#ff8c00" fontSize="7" fontFamily={FONT} textAnchor="middle">E</text>
              </g>
            ))}

            {/* Price line */}
            <path d={pathD} fill="none" stroke="#00ff41" strokeWidth="1.5" />

            {/* Border */}
            <rect x={padL} y={padT} width={chartW} height={chartH} fill="none" stroke="#333" strokeWidth="0.5" />
          </svg>
        </div>
        <div style={{ fontFamily: FONT, fontSize: 9, color: '#666', paddingLeft: 8, marginTop: 2 }}>
          ORANGE DASHED LINES = ESTIMATED EARNINGS DATES
        </div>
      </div>
    );
  }, [data]);

  const renderDriftTable = () => {
    if (!data || !data.driftAnalysis || data.driftAnalysis.length === 0) return null;

    return (
      <div>
        <div style={S.sectionTitle}>POST-EARNINGS DRIFT ANALYSIS (+/- 5 TRADING DAYS)</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, textAlign: 'left' }}>EST. EARNINGS DATE</th>
              <th style={{ ...S.th, textAlign: 'right' }}>PRE CLOSE (-5D)</th>
              <th style={{ ...S.th, textAlign: 'right' }}>DAY OF CLOSE</th>
              <th style={{ ...S.th, textAlign: 'right' }}>POST CLOSE (+5D)</th>
              <th style={{ ...S.th, textAlign: 'right' }}>PRE DRIFT</th>
              <th style={{ ...S.th, textAlign: 'right' }}>POST DRIFT</th>
              <th style={{ ...S.th, textAlign: 'right' }}>TOTAL DRIFT</th>
            </tr>
          </thead>
          <tbody>
            {data.driftAnalysis.map((d, i) => {
              const preColor = d.preDrift >= 0 ? '#00ff41' : '#ff4444';
              const postColor = d.postDrift >= 0 ? '#00ff41' : '#ff4444';
              const totalColor = d.totalDrift >= 0 ? '#00ff41' : '#ff4444';
              return (
                <tr key={i}>
                  <td style={{ ...S.td, textAlign: 'left', color: '#b0b0b0' }}>{fmtDate(d.date)}</td>
                  <td style={{ ...S.td, ...S.tdRight }}>${d.preClose.toFixed(2)}</td>
                  <td style={{ ...S.td, ...S.tdRight, fontWeight: 'bold' }}>${d.dayOfClose.toFixed(2)}</td>
                  <td style={{ ...S.td, ...S.tdRight }}>${d.postClose.toFixed(2)}</td>
                  <td style={{ ...S.td, ...S.tdRight, color: preColor }}>
                    {d.preDrift >= 0 ? '+' : ''}{d.preDrift.toFixed(2)}%
                  </td>
                  <td style={{ ...S.td, ...S.tdRight, color: postColor, fontWeight: 'bold' }}>
                    {d.postDrift >= 0 ? '+' : ''}{d.postDrift.toFixed(2)}%
                  </td>
                  <td style={{ ...S.td, ...S.tdRight, color: totalColor, fontWeight: 'bold' }}>
                    {d.totalDrift >= 0 ? '+' : ''}{d.totalDrift.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDriftChart = () => {
    if (!data || !data.driftAnalysis || data.driftAnalysis.length < 2) return null;

    const items = data.driftAnalysis.slice().reverse(); // chronological order
    const W = 600, barH = 22, gap = 6;
    const padL = 100, padR = 60, padT = 10;
    const H = items.length * (barH + gap) + padT + 10;
    const maxAbs = Math.max(...items.map(d => Math.abs(d.postDrift)), 1);
    const chartW = (W - padL - padR) / 2;
    const centerX = padL + chartW;

    return (
      <div>
        <div style={S.sectionTitle}>POST-EARNINGS DRIFT CHART</div>
        <div style={S.svgWrap}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
            {/* Center line */}
            <line x1={centerX} y1={padT} x2={centerX} y2={H - 10} stroke="#444" strokeWidth="1" />
            <text x={centerX} y={padT - 2} fill="#666" fontSize="8" fontFamily={FONT} textAnchor="middle">0%</text>
            {items.map((item, i) => {
              const y = padT + i * (barH + gap);
              const pct = item.postDrift;
              const bw = (Math.abs(pct) / maxAbs) * chartW;
              const isPos = pct >= 0;
              const x = isPos ? centerX : centerX - bw;
              const color = isPos ? '#00ff41' : '#ff4444';
              return (
                <g key={i}>
                  <text x={padL - 4} y={y + barH / 2 + 4} fill="#b0b0b0" fontSize="9" fontFamily={FONT} textAnchor="end">{fmtDate(item.date)}</text>
                  <rect x={x} y={y} width={Math.max(bw, 1)} height={barH} fill={color} opacity="0.8" rx="1" />
                  <text
                    x={isPos ? centerX + bw + 4 : centerX - bw - 4}
                    y={y + barH / 2 + 4}
                    fill={color} fontSize="10" fontFamily={FONT}
                    textAnchor={isPos ? 'start' : 'end'}
                  >
                    {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  // Summary stats for drift
  const renderDriftSummary = () => {
    if (!data || !data.driftAnalysis || data.driftAnalysis.length === 0) return null;

    const drifts = data.driftAnalysis.map(d => d.postDrift);
    const avgDrift = drifts.reduce((s, v) => s + v, 0) / drifts.length;
    const beatCount = drifts.filter(d => d > 0).length;
    const maxUp = Math.max(...drifts);
    const maxDown = Math.min(...drifts);

    return (
      <div style={S.metricsRow}>
        <div style={S.metricCard}>
          <div style={S.metricLabel}>AVG POST-EARNINGS DRIFT</div>
          <div style={S.metricValue(avgDrift >= 0 ? '#00ff41' : '#ff4444')}>
            {avgDrift >= 0 ? '+' : ''}{avgDrift.toFixed(2)}%
          </div>
        </div>
        <div style={S.metricCard}>
          <div style={S.metricLabel}>POSITIVE DRIFT RATE</div>
          <div style={S.metricValue('#e0e0e0')}>
            {beatCount}/{drifts.length} ({((beatCount / drifts.length) * 100).toFixed(0)}%)
          </div>
        </div>
        <div style={S.metricCard}>
          <div style={S.metricLabel}>BEST POST-EARNINGS</div>
          <div style={S.metricValue('#00ff41')}>+{maxUp.toFixed(2)}%</div>
        </div>
        <div style={S.metricCard}>
          <div style={S.metricLabel}>WORST POST-EARNINGS</div>
          <div style={S.metricValue('#ff4444')}>{maxDown.toFixed(2)}%</div>
        </div>
      </div>
    );
  };

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>EARNINGS ANALYSIS {data ? `\u2014 ${data.ticker}` : ''}</span>
        <span style={{ fontFamily: FONT, fontSize: 10, color: '#666' }}>YAHOO FINANCE</span>
      </div>

      <div style={S.body}>
        {/* Input row */}
        <div style={S.row}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={S.label}>Ticker</span>
            <input
              style={S.input}
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && analyze()}
            />
          </div>
          <button style={S.btn} onClick={analyze} disabled={loading}>ANALYZE</button>
        </div>

        {loading && <div style={S.loadingTxt}>LOADING...</div>}
        {error && !loading && <div style={S.errorTxt}>{error}</div>}

        {data && !loading && (
          <>
            {/* Company name */}
            <div style={{ fontFamily: FONT, fontSize: 12, color: '#b0b0b0' }}>{data.companyName}</div>

            {/* Upcoming earnings date */}
            {renderUpcomingEarnings()}

            {/* EPS metric cards */}
            {renderEpsCards()}

            {/* Price chart with earnings date markers */}
            {renderPriceChart}

            {/* Drift summary cards */}
            {renderDriftSummary()}

            {/* Post-earnings drift table */}
            {renderDriftTable()}

            {/* Post-earnings drift bar chart */}
            {renderDriftChart()}
          </>
        )}
      </div>
    </div>
  );
}
