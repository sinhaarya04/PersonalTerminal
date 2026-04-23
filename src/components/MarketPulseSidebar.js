import React, { useState, useEffect, useCallback } from 'react';
import { fetchYFQuotesLive, fetchTopMovers, fetchGlobalSnapshot } from '../hooks/useYahooFinance';
import FearGreedGauge from './FearGreedGauge';
import GlobalSnapshotWidget from './GlobalSnapshotWidget';
import MarketHoursWidget from './MarketHoursWidget';

const FONT = "'Consolas','Courier New',monospace";
const OPEN_W = 280;
const CLOSED_W = 28;
const REFRESH = 90000;

function SectionHeader({ icon, title }) {
  return (
    <div style={{
      padding: '6px 10px 4px',
      fontFamily: FONT, fontSize: 9, fontWeight: 700,
      color: '#ff8c00', letterSpacing: '1px', textTransform: 'uppercase',
      borderBottom: '1px solid #1a1a1a',
    }}>
      {icon} {title}
    </div>
  );
}

function MoverRow({ item, onTickerChange }) {
  const isPos = item.changePct >= 0;
  return (
    <div
      onClick={() => onTickerChange?.(item.symbol)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '3px 10px', cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#111'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ fontFamily: FONT, fontSize: 10, color: '#ccc', fontWeight: 600, width: 55 }}>
        {item.symbol}
      </span>
      <span style={{ fontFamily: FONT, fontSize: 10, color: '#aaa', flex: 1, textAlign: 'right' }}>
        {item.price?.toFixed(2)}
      </span>
      <span style={{
        fontFamily: FONT, fontSize: 10, fontWeight: 600, width: 58, textAlign: 'right',
        color: isPos ? '#00cc00' : '#ff4444',
      }}>
        {isPos ? '+' : ''}{item.changePct?.toFixed(2)}%
      </span>
    </div>
  );
}

export default function MarketPulseSidebar({ isOpen, onToggle, onTickerChange }) {
  const [vix, setVix] = useState(null);
  const [movers, setMovers] = useState({ gainers: [], losers: [] });
  const [snapshot, setSnapshot] = useState([]);

  const load = useCallback(async () => {
    try {
      const [vixData, moversData, snapData] = await Promise.allSettled([
        fetchYFQuotesLive(['^VIX']),
        fetchTopMovers(5),
        fetchGlobalSnapshot(),
      ]);
      if (vixData.status === 'fulfilled' && vixData.value?.[0]) {
        setVix(vixData.value[0].regularMarketPrice);
      }
      if (moversData.status === 'fulfilled') setMovers(moversData.value);
      if (snapData.status === 'fulfilled') setSnapshot(snapData.value);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, REFRESH);
    return () => clearInterval(id);
  }, [load]);

  // Collapsed state
  if (!isOpen) {
    return (
      <div
        onClick={onToggle}
        style={{
          width: CLOSED_W, background: '#0a0a14', borderLeft: '1px solid #222',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', writingMode: 'vertical-rl', textOrientation: 'mixed',
        }}
      >
        <span style={{ fontFamily: FONT, fontSize: 10, color: '#ff8c00', fontWeight: 700, letterSpacing: 2 }}>
          PULSE
        </span>
      </div>
    );
  }

  return (
    <div style={{
      width: OPEN_W, background: '#0a0a14', borderLeft: '1px solid #222',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 10px', height: 28, borderBottom: '1px solid #222', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>&#9889;</span>
          <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: '#ff8c00', letterSpacing: 1 }}>
            MARKET PULSE
          </span>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#00cc00',
          }} />
        </div>
        <button
          onClick={onToggle}
          style={{
            background: 'none', border: 'none', color: '#666', fontFamily: FONT,
            fontSize: 14, cursor: 'pointer', padding: 0,
          }}
        >&times;</button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <SectionHeader icon="&#9881;" title="FEAR & GREED" />
        <FearGreedGauge vix={vix} />

        <SectionHeader icon="&#9650;" title="TOP GAINERS" />
        {movers.gainers?.slice(0, 5).map(g => (
          <MoverRow key={g.symbol} item={g} onTickerChange={onTickerChange} />
        ))}
        {movers.gainers?.length === 0 && (
          <div style={{ padding: '4px 10px', fontFamily: FONT, fontSize: 10, color: '#444' }}>LOADING...</div>
        )}

        <SectionHeader icon="&#9660;" title="TOP LOSERS" />
        {movers.losers?.slice(0, 5).map(l => (
          <MoverRow key={l.symbol} item={l} onTickerChange={onTickerChange} />
        ))}
        {movers.losers?.length === 0 && (
          <div style={{ padding: '4px 10px', fontFamily: FONT, fontSize: 10, color: '#444' }}>LOADING...</div>
        )}

        <SectionHeader icon="&#127760;" title="GLOBAL SNAPSHOT" />
        <GlobalSnapshotWidget data={snapshot} />

        <SectionHeader icon="&#128338;" title="MARKET HOURS" />
        <MarketHoursWidget />
      </div>
    </div>
  );
}
