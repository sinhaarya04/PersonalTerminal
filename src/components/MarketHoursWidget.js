import React, { useState, useEffect } from 'react';
import { getExchangeStatuses } from '../utils/marketHours';

const FONT = "'Consolas','Courier New',monospace";

const STATUS_STYLE = {
  OPEN:   { dot: '#00cc00', text: '#00cc00', label: 'OPEN' },
  PRE:    { dot: '#ffcc00', text: '#ffcc00', label: 'PRE-MKT' },
  CLOSED: { dot: '#ff4444', text: '#666',    label: 'CLOSED' },
};

export default function MarketHoursWidget() {
  const [statuses, setStatuses] = useState(() => getExchangeStatuses());

  useEffect(() => {
    const id = setInterval(() => setStatuses(getExchangeStatuses()), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding: '4px 0' }}>
      {statuses.map(ex => {
        const s = STATUS_STYLE[ex.status];
        return (
          <div
            key={ex.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '3px 10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block',
                width: 6, height: 6, borderRadius: '50%',
                background: s.dot,
              }} />
              <span style={{ fontFamily: FONT, fontSize: 10, color: '#ccc', fontWeight: 700 }}>
                {ex.name}
              </span>
            </div>
            <span style={{ fontFamily: FONT, fontSize: 9, color: s.text, fontWeight: 600 }}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
