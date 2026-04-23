import React, { useState } from 'react';

const FONT = "'Consolas','Courier New',monospace";

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
  svgWrapper: { padding: '4px 10px', background: '#000' },
  legendRow: { display: 'flex', gap: '12px', padding: '2px 10px 6px', alignItems: 'center', flexWrap: 'wrap' },
  legendItem: (color) => ({
    display: 'flex', alignItems: 'center', gap: '4px',
    color: '#888', fontFamily: FONT, fontSize: '9px',
  }),
  legendSwatch: (color) => ({ width: '14px', height: '2px', background: color, display: 'inline-block' }),
  signalGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '6px', padding: '10px',
  },
  signalCard: {
    background: '#0d0d1a', border: '1px solid #333', borderRadius: '2px', padding: '8px 10px',
  },
  signalLabel: { color: '#888', fontSize: '9px', textTransform: 'uppercase', fontFamily: FONT, letterSpacing: '0.5px' },
  signalValue: (color) => ({ color: color || '#fff', fontSize: '13px', fontFamily: FONT, fontWeight: 'bold', marginTop: '2px' }),
  overallSignal: (color) => ({
    textAlign: 'center', padding: '14px 10px', color,
    fontFamily: FONT, fontSize: '22px', fontWeight: 'bold',
    textTransform: 'uppercase', letterSpacing: '2px',
  }),
};

function CandlestickChart({ data }) {
  const candles = data.candles || [];
  const sma20 = data.sma20 || [];
  const sma50 = data.sma50 || [];
  const sma200 = data.sma200 || [];
  const bbUpper = data.bb_upper || [];
  const bbLower = data.bb_lower || [];
  const volumes = data.volumes || [];

  if (candles.length < 2) return null;

  const W = 900, mainH = 280, volH = 50;
  const H = mainH + volH;
  const padL = 60, padR = 16, padT = 12, padB = 24;
  const chartW = W - padL - padR;
  const mainChartH = mainH - padT - padB;
  const volBottom = H - 4;

  const allPrices = [];
  candles.forEach(c => { allPrices.push(c.high, c.low); });
  sma20.forEach(d => allPrices.push(d.value));
  sma50.forEach(d => allPrices.push(d.value));
  sma200.forEach(d => allPrices.push(d.value));
  bbUpper.forEach(d => allPrices.push(d.value));
  bbLower.forEach(d => allPrices.push(d.value));

  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const priceRange = maxP - minP || 1;
  const maxVol = Math.max(...volumes.map(v => v.value || 0), 1);

  const candleW = Math.max(1, (chartW / candles.length) * 0.7);
  const gap = chartW / candles.length;

  const xAt = (i) => padL + i * gap + gap / 2;
  const yP = (v) => padT + (1 - (v - minP) / priceRange) * mainChartH;
  const yV = (v) => volBottom - (v / maxVol) * (volH - 8);

  const smaLine = (arr, color) => {
    if (arr.length < 2) return null;
    const pts = arr.map((d, i) => {
      const ci = candles.findIndex(c => c.date === d.date);
      const x = ci >= 0 ? xAt(ci) : xAt(i);
      return `${x},${yP(d.value)}`;
    }).join(' ');
    return <polyline points={pts} fill="none" stroke={color} strokeWidth="1" />;
  };

  // Bollinger band fill
  let bbPoly = null;
  if (bbUpper.length > 1 && bbLower.length > 1) {
    const upperPts = bbUpper.map((d, i) => {
      const ci = candles.findIndex(c => c.date === d.date);
      return `${ci >= 0 ? xAt(ci) : xAt(i)},${yP(d.value)}`;
    });
    const lowerPts = bbLower.map((d, i) => {
      const ci = candles.findIndex(c => c.date === d.date);
      return `${ci >= 0 ? xAt(ci) : xAt(i)},${yP(d.value)}`;
    }).reverse();
    bbPoly = [...upperPts, ...lowerPts].join(' ');
  }

  const gridLines = 5;
  const gridVals = Array.from({ length: gridLines }, (_, i) => minP + (priceRange * i) / (gridLines - 1));

  const labelCount = Math.min(6, candles.length);
  const dateLabels = Array.from({ length: labelCount }, (_, i) => {
    const idx = Math.round((i / (labelCount - 1)) * (candles.length - 1));
    return { x: xAt(idx), label: candles[idx]?.date || '' };
  });

  return (
    <div>
      <div style={S.svgWrapper}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
          {/* Price grid */}
          {gridVals.map((v, i) => (
            <g key={i}>
              <line x1={padL} y1={yP(v)} x2={W - padR} y2={yP(v)} stroke="#1a1a2e" strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={padL - 4} y={yP(v) + 3} fill="#555" fontFamily={FONT} fontSize="8" textAnchor="end">${v.toFixed(0)}</text>
            </g>
          ))}

          {/* Volume/price separator */}
          <line x1={padL} y1={mainH} x2={W - padR} y2={mainH} stroke="#333" strokeWidth="0.5" />

          {/* Bollinger band */}
          {bbPoly && <polygon points={bbPoly} fill="#555" fillOpacity="0.08" />}

          {/* SMA lines */}
          {smaLine(sma20, '#00bfff')}
          {smaLine(sma50, '#ffcc00')}
          {smaLine(sma200, '#ff4444')}

          {/* Candlesticks */}
          {candles.map((c, i) => {
            const x = xAt(i);
            const isUp = c.close >= c.open;
            const color = isUp ? '#00ff41' : '#ff4444';
            const bodyTop = yP(Math.max(c.open, c.close));
            const bodyBot = yP(Math.min(c.open, c.close));
            const bodyH = Math.max(1, bodyBot - bodyTop);
            return (
              <g key={i}>
                {/* Wick */}
                <line x1={x} y1={yP(c.high)} x2={x} y2={yP(c.low)} stroke={color} strokeWidth="0.7" />
                {/* Body */}
                <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={isUp ? 'transparent' : color} stroke={color} strokeWidth="0.7" />
              </g>
            );
          })}

          {/* Volume bars */}
          {volumes.map((v, i) => {
            const x = xAt(i);
            const h = volBottom - yV(v.value || 0);
            const isUp = candles[i] && candles[i].close >= candles[i].open;
            return (
              <rect key={i} x={x - candleW / 2} y={yV(v.value || 0)} width={candleW} height={h}
                fill={isUp ? '#00ff41' : '#ff4444'} fillOpacity="0.3"
              />
            );
          })}

          {/* Date labels */}
          {dateLabels.map((dl, i) => (
            <text key={i} x={dl.x} y={mainH - 4} fill="#555" fontFamily={FONT} fontSize="7" textAnchor="middle">{dl.label}</text>
          ))}

          {/* Borders */}
          <rect x={padL} y={padT} width={chartW} height={mainChartH} fill="none" stroke="#333" strokeWidth="0.5" />
        </svg>
      </div>
      <div style={S.legendRow}>
        <span style={S.legendItem('#00bfff')}><span style={S.legendSwatch('#00bfff')} /> SMA20</span>
        <span style={S.legendItem('#ffcc00')}><span style={S.legendSwatch('#ffcc00')} /> SMA50</span>
        <span style={S.legendItem('#ff4444')}><span style={S.legendSwatch('#ff4444')} /> SMA200</span>
        <span style={S.legendItem('#555')}><span style={{ ...S.legendSwatch('#555'), opacity: 0.5 }} /> BOLLINGER</span>
      </div>
    </div>
  );
}

function RSIChart({ rsi }) {
  if (!rsi || rsi.length < 2) return null;

  const W = 900, H = 100;
  const padL = 60, padR = 16, padT = 8, padB = 8;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const xAt = (i) => padL + (i / (rsi.length - 1)) * chartW;
  const yAt = (v) => padT + (1 - v / 100) * chartH;

  const pts = rsi.map((d, i) => `${xAt(i)},${yAt(d.value)}`).join(' ');

  return (
    <div style={S.svgWrapper}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* 30/70 lines */}
        <line x1={padL} y1={yAt(70)} x2={W - padR} y2={yAt(70)} stroke="#00ff41" strokeWidth="0.5" strokeDasharray="3,3" />
        <line x1={padL} y1={yAt(30)} x2={W - padR} y2={yAt(30)} stroke="#ff4444" strokeWidth="0.5" strokeDasharray="3,3" />
        <line x1={padL} y1={yAt(50)} x2={W - padR} y2={yAt(50)} stroke="#333" strokeWidth="0.5" strokeDasharray="2,2" />

        <text x={padL - 4} y={yAt(70) + 3} fill="#555" fontFamily={FONT} fontSize="7" textAnchor="end">70</text>
        <text x={padL - 4} y={yAt(30) + 3} fill="#555" fontFamily={FONT} fontSize="7" textAnchor="end">30</text>
        <text x={padL - 4} y={yAt(50) + 3} fill="#555" fontFamily={FONT} fontSize="7" textAnchor="end">50</text>

        {/* Overbought/oversold shading */}
        <rect x={padL} y={yAt(100)} width={chartW} height={yAt(70) - yAt(100)} fill="#00ff41" fillOpacity="0.03" />
        <rect x={padL} y={yAt(30)} width={chartW} height={yAt(0) - yAt(30)} fill="#ff4444" fillOpacity="0.03" />

        <polyline points={pts} fill="none" stroke="#cc44ff" strokeWidth="1.2" />

        <rect x={padL} y={padT} width={chartW} height={chartH} fill="none" stroke="#333" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

function MACDChart({ macd }) {
  if (!macd || macd.length < 2) return null;

  const W = 900, H = 100;
  const padL = 60, padR = 16, padT = 8, padB = 8;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const allVals = [];
  macd.forEach(d => { allVals.push(d.macd || 0, d.signal || 0, d.histogram || 0); });
  const maxAbs = Math.max(Math.abs(Math.min(...allVals)), Math.abs(Math.max(...allVals)), 0.01);

  const xAt = (i) => padL + (i / (macd.length - 1)) * chartW;
  const yAt = (v) => padT + (1 - (v / maxAbs + 1) / 2) * chartH;
  const zeroY = yAt(0);
  const barW = Math.max(1, (chartW / macd.length) * 0.6);

  const macdPts = macd.map((d, i) => `${xAt(i)},${yAt(d.macd || 0)}`).join(' ');
  const sigPts = macd.map((d, i) => `${xAt(i)},${yAt(d.signal || 0)}`).join(' ');

  return (
    <div style={S.svgWrapper}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* Zero line */}
        <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="#444" strokeWidth="0.5" />

        {/* Histogram bars */}
        {macd.map((d, i) => {
          const v = d.histogram || 0;
          const y = v >= 0 ? yAt(v) : zeroY;
          const h = Math.abs(yAt(v) - zeroY);
          return (
            <rect key={i} x={xAt(i) - barW / 2} y={y} width={barW} height={Math.max(0.5, h)}
              fill={v >= 0 ? '#00ff41' : '#ff4444'} fillOpacity="0.4"
            />
          );
        })}

        {/* MACD + Signal lines */}
        <polyline points={macdPts} fill="none" stroke="#00bfff" strokeWidth="1.2" />
        <polyline points={sigPts} fill="none" stroke="#ff8c00" strokeWidth="1" strokeDasharray="3,2" />

        <rect x={padL} y={padT} width={chartW} height={chartH} fill="none" stroke="#333" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

function StochasticChart({ stochastic }) {
  if (!stochastic || stochastic.length < 2) return null;

  const W = 900, H = 100;
  const padL = 60, padR = 16, padT = 8, padB = 8;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const xAt = (i) => padL + (i / (stochastic.length - 1)) * chartW;
  const yAt = (v) => padT + (1 - v / 100) * chartH;

  const kPts = stochastic.map((d, i) => `${xAt(i)},${yAt(d.k || 0)}`).join(' ');
  const dPts = stochastic.map((d, i) => `${xAt(i)},${yAt(d.d || 0)}`).join(' ');

  return (
    <div style={S.svgWrapper}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <line x1={padL} y1={yAt(80)} x2={W - padR} y2={yAt(80)} stroke="#00ff41" strokeWidth="0.5" strokeDasharray="3,3" />
        <line x1={padL} y1={yAt(20)} x2={W - padR} y2={yAt(20)} stroke="#ff4444" strokeWidth="0.5" strokeDasharray="3,3" />

        <text x={padL - 4} y={yAt(80) + 3} fill="#555" fontFamily={FONT} fontSize="7" textAnchor="end">80</text>
        <text x={padL - 4} y={yAt(20) + 3} fill="#555" fontFamily={FONT} fontSize="7" textAnchor="end">20</text>

        <polyline points={kPts} fill="none" stroke="#00bfff" strokeWidth="1.2" />
        <polyline points={dPts} fill="none" stroke="#ff8c00" strokeWidth="1" strokeDasharray="3,2" />

        <rect x={padL} y={padT} width={chartW} height={chartH} fill="none" stroke="#333" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

function signalColor(signal) {
  if (!signal) return '#888';
  const s = signal.toLowerCase();
  if (s.includes('strong buy') || s === 'bullish' || s === 'buy') return '#00ff41';
  if (s.includes('strong sell') || s === 'bearish' || s === 'sell') return '#ff4444';
  if (s === 'overbought') return '#ff8c00';
  if (s === 'oversold') return '#cc44ff';
  return '#ffcc00';
}

function overallColor(signal) {
  if (!signal) return '#888';
  const s = signal.toLowerCase();
  if (s === 'strong buy') return '#00ff41';
  if (s === 'buy') return '#00cc00';
  if (s === 'strong sell') return '#ff4444';
  if (s === 'sell') return '#ff6666';
  return '#ffcc00';
}

export default function TechAnalysis() {
  const [ticker, setTicker] = useState('AAPL');
  const [period, setPeriod] = useState('6mo');
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
        period,
        indicators: 'all',
      });
      const res = await fetch(`/analytics/technicals?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const signals = data?.signals || {};
  const overall = data?.overall_signal || null;

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.headerTitle}>TECHNICAL ANALYSIS</span>
        <span style={S.headerSub}>ANALYTICS ENGINE</span>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={S.label}>TICKER</span>
          <input style={{ ...S.input, width: '60px' }} value={ticker} onChange={e => setTicker(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={S.label}>PERIOD</span>
          <select style={S.select} value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="1mo">1M</option>
            <option value="3mo">3M</option>
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

        {data && !loading && (
          <>
            {/* Overall Signal */}
            {overall && (
              <div style={{ background: '#0d0d1a', borderBottom: '1px solid #333' }}>
                <div style={S.overallSignal(overallColor(overall))}>{overall}</div>
              </div>
            )}

            {/* Signal Summary */}
            <div style={S.sectionHeader}>SIGNAL SUMMARY</div>
            <div style={S.signalGrid}>
              <div style={S.signalCard}>
                <div style={S.signalLabel}>RSI STATUS</div>
                <div style={S.signalValue(signalColor(signals.rsi))}>
                  {signals.rsi ? signals.rsi.toUpperCase() : '--'}
                </div>
              </div>
              <div style={S.signalCard}>
                <div style={S.signalLabel}>MACD SIGNAL</div>
                <div style={S.signalValue(signalColor(signals.macd))}>
                  {signals.macd ? signals.macd.toUpperCase() : '--'}
                </div>
              </div>
              <div style={S.signalCard}>
                <div style={S.signalLabel}>SMA CROSS</div>
                <div style={S.signalValue(signalColor(signals.sma_cross))}>
                  {signals.sma_cross ? signals.sma_cross.toUpperCase() : '--'}
                </div>
              </div>
              <div style={S.signalCard}>
                <div style={S.signalLabel}>PRICE VS SMA</div>
                <div style={S.signalValue(signalColor(signals.price_vs_sma))}>
                  {signals.price_vs_sma ? signals.price_vs_sma.toUpperCase() : '--'}
                </div>
              </div>
              <div style={S.signalCard}>
                <div style={S.signalLabel}>STOCHASTIC</div>
                <div style={S.signalValue(signalColor(signals.stochastic))}>
                  {signals.stochastic ? signals.stochastic.toUpperCase() : '--'}
                </div>
              </div>
              <div style={S.signalCard}>
                <div style={S.signalLabel}>BOLLINGER BANDS</div>
                <div style={S.signalValue(signalColor(signals.bollinger))}>
                  {signals.bollinger ? signals.bollinger.toUpperCase() : '--'}
                </div>
              </div>
            </div>

            {/* Candlestick Chart */}
            <div style={S.sectionHeader}>OHLCV CANDLESTICK</div>
            <CandlestickChart data={data} />

            {/* RSI */}
            <div style={S.sectionHeader}>RSI (14)</div>
            <RSIChart rsi={data.rsi} />
            <div style={S.legendRow}>
              <span style={S.legendItem('#cc44ff')}><span style={S.legendSwatch('#cc44ff')} /> RSI</span>
              <span style={S.legendItem('#00ff41')}><span style={{ ...S.legendSwatch('#00ff41'), opacity: 0.5 }} /> 70 OVERBOUGHT</span>
              <span style={S.legendItem('#ff4444')}><span style={{ ...S.legendSwatch('#ff4444'), opacity: 0.5 }} /> 30 OVERSOLD</span>
            </div>

            {/* MACD */}
            <div style={S.sectionHeader}>MACD</div>
            <MACDChart macd={data.macd} />
            <div style={S.legendRow}>
              <span style={S.legendItem('#00bfff')}><span style={S.legendSwatch('#00bfff')} /> MACD</span>
              <span style={S.legendItem('#ff8c00')}><span style={S.legendSwatch('#ff8c00')} /> SIGNAL</span>
              <span style={S.legendItem('#888')}><span style={{ ...S.legendSwatch('#888'), opacity: 0.5 }} /> HISTOGRAM</span>
            </div>

            {/* Stochastic */}
            <div style={S.sectionHeader}>STOCHASTIC OSCILLATOR</div>
            <StochasticChart stochastic={data.stochastic} />
            <div style={S.legendRow}>
              <span style={S.legendItem('#00bfff')}><span style={S.legendSwatch('#00bfff')} /> %K</span>
              <span style={S.legendItem('#ff8c00')}><span style={S.legendSwatch('#ff8c00')} /> %D</span>
            </div>
          </>
        )}

        {!data && !loading && !error && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ color: '#555', fontSize: '12px', fontFamily: FONT, textTransform: 'uppercase' }}>
              ENTER A TICKER AND CLICK ANALYZE
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
