import React, { useState, useEffect, useRef } from 'react';
import { useExport } from '../context/ExportContext';
import { isMarketOpen } from '../utils/marketHours';

const S = {
  wrapper: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  redBar: {
    background: '#cc0000',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    height: '28px',
    justifyContent: 'space-between',
    borderBottom: '1px solid #990000',
  },
  leftGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
  tickerLabel: {
    color: '#ffcc00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '14px',
    fontWeight: 'bold',
    letterSpacing: '1px',
  },
  equityLabel: {
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    letterSpacing: '0.5px',
    opacity: 0.9,
  },
  rightGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
  clock: {
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '13px',
    letterSpacing: '1px',
  },
  marketDot: (open) => ({
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: open ? '#00ff00' : '#ff4444',
    marginRight: '4px',
    boxShadow: open ? '0 0 4px #00ff00' : 'none',
  }),
  marketLabel: {
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
  },
  apiBadge: (isPolygon) => ({
    background: isPolygon ? '#1a0d00' : '#001a00',
    color: isPolygon ? '#ff8c00' : '#00cc00',
    border: `1px solid ${isPolygon ? '#ff8c00' : '#00cc00'}`,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 6px',
    letterSpacing: '1px',
  }),
  rateLimitBadge: {
    background: '#3d2000',
    color: '#ff8c00',
    border: '1px solid #ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 6px',
    letterSpacing: '0.5px',
  },
  liveBadge: {
    background: '#001a00',
    color: '#00ff00',
    border: '1px solid #00ff00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 6px',
    letterSpacing: '1px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  liveDot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#00ff00',
    animation: 'livePulse 1.2s ease-in-out infinite',
  },
  orangeBar: {
    background: '#e67300',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    height: '26px',
    gap: '2px',
    borderBottom: '2px solid #cc0000',
  },
  tab: (active) => ({
    background: active ? '#cc5500' : 'transparent',
    color: active ? '#ffffff' : '#ffcc00',
    border: active ? '1px solid #cc5500' : '1px solid transparent',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    padding: '2px 12px',
    cursor: 'pointer',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  }),
  exportWrap: {
    marginLeft: 'auto',
    position: 'relative',
  },
  exportBtn: {
    background: 'transparent',
    color: '#ffcc00',
    border: '1px solid #ffcc00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    padding: '1px 10px',
    cursor: 'pointer',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  cmdBar: {
    background: '#0d0d1a',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    height: '28px',
    gap: '8px',
    borderBottom: '1px solid #1a1a2e',
  },
  cmdLabel: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    fontWeight: 'bold',
    letterSpacing: '1px',
    flexShrink: 0,
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    position: 'relative',
    flex: 1,
  },
  searchInput: {
    background: '#000000',
    color: '#ffcc00',
    border: '1px solid #ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '13px',
    padding: '3px 10px',
    flex: 1,
    maxWidth: '300px',
    textTransform: 'uppercase',
    outline: 'none',
  },
  goBtn: {
    background: '#ff8c00',
    color: '#000000',
    border: 'none',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '13px',
    fontWeight: 'bold',
    padding: '3px 14px',
    cursor: 'pointer',
  },
  autocomplete: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: '#0d0d1a',
    border: '1px solid #ff8c00',
    zIndex: 200,
  },
  acItem: {
    padding: '4px 8px',
    cursor: 'pointer',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    color: '#ffcc00',
    borderBottom: '1px solid #1a1a2e',
  },
};

const TABS = ['OVERVIEW', 'INFLECTION', 'KPI CORRELATION', 'TREND ANALYSIS', 'OVERLAY', 'HEATMAP', 'SCREENER', 'MACRO ECON', 'GEO INTEL', 'NEWS', 'RESEARCH', 'PROJECTS', 'PAPER TRADE', 'GLOSSARY'];

export default function TopBanner({ ticker, activeTab, onTabChange, onTickerChange, apiKey, isRateLimited, isLive }) {
  const [time, setTime] = useState('');
  const [marketOpen, setMarketOpen] = useState(false);
  const [searchVal, setSearchVal] = useState(ticker || '');
  const [suggestions, setSuggestions] = useState([]);
  const acTimer = useRef(null);
  const { exportSelected } = useExport();

  useEffect(() => {
    // Inject keyframes for live pulse animation
    if (!document.getElementById('live-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'live-pulse-style';
      style.textContent = '@keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }';
      document.head.appendChild(style);
    }
    const tick = () => {
      const now = new Date();
      const est = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false });
      setTime(est + ' ET');
      setMarketOpen(isMarketOpen());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { setSearchVal(ticker || ''); }, [ticker]);

  const handleSearch = (val) => {
    setSearchVal(val);
    clearTimeout(acTimer.current);
    if (!val || !apiKey) { setSuggestions([]); return; }
    acTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.polygon.io/v3/reference/tickers?search=${val}&market=stocks&active=true&limit=8&apiKey=${apiKey}`
        );
        const data = await res.json();
        if (data.results) setSuggestions(data.results.slice(0, 6));
      } catch { setSuggestions([]); }
    }, 300);
  };

  const handleGo = () => {
    if (searchVal.trim()) {
      onTickerChange(searchVal.trim().toUpperCase());
      setSuggestions([]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleGo();
  };

  const selectSuggestion = (t) => {
    setSearchVal(t.ticker);
    onTickerChange(t.ticker);
    setSuggestions([]);
  };

  return (
    <div style={S.wrapper}>
      {/* Red banner */}
      <div style={S.redBar}>
        <div style={S.leftGroup}>
          <span style={S.tickerLabel}>{ticker || 'BLOOMBERG'}</span>
          <span style={S.equityLabel}>US EQUITY</span>
          {isLive && (
            <span style={S.liveBadge}>
              <span style={S.liveDot} />
              LIVE
            </span>
          )}
          {isRateLimited && <span style={S.rateLimitBadge}>RATE LIMITED — CACHED DATA</span>}
        </div>
        <div style={S.rightGroup}>
          <div>
            <span style={S.marketDot(marketOpen)} />
            <span style={S.marketLabel}>{marketOpen ? 'MKT OPEN' : 'MKT CLOSED'}</span>
          </div>
          <span style={S.clock}>{time}</span>
          <span style={S.apiBadge(!!apiKey)}>{apiKey ? 'POLYGON' : 'YAHOO'}</span>
        </div>
      </div>

      {/* Command / search bar */}
      <div style={S.cmdBar}>
        <span style={S.cmdLabel}>SEARCH:</span>
        <div style={S.searchWrap}>
          <input
            style={S.searchInput}
            value={searchVal}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ENTER TICKER SYMBOL <GO>"
            spellCheck={false}
          />
          <button style={S.goBtn} onClick={handleGo}>GO</button>
          {suggestions.length > 0 && (
            <div style={S.autocomplete}>
              {suggestions.map(t => (
                <div
                  key={t.ticker}
                  style={S.acItem}
                  onMouseDown={() => selectSuggestion(t)}
                  onMouseEnter={e => e.currentTarget.style.background = '#1a3a5c'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ color: '#ffcc00' }}>{t.ticker}</span>
                  <span style={{ color: '#888888', marginLeft: '8px', fontSize: '11px' }}>
                    {t.name ? t.name.substring(0, 28) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={S.exportWrap}>
          <button style={S.exportBtn} onClick={() => exportSelected()}>
            ↓ EXPORT
          </button>
        </div>
      </div>

      {/* Orange tab bar */}
      <div style={S.orangeBar}>
        {TABS.map(tab => (
          <button
            key={tab}
            style={S.tab(activeTab === tab)}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
