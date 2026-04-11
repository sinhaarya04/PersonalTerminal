import React, { useEffect } from 'react';
import PriceChart from './PriceChart';

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: '#000000',
    display: 'flex',
    flexDirection: 'column',
  },
};

export default function FullscreenChart({ bars, ticker, quote, events, initialDrawings, onSave, onClose, interval, onIntervalChange }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={S.overlay}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <PriceChart
          bars={bars}
          ticker={ticker}
          quote={quote}
          events={events}
          fullscreen
          initialDrawings={initialDrawings}
          onSave={onSave}
          onToggleFullscreen={onClose}
          interval={interval}
          onIntervalChange={onIntervalChange}
        />
      </div>
    </div>
  );
}
