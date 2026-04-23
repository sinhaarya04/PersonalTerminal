import React, { useState, useMemo } from 'react';
import { MACRO_EVENTS } from '../data/macroEvents';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

const FONT = "'Consolas','Courier New',monospace";

// Build event list from macroEvents.js (flat array with { t, date, label, detail })
function buildEvents() {
  const now = new Date();
  return MACRO_EVENTS.map(e => ({
    date: e.date,
    type: e.label,
    detail: e.detail,
    impact: 'HIGH',
    isPast: new Date(e.date) < now,
  }));
}

const TYPE_COLORS = { FOMC: '#ff4444', CPI: '#ff8c00', NFP: '#00cccc', GDP: '#00cc00' };
const IMPACT_COLORS = { HIGH: '#ff4444', MEDIUM: '#ffcc00', LOW: '#00cc00' };
const FILTERS = ['ALL', 'FOMC', 'CPI', 'NFP'];

const S = {
  container: { padding: 0, background: '#000' },
  header: { background: '#0d0d1a', borderBottom: '2px solid #ff8c00', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 8 },
  title: { color: '#ff8c00', fontFamily: FONT, fontSize: 13, letterSpacing: 1 },
  btn: (active) => ({ background: active ? '#1a1a2e' : 'transparent', border: `1px solid ${active ? '#ff8c00' : '#333'}`, color: active ? '#ff8c00' : '#666', fontFamily: FONT, fontSize: 9, padding: '2px 8px', cursor: 'pointer' }),
  thRow: { display: 'flex', padding: '3px 8px', background: '#0d0d1a', borderBottom: '1px solid #333' },
  row: (upcoming) => ({ display: 'flex', padding: '4px 8px', borderBottom: '1px solid #111', alignItems: 'center', borderLeft: upcoming ? '3px solid #ffcc00' : '3px solid transparent' }),
  cell: (w, align) => ({ fontFamily: FONT, fontSize: 11, width: w, textAlign: align || 'left', color: '#ccc' }),
  badge: (color) => ({ fontFamily: FONT, fontSize: 9, fontWeight: 700, color: '#000', background: color, padding: '1px 6px', letterSpacing: '0.5px' }),
};

export default function EconCalendar() {
  const [filter, setFilter] = useState('ALL');
  const [timeView, setTimeView] = useState('UPCOMING');
  const { register, unregister } = useExport();

  const allEvents = useMemo(() => buildEvents(), []);

  const filtered = useMemo(() => {
    let list = allEvents;
    if (filter !== 'ALL') list = list.filter(e => e.type === filter);
    if (timeView === 'UPCOMING') list = list.filter(e => !e.isPast);
    else if (timeView === 'PAST') list = list.filter(e => e.isPast);
    return list;
  }, [allEvents, filter, timeView]);

  React.useEffect(() => {
    if (filtered.length) register('ECON_CALENDAR', 'Economic Calendar', () => {
      exportCSV(filtered.map(e => ({ Date: e.date, Type: e.type, Detail: e.detail, Impact: e.impact })), 'econ_calendar.csv');
    });
    return () => unregister('ECON_CALENDAR');
  }, [filtered, register, unregister]);

  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>ECONOMIC CALENDAR</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {FILTERS.map(f => <button key={f} style={S.btn(filter === f)} onClick={() => setFilter(f)}>{f}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
          {['UPCOMING', 'PAST', 'ALL'].map(v => <button key={v} style={S.btn(timeView === v)} onClick={() => setTimeView(v)}>{v}</button>)}
        </div>
      </div>

      <div style={S.thRow}>
        <span style={{ ...S.cell(100), color: '#888', fontWeight: 600 }}>DATE</span>
        <span style={{ ...S.cell(80), color: '#888', fontWeight: 600 }}>TYPE</span>
        <span style={{ ...S.cell(300), color: '#888', fontWeight: 600 }}>EVENT</span>
        <span style={{ ...S.cell(80), color: '#888', fontWeight: 600, textAlign: 'center' }}>IMPACT</span>
        <span style={{ ...S.cell(100), color: '#888', fontWeight: 600 }}>STATUS</span>
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 30, fontFamily: FONT, fontSize: 12, color: '#555', textAlign: 'center' }}>NO EVENTS FOUND</div>
      )}

      {filtered.map((e, i) => {
        const eventDate = new Date(e.date);
        const isUpcoming = eventDate > now && eventDate <= in7days;
        const daysAway = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
        const status = e.isPast ? 'RELEASED' : daysAway <= 0 ? 'TODAY' : daysAway <= 7 ? `IN ${daysAway}D` : `${daysAway}D AWAY`;
        const statusColor = e.isPast ? '#555' : daysAway <= 7 ? '#ffcc00' : '#888';

        return (
          <div key={i} style={S.row(isUpcoming)}>
            <span style={{ ...S.cell(100), color: e.isPast ? '#555' : '#ddd' }}>{e.date}</span>
            <span style={S.cell(80)}><span style={S.badge(TYPE_COLORS[e.type] || '#666')}>{e.type}</span></span>
            <span style={{ ...S.cell(300), color: e.isPast ? '#666' : '#ccc' }}>{e.detail}</span>
            <span style={{ ...S.cell(80), textAlign: 'center' }}><span style={S.badge(IMPACT_COLORS[e.impact] || '#666')}>{e.impact}</span></span>
            <span style={{ ...S.cell(100), color: statusColor, fontWeight: 600 }}>{status}</span>
          </div>
        );
      })}
    </div>
  );
}
