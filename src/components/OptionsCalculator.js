import React, { useState } from 'react';

const FONT = "'Consolas','Courier New',monospace";

const S = {
  container: {
    background: '#000',
    minHeight: '600px',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    background: '#0d0d1a',
    borderBottom: '1px solid #333',
    padding: '4px 8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#ff8c00',
    fontFamily: FONT,
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  body: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
  },
  row: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  label: {
    color: '#888',
    fontFamily: FONT,
    fontSize: '10px',
    textTransform: 'uppercase',
  },
  input: {
    background: '#0d0d1a',
    border: '1px solid #333',
    color: '#e0e0e0',
    fontFamily: FONT,
    fontSize: '12px',
    padding: '4px 8px',
    width: '110px',
    outline: 'none',
  },
  select: {
    background: '#0d0d1a',
    border: '1px solid #333',
    color: '#e0e0e0',
    fontFamily: FONT,
    fontSize: '12px',
    padding: '4px 8px',
    width: '110px',
    outline: 'none',
  },
  btn: {
    background: '#ff8c00',
    color: '#000',
    border: 'none',
    fontFamily: FONT,
    fontSize: '11px',
    padding: '5px 16px',
    cursor: 'pointer',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    letterSpacing: '0.5px',
  },
  loadingTxt: {
    padding: '40px',
    color: '#ff8c00',
    fontFamily: FONT,
    fontSize: '12px',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  errorTxt: {
    padding: '20px',
    color: '#ff4444',
    fontFamily: FONT,
    fontSize: '12px',
  },
  sectionTitle: {
    color: '#ff8c00',
    fontFamily: FONT,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #333',
    paddingBottom: '4px',
    marginBottom: '8px',
  },
  metricsRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  metricCard: {
    background: '#0d0d1a',
    border: '1px solid #333',
    padding: '8px 14px',
    minWidth: '100px',
  },
  metricLabel: {
    color: '#888',
    fontFamily: FONT,
    fontSize: '9px',
    textTransform: 'uppercase',
    marginBottom: '2px',
  },
  metricValue: {
    color: '#e0e0e0',
    fontFamily: FONT,
    fontSize: '14px',
    fontWeight: 'bold',
  },
  heatmapWrap: {
    overflowX: 'auto',
    marginTop: '8px',
  },
};

export default function OptionsCalculator() {
  const [spot, setSpot] = useState('150');
  const [strike, setStrike] = useState('155');
  const [time, setTime] = useState('0.25');
  const [rate, setRate] = useState('0.05');
  const [vol, setVol] = useState('0.3');
  const [optType, setOptType] = useState('call');
  const [marketPrice, setMarketPrice] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/analytics/options?spot=${spot}&strike=${strike}&time=${time}&rate=${rate}&vol=${vol}&type=${optType}`;
      if (marketPrice) url += `&market_price=${marketPrice}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || 'Failed to fetch options data');
    } finally {
      setLoading(false);
    }
  };

  const greeks = data
    ? [
        { label: 'Price', value: data.price },
        { label: 'Delta', value: data.delta },
        { label: 'Gamma', value: data.gamma },
        { label: 'Theta', value: data.theta },
        { label: 'Vega', value: data.vega },
        { label: 'Rho', value: data.rho },
      ]
    : [];

  // Heatmap rendering for Greeks surface
  const renderHeatmap = () => {
    if (!data?.surface) return null;
    const { vol_range, strike_range, values } = data.surface;
    if (!vol_range || !strike_range || !values) return null;

    const allVals = values.flat().filter((v) => v != null);
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const range = maxVal - minVal || 1;

    const cellColor = (v) => {
      if (v == null) return '#1a1a2e';
      const t = (v - minVal) / range;
      // Dark blue → orange → yellow
      const r = Math.round(13 + t * 242);
      const g = Math.round(13 + t * 127);
      const b = Math.round(26 * (1 - t));
      return `rgb(${r},${g},${b})`;
    };

    return (
      <div style={S.heatmapWrap}>
        <div style={S.sectionTitle}>GREEKS SURFACE — PRICE BY VOL x STRIKE</div>
        <table
          style={{
            borderCollapse: 'collapse',
            fontFamily: FONT,
            fontSize: '10px',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  background: '#0d0d1a',
                  color: '#888',
                  border: '1px solid #333',
                  padding: '4px 6px',
                  fontSize: '9px',
                }}
              >
                VOL \ K
              </th>
              {strike_range.map((k, i) => (
                <th
                  key={i}
                  style={{
                    background: '#0d0d1a',
                    color: '#ffcc00',
                    border: '1px solid #333',
                    padding: '4px 6px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}
                >
                  {typeof k === 'number' ? k.toFixed(0) : k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vol_range.map((v, ri) => (
              <tr key={ri}>
                <th
                  style={{
                    background: '#0d0d1a',
                    color: '#ffcc00',
                    border: '1px solid #333',
                    padding: '4px 6px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                  }}
                >
                  {(v * 100).toFixed(0)}%
                </th>
                {(values[ri] || []).map((val, ci) => (
                  <td
                    key={ci}
                    style={{
                      background: cellColor(val),
                      color: '#fff',
                      border: '1px solid #222',
                      padding: '4px 6px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      minWidth: '50px',
                    }}
                  >
                    {val != null ? val.toFixed(2) : '--'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>OPTIONS CALCULATOR — BLACK-SCHOLES</span>
      </div>

      <div style={S.body}>
        {/* Input Form */}
        <div style={S.row}>
          <div style={S.fieldGroup}>
            <span style={S.label}>Spot Price</span>
            <input style={S.input} value={spot} onChange={(e) => setSpot(e.target.value)} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>Strike</span>
            <input style={S.input} value={strike} onChange={(e) => setStrike(e.target.value)} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>Time (Years)</span>
            <input style={S.input} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>Risk-Free Rate</span>
            <input style={S.input} value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>Volatility</span>
            <input style={S.input} value={vol} onChange={(e) => setVol(e.target.value)} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>Type</span>
            <select style={S.select} value={optType} onChange={(e) => setOptType(e.target.value)}>
              <option value="call">CALL</option>
              <option value="put">PUT</option>
            </select>
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>Market Price (opt)</span>
            <input
              style={S.input}
              value={marketPrice}
              onChange={(e) => setMarketPrice(e.target.value)}
              placeholder="For IV"
            />
          </div>
          <button style={S.btn} onClick={calculate} disabled={loading}>
            CALCULATE
          </button>
        </div>

        {/* Loading */}
        {loading && <div style={S.loadingTxt}>LOADING...</div>}

        {/* Error */}
        {error && !loading && <div style={S.errorTxt}>{'\u26A0'} {error}</div>}

        {/* Results */}
        {data && !loading && (
          <>
            <div>
              <div style={S.sectionTitle}>GREEKS</div>
              <div style={S.metricsRow}>
                {greeks.map((g) => (
                  <div key={g.label} style={S.metricCard}>
                    <div style={S.metricLabel}>{g.label}</div>
                    <div style={S.metricValue}>
                      {g.value != null ? g.value.toFixed(4) : '--'}
                    </div>
                  </div>
                ))}
                {data.implied_volatility != null && (
                  <div style={S.metricCard}>
                    <div style={S.metricLabel}>Implied Vol</div>
                    <div style={{ ...S.metricValue, color: '#ff8c00' }}>
                      {(data.implied_volatility * 100).toFixed(2)}%
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Greeks Surface Heatmap */}
            {renderHeatmap()}
          </>
        )}
      </div>
    </div>
  );
}
