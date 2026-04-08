import React, { useState, useMemo, useRef, useCallback } from 'react';

const W = 900;
const H = 260;
const LEFT = 60;
const RIGHT = 20;
const TOP = 20;
const BOTTOM = 30;

const S = {
  container: {
    background: '#020208',
    border: '1px solid #333',
    padding: '0',
  },
  header: {
    background: '#050510',
    padding: '4px 10px',
    borderBottom: '1px solid #222',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  legend: {
    display: 'flex',
    gap: '14px',
    alignItems: 'center',
  },
  legendItem: (color) => ({
    color,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
  }),
  dot: (color) => ({
    display: 'inline-block',
    width: '8px',
    height: '3px',
    background: color,
    marginRight: '4px',
    verticalAlign: 'middle',
  }),
  empty: {
    color: '#555',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    padding: '30px',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
};

function buildLine(data, xScale, yScale) {
  if (data.length === 0) return '';
  return data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d)}`).join(' ');
}

export default function PerformanceChart({ portfolioHistory }) {
  const svgRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  const { portfolioReturns, spyReturns, dates, yMin, yMax } = useMemo(() => {
    if (!portfolioHistory || portfolioHistory.length < 2) {
      return { portfolioReturns: [], spyReturns: [], dates: [], yMin: -5, yMax: 5 };
    }

    const first = portfolioHistory[0];
    const pReturns = portfolioHistory.map(s => ((s.value / first.value) - 1) * 100);
    const sReturns = first.spyValue
      ? portfolioHistory.map(s => ((s.spyValue / first.spyValue) - 1) * 100)
      : [];
    const dts = portfolioHistory.map(s => new Date(s.timestamp));

    const allVals = [...pReturns, ...sReturns];
    const min = Math.min(...allVals, 0);
    const max = Math.max(...allVals, 0);
    const pad = Math.max((max - min) * 0.15, 1);

    return {
      portfolioReturns: pReturns,
      spyReturns: sReturns,
      dates: dts,
      yMin: min - pad,
      yMax: max + pad,
    };
  }, [portfolioHistory]);

  const xScale = useCallback((i) => {
    const count = portfolioReturns.length;
    if (count <= 1) return LEFT;
    return LEFT + (i / (count - 1)) * (W - LEFT - RIGHT);
  }, [portfolioReturns.length]);

  const yScale = useCallback((val) => {
    return TOP + ((yMax - val) / (yMax - yMin)) * (H - TOP - BOTTOM);
  }, [yMin, yMax]);

  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || portfolioReturns.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((mx - LEFT) / (W - LEFT - RIGHT)) * (portfolioReturns.length - 1));
    setHoverIdx(Math.max(0, Math.min(idx, portfolioReturns.length - 1)));
  }, [portfolioReturns.length]);

  if (!portfolioHistory || portfolioHistory.length < 2) {
    return (
      <div style={S.container}>
        <div style={S.header}>
          <span style={S.title}>PERFORMANCE</span>
        </div>
        <div style={S.empty}>NOT ENOUGH DATA — TRADE TO BUILD HISTORY</div>
      </div>
    );
  }

  const portfolioLine = buildLine(portfolioReturns, xScale, yScale);
  const spyLine = spyReturns.length > 0 ? buildLine(spyReturns, xScale, yScale) : '';
  const zeroY = yScale(0);

  // Y-axis grid
  const yTicks = [];
  const yRange = yMax - yMin;
  const yStep = yRange > 20 ? 10 : yRange > 10 ? 5 : yRange > 4 ? 2 : 1;
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) {
    yTicks.push(v);
  }

  // X-axis labels (show ~5)
  const xLabels = [];
  const step = Math.max(1, Math.floor(dates.length / 5));
  for (let i = 0; i < dates.length; i += step) {
    const d = dates[i];
    xLabels.push({ i, label: `${d.getMonth() + 1}/${d.getDate()}` });
  }

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>PERFORMANCE VS S&P 500</span>
        <div style={S.legend}>
          <span style={S.legendItem('#ff8c00')}>
            <span style={S.dot('#ff8c00')} />PORTFOLIO
          </span>
          <span style={S.legendItem('#00cccc')}>
            <span style={S.dot('#00cccc')} />S&P 500
          </span>
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block', background: '#020208' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Grid lines */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={LEFT} x2={W - RIGHT} y1={yScale(v)} y2={yScale(v)}
              stroke="#1a1a2e" strokeWidth="0.5" />
            <text x={LEFT - 4} y={yScale(v) + 3}
              fill="#555" fontSize="9" fontFamily="Consolas,monospace" textAnchor="end">
              {v > 0 ? '+' : ''}{v.toFixed(0)}%
            </text>
          </g>
        ))}

        {/* Zero line */}
        <line x1={LEFT} x2={W - RIGHT} y1={zeroY} y2={zeroY}
          stroke="#333" strokeWidth="1" strokeDasharray="3,3" />

        {/* X labels */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={xScale(i)} y={H - 6}
            fill="#555" fontSize="9" fontFamily="Consolas,monospace" textAnchor="middle">
            {label}
          </text>
        ))}

        {/* SPY line */}
        {spyLine && (
          <path d={spyLine} fill="none" stroke="#00cccc" strokeWidth="1.5" opacity="0.6" />
        )}

        {/* Portfolio line */}
        <path d={portfolioLine} fill="none" stroke="#ff8c00" strokeWidth="2" />

        {/* Area under portfolio */}
        {portfolioReturns.length > 1 && (
          <path
            d={`${portfolioLine} L${xScale(portfolioReturns.length - 1)},${zeroY} L${xScale(0)},${zeroY} Z`}
            fill="#ff8c00"
            opacity="0.05"
          />
        )}

        {/* Crosshair */}
        {hoverIdx != null && (
          <g>
            <line x1={xScale(hoverIdx)} x2={xScale(hoverIdx)}
              y1={TOP} y2={H - BOTTOM} stroke="#ff8c00" strokeWidth="0.5" opacity="0.6" />
            <circle cx={xScale(hoverIdx)} cy={yScale(portfolioReturns[hoverIdx])}
              r="3" fill="#ff8c00" />
            {spyReturns[hoverIdx] != null && (
              <circle cx={xScale(hoverIdx)} cy={yScale(spyReturns[hoverIdx])}
                r="3" fill="#00cccc" />
            )}
            {/* Tooltip */}
            <rect x={xScale(hoverIdx) + 6} y={TOP + 4} width="140" height="52"
              rx="2" fill="#0d0d1a" stroke="#ff8c00" strokeWidth="0.5" />
            <text x={xScale(hoverIdx) + 12} y={TOP + 18}
              fill="#888" fontSize="9" fontFamily="Consolas,monospace">
              {dates[hoverIdx] ? `${dates[hoverIdx].getMonth() + 1}/${dates[hoverIdx].getDate()}/${dates[hoverIdx].getFullYear()}` : ''}
            </text>
            <text x={xScale(hoverIdx) + 12} y={TOP + 32}
              fill="#ff8c00" fontSize="10" fontFamily="Consolas,monospace">
              PORTFOLIO: {portfolioReturns[hoverIdx] >= 0 ? '+' : ''}{portfolioReturns[hoverIdx].toFixed(2)}%
            </text>
            {spyReturns[hoverIdx] != null && (
              <text x={xScale(hoverIdx) + 12} y={TOP + 46}
                fill="#00cccc" fontSize="10" fontFamily="Consolas,monospace">
                S&P 500: {spyReturns[hoverIdx] >= 0 ? '+' : ''}{spyReturns[hoverIdx].toFixed(2)}%
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
