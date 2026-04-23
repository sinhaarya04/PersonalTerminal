import React, { useState } from 'react';
import WidgetCard from './WidgetCard';
import WorldEquityIndices from './WorldEquityIndices';
import TopMovers from './TopMovers';
import DashboardNewsWidget from './DashboardNewsWidget';
import LiveTVWidget from './LiveTVWidget';
import MarketPulseSidebar from './MarketPulseSidebar';

const FONT = "'Consolas','Courier New',monospace";

export default function OverviewDashboard({ onTickerChange, ticker }) {
  const [pulseOpen, setPulseOpen] = useState(true);

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Main grid area */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 4 }}>
        {/* Row 1: 3 widgets side by side */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: 4,
          marginBottom: 4,
        }}>
          {/* Indices summary — 4 cols */}
          <div style={{ gridColumn: '1 / 5', minHeight: 280 }}>
            <WidgetCard title="INDICES" accentColor="#ff8c00" icon="&#9670;">
              <WorldEquityIndices />
            </WidgetCard>
          </div>

          {/* Top Movers — 4 cols */}
          <div style={{ gridColumn: '5 / 9', minHeight: 280 }}>
            <WidgetCard title="TOP MOVERS" accentColor="#00cc00" icon="&#9650;">
              <TopMovers onTickerChange={onTickerChange} />
            </WidgetCard>
          </div>

          {/* Live News — 4 cols */}
          <div style={{ gridColumn: '9 / 13', minHeight: 280 }}>
            <WidgetCard title="NEWS WIRE" accentColor="#ff4444" icon="&#9679;">
              <DashboardNewsWidget />
            </WidgetCard>
          </div>
        </div>

        {/* Row 2: Live TV + News expanded */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: 4,
          marginBottom: 4,
        }}>
          {/* Live TV — 8 cols */}
          <div style={{ gridColumn: '1 / 9', height: 340 }}>
            <WidgetCard title="LIVE TV" accentColor="#9D4EDD" icon="&#9654;">
              <LiveTVWidget />
            </WidgetCard>
          </div>

          {/* News expanded — 4 cols */}
          <div style={{ gridColumn: '9 / 13', height: 340 }}>
            <WidgetCard title="NEWS WIRE" accentColor="#ff4444" icon="&#9679;">
              <DashboardNewsWidget />
            </WidgetCard>
          </div>
        </div>

        {/* Pulse toggle when sidebar is collapsed */}
        {!pulseOpen && (
          <div style={{ textAlign: 'right', padding: '2px 0' }}>
            <button
              onClick={() => setPulseOpen(true)}
              style={{
                background: '#0a0a14', border: '1px solid #333', color: '#ff8c00',
                fontFamily: FONT, fontSize: 9, padding: '2px 10px', cursor: 'pointer',
                letterSpacing: 1,
              }}
            >
              SHOW MARKET PULSE
            </button>
          </div>
        )}
      </div>

      {/* Market Pulse Sidebar */}
      <MarketPulseSidebar
        isOpen={pulseOpen}
        onToggle={() => setPulseOpen(p => !p)}
        onTickerChange={onTickerChange}
      />
    </div>
  );
}
