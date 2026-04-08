import React, { useState } from 'react';

const OPEN_W = 180;
const CLOSED_W = 28;

const S = {
  sidebar: (open) => ({
    width: `${open ? OPEN_W : CLOSED_W}px`,
    minWidth: `${open ? OPEN_W : CLOSED_W}px`,
    background: '#0a0a14',
    borderRight: '1px solid #1a1a2e',
    transition: 'width 0.15s ease, min-width 0.15s ease',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  }),
  header: {
    background: '#cc0000',
    padding: '0 6px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    flexShrink: 0,
  },
  headerText: {
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    fontWeight: 'bold',
    letterSpacing: '1px',
    whiteSpace: 'nowrap',
  },
  toggleIcon: {
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
  },
  closedLabel: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    writingMode: 'vertical-rl',
    textOrientation: 'mixed',
    letterSpacing: '2px',
    padding: '8px 0',
    cursor: 'pointer',
    textAlign: 'center',
    width: '100%',
  },
  addRow: {
    display: 'flex',
    padding: '4px',
    gap: '2px',
    borderBottom: '1px solid #1a1a2e',
    flexShrink: 0,
  },
  addInput: {
    flex: 1,
    background: '#000000',
    color: '#ffcc00',
    border: '1px solid #333333',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    padding: '2px 4px',
    textTransform: 'uppercase',
    outline: 'none',
    minWidth: 0,
  },
  addBtn: {
    background: '#ff8c00',
    color: '#000000',
    border: 'none',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    fontWeight: 'bold',
    padding: '2px 6px',
    cursor: 'pointer',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  row: (active) => ({
    padding: '4px 6px',
    borderBottom: '1px solid #111122',
    borderLeft: active ? '3px solid #ffcc00' : '3px solid transparent',
    background: active ? '#0d1a0d' : 'transparent',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  }),
  rowTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbol: {
    color: '#ffcc00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    fontWeight: 'bold',
    letterSpacing: '0.5px',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#555555',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '14px',
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
  },
  price: {
    color: '#cccccc',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
  },
  change: (positive) => ({
    color: positive === null ? '#555555' : positive ? '#00cc44' : '#ff4444',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
  }),
};

export default function WatchlistSidebar({ watchlist, isOpen, onToggle, onTickerChange, onAdd, onRemove, activeTicker }) {
  const [inputVal, setInputVal] = useState('');

  const handleAdd = () => {
    const sym = inputVal.trim().toUpperCase();
    if (sym) {
      onAdd(sym);
      setInputVal('');
    }
  };

  if (!isOpen) {
    return (
      <div style={S.sidebar(false)}>
        <div style={S.header} onClick={onToggle}>
          <span style={S.toggleIcon}>▶</span>
        </div>
        <div style={S.closedLabel} onClick={onToggle}>WATCHLIST</div>
      </div>
    );
  }

  return (
    <div style={S.sidebar(true)}>
      <div style={S.header} onClick={onToggle}>
        <span style={S.headerText}>WATCHLIST</span>
        <span style={S.toggleIcon}>◀</span>
      </div>

      <div style={S.addRow}>
        <input
          style={S.addInput}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="ADD..."
          spellCheck={false}
        />
        <button style={S.addBtn} onClick={handleAdd}>+</button>
      </div>

      <div style={S.list}>
        {watchlist.map(item => {
          const isActive = item.symbol === activeTicker;
          const hasPrice = item.price != null;
          const isPositive = item.change != null ? item.change >= 0 : null;

          return (
            <div
              key={item.symbol}
              style={S.row(isActive)}
              onClick={() => onTickerChange(item.symbol)}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#1a1a2e'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={S.rowTop}>
                <span style={S.symbol}>{item.symbol}</span>
                <button
                  style={S.removeBtn}
                  onClick={e => { e.stopPropagation(); onRemove(item.symbol); }}
                  title="Remove"
                >×</button>
              </div>
              <span style={S.price}>
                {hasPrice ? item.price.toFixed(2) : '--'}
              </span>
              <span style={S.change(isPositive)}>
                {hasPrice
                  ? `${isPositive ? '+' : ''}${item.change.toFixed(2)} (${isPositive ? '+' : ''}${item.pctChange.toFixed(2)}%)`
                  : '--'
                }
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
