import React, { useState } from 'react';

export default function WidgetCard({ title, accentColor = '#ff8c00', icon, children, defaultCollapsed = false, maxHeight }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div style={{
      background: '#0d0d1a',
      border: '1px solid #222',
      borderTop: `2px solid ${accentColor}`,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      maxHeight: maxHeight || undefined,
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 28,
          padding: '0 8px',
          background: '#0a0a14',
          borderBottom: '1px solid #222',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon && <span style={{ color: accentColor, fontSize: 12 }}>{icon}</span>}
          <span style={{
            fontFamily: "'Consolas','Courier New',monospace",
            fontSize: 11,
            fontWeight: 700,
            color: accentColor,
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            {title}
          </span>
        </div>
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            fontFamily: "'Consolas','Courier New',monospace",
            fontSize: 12,
            cursor: 'pointer',
            padding: '0 2px',
          }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '+' : '\u2013'}
        </button>
      </div>
      {/* Content */}
      {!collapsed && (
        <div style={{
          flex: 1,
          overflow: 'auto',
          background: '#000',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}
