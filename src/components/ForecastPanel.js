import React, { useState } from 'react';

const FONT = "'Consolas','Courier New',monospace";

const METHOD_COLORS = {
  linear: '#00bfff',
  ema: '#ff8c00',
  mean_reversion: '#cc44ff',
  ensemble: '#00ff41',
};

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
    border: '1px solid #333', borderRadius: '2px', padding: '3px 6px', outline: 'none', width: '70px',
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
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '6px', padding: '10px',
  },
  statCard: {
    background: '#0d0d1a', border: '1px solid #333', borderRadius: '2px', padding: '8px 10px',
  },
  statLabel: { color: '#888', fontSize: '9px', textTransform: 'uppercase', fontFamily: FONT, letterSpacing: '0.5px' },
  statValue: (color) => ({ color: color || '#fff', fontSize: '16px', fontFamily: FONT, fontWeight: 'bold', marginTop: '2px' }),
  svgWrapper: { padding: '8px 10px', background: '#000' },
  legendRow: { display: 'flex', gap: '16px', padding: '4px 10px', alignItems: 'center', flexWrap: 'wrap' },
  legendItem: (color) => ({
    display: 'flex', alignItems: 'center', gap: '4px',
    color: '#888', fontFamily: FONT, fontSize: '10px',
  }),
  legendSwatch: (color) => ({ width: '16px', height: '3px', background: color, display: 'inline-block' }),
};

function ForecastChart({ data, method }) {
  const hist = data.historical || [];
  const forecast = data.forecast || [];
  const methods = data.method_forecasts || {};
  const upper = data.upper_band || [];
  const lower = data.lower_band || [];

  if (hist.length < 2) return null;

  const W = 900, H = 280;
  const padL = 60, padR = 16, padT = 16, padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const totalLen = hist.length + forecast.length;
  const allPrices = [
    ...hist.map(d => d.price),
    ...forecast.map(d => d.price),
    ...upper.map(d => d.price),
    ...lower.map(d => d.price),
  ];
  Object.values(methods).forEach(m => {
    if (Array.isArray(m)) allPrices.push(...m.map(d => d.price));
  });

  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const range = maxP - minP || 1;

  const xScale = (i) => padL + (i / (totalLen - 1)) * chartW;
  const yScale = (v) => padT + (1 - (v - minP) / range) * chartH;

  const histPts = hist.map((d, i) => `${xScale(i)},${yScale(d.price)}`).join(' ');
  const forecastPts = forecast.map((d, i) => `${xScale(hist.length + i)},${yScale(d.price)}`).join(' ');

  // Confidence band polygon
  let bandPoly = null;
  if (upper.length > 0 && lower.length > 0) {
    const topPts = upper.map((d, i) => `${xScale(hist.length + i)},${yScale(d.price)}`);
    const btmPts = lower.map((d, i) => `${xScale(hist.length + i)},${yScale(d.price)}`).reverse();
    bandPoly = [...topPts, ...btmPts].join(' ');
  }

  // Method lines (for ensemble)
  const methodLines = method === 'ensemble' ? Object.entries(methods) : [];

  const gridLines = 5;
  const gridVals = Array.from({ length: gridLines }, (_, i) => minP + (range * i) / (gridLines - 1));

  const dividerX = xScale(hist.length - 1);

  // Date labels
  const allDates = [...hist.map(d => d.date), ...forecast.map(d => d.date)];
  const labelCount = Math.min(7, totalLen);
  const dateLabels = Array.from({ length: labelCount }, (_, i) => {
    const idx = Math.round((i / (labelCount - 1)) * (totalLen - 1));
    return { x: xScale(idx), label: allDates[idx] || '' };
  });

  return (
    <div>
      <div style={S.svgWrapper}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
          {/* Grid */}
          {gridVals.map((v, i) => (
            <g key={i}>
              <line x1={padL} y1={yScale(v)} x2={W - padR} y2={yScale(v)} stroke="#222" strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={padL - 4} y={yScale(v) + 3} fill="#555" fontFamily={FONT} fontSize="8" textAnchor="end">
                ${v.toFixed(0)}
              </text>
            </g>
          ))}

          {/* Forecast/history divider */}
          <line x1={dividerX} y1={padT} x2={dividerX} y2={padT + chartH} stroke="#444" strokeWidth="1" strokeDasharray="4,3" />
          <text x={dividerX + 4} y={padT + 10} fill="#555" fontFamily={FONT} fontSize="8">FORECAST</text>

          {/* Confidence band */}
          {bandPoly && <polygon points={bandPoly} fill="#00ff41" fillOpacity="0.07" />}

          {/* Historical line */}
          <polyline points={histPts} fill="none" stroke="#ccc" strokeWidth="1.5" />

          {/* Method lines (ensemble) */}
          {methodLines.map(([name, pts]) => {
            if (!Array.isArray(pts) || pts.length < 2) return null;
            const line = pts.map((d, i) => `${xScale(hist.length + i)},${yScale(d.price)}`).join(' ');
            return (
              <polyline key={name} points={line} fill="none" stroke={METHOD_COLORS[name] || '#888'} strokeWidth="1" strokeDasharray="3,2" />
            );
          })}

          {/* Forecast line */}
          {forecast.length > 0 && (
            <polyline points={forecastPts} fill="none" stroke="#00ff41" strokeWidth="2" />
          )}

          {/* Connect last hist point to first forecast */}
          {hist.length > 0 && forecast.length > 0 && (
            <line
              x1={xScale(hist.length - 1)} y1={yScale(hist[hist.length - 1].price)}
              x2={xScale(hist.length)} y2={yScale(forecast[0].price)}
              stroke="#00ff41" strokeWidth="2" strokeDasharray="2,2"
            />
          )}

          {/* Date labels */}
          {dateLabels.map((dl, i) => (
            <text key={i} x={dl.x} y={H - padB + 14} fill="#555" fontFamily={FONT} fontSize="8" textAnchor="middle">
              {dl.label}
            </text>
          ))}

          <rect x={padL} y={padT} width={chartW} height={chartH} fill="none" stroke="#333" strokeWidth="0.5" />
        </svg>
      </div>
      <div style={S.legendRow}>
        <span style={S.legendItem('#ccc')}>
          <span style={S.legendSwatch('#ccc')} /> HISTORICAL
        </span>
        <span style={S.legendItem('#00ff41')}>
          <span style={S.legendSwatch('#00ff41')} /> FORECAST
        </span>
        {bandPoly && (
          <span style={S.legendItem('#00ff41')}>
            <span style={{ ...S.legendSwatch('#00ff41'), opacity: 0.3 }} /> CONFIDENCE BAND
          </span>
        )}
        {methodLines.map(([name]) => (
          <span key={name} style={S.legendItem(METHOD_COLORS[name] || '#888')}>
            <span style={S.legendSwatch(METHOD_COLORS[name] || '#888')} /> {name.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ForecastPanel() {
  const [ticker, setTicker] = useState('AAPL');
  const [days, setDays] = useState('30');
  const [method, setMethod] = useState('ensemble');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({
        ticker: ticker.toUpperCase().trim(),
        days,
        method,
      });
      const res = await fetch(`/analytics/forecast?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const summary = data?.summary || {};

  const trendColor = (trend) => {
    if (!trend) return '#888';
    const t = trend.toLowerCase();
    if (t === 'bullish') return '#00ff41';
    if (t === 'bearish') return '#ff4444';
    return '#ffcc00';
  };

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.headerTitle}>PRICE FORECAST</span>
        <span style={S.headerSub}>ANALYTICS ENGINE</span>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={S.label}>TICKER</span>
          <input style={{ ...S.input, width: '60px' }} value={ticker} onChange={e => setTicker(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={S.label}>DAYS</span>
          <input style={{ ...S.input, width: '50px' }} type="number" value={days} onChange={e => setDays(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={S.label}>METHOD</span>
          <select style={S.select} value={method} onChange={e => setMethod(e.target.value)}>
            <option value="linear">LINEAR</option>
            <option value="ema">EMA</option>
            <option value="mean_reversion">MEAN REVERSION</option>
            <option value="ensemble">ENSEMBLE</option>
          </select>
        </div>
        <button style={S.btn} onClick={run}>RUN FORECAST</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={S.loading}>LOADING...</div>}
        {error && <div style={S.error}>ERROR: {error}</div>}

        {data && !loading && (
          <>
            {/* Forecast Chart */}
            <div style={S.sectionHeader}>
              PRICE FORECAST \u2014 {ticker.toUpperCase()} \u2014 {days} DAYS \u2014 {method.toUpperCase()}
            </div>
            <ForecastChart data={data} method={method} />

            {/* Summary Cards */}
            <div style={S.sectionHeader}>FORECAST SUMMARY</div>
            <div style={S.statsGrid}>
              <div style={S.statCard}>
                <div style={S.statLabel}>PREDICTED PRICE</div>
                <div style={S.statValue('#fff')}>
                  ${summary.predicted_price != null ? summary.predicted_price.toFixed(2) : '--'}
                </div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>EXPECTED RETURN</div>
                <div style={S.statValue(summary.expected_return >= 0 ? '#00ff41' : '#ff4444')}>
                  {summary.expected_return != null
                    ? (summary.expected_return >= 0 ? '+' : '') + (summary.expected_return * 100).toFixed(2) + '%'
                    : '--'}
                </div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>TREND</div>
                <div style={S.statValue(trendColor(summary.trend))}>
                  {summary.trend ? summary.trend.toUpperCase() : '--'}
                </div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>CONFIDENCE RANGE</div>
                <div style={S.statValue('#888')}>
                  {summary.confidence_low != null && summary.confidence_high != null
                    ? `$${summary.confidence_low.toFixed(2)} - $${summary.confidence_high.toFixed(2)}`
                    : '--'}
                </div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>DAILY VOLATILITY</div>
                <div style={S.statValue('#ffcc00')}>
                  {summary.daily_volatility != null ? (summary.daily_volatility * 100).toFixed(2) + '%' : '--'}
                </div>
              </div>
              <div style={S.statCard}>
                <div style={S.statLabel}>ANNUAL VOLATILITY</div>
                <div style={S.statValue('#ffcc00')}>
                  {summary.annual_volatility != null ? (summary.annual_volatility * 100).toFixed(2) + '%' : '--'}
                </div>
              </div>
            </div>
          </>
        )}

        {!data && !loading && !error && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ color: '#555', fontSize: '12px', fontFamily: FONT, textTransform: 'uppercase' }}>
              CONFIGURE PARAMETERS AND CLICK RUN FORECAST
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
