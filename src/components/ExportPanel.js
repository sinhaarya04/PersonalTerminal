import React, { useState, useEffect, useRef } from 'react';
import { useExport } from '../context/ExportContext';

const S = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 199,
  },
  panel: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '2px',
    background: '#0d0d1a',
    border: '1px solid #ff8c00',
    minWidth: '260px',
    zIndex: 200,
    boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
  },
  header: {
    background: '#1a0d00',
    padding: '5px 10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #333',
  },
  title: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  selectAll: {
    background: 'transparent',
    color: '#ffcc00',
    border: '1px solid #333',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 6px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  },
  list: {
    maxHeight: '300px',
    overflowY: 'auto',
  },
  row: (checked) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 10px',
    cursor: 'pointer',
    background: checked ? '#0a1520' : 'transparent',
    borderBottom: '1px solid #111',
  }),
  checkbox: {
    accentColor: '#ff8c00',
    cursor: 'pointer',
  },
  label: (checked) => ({
    color: checked ? '#d8d8d8' : '#555',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    flex: 1,
  }),
  footer: {
    padding: '6px 10px',
    borderTop: '1px solid #333',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  count: {
    color: '#555',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
  },
  exportBtn: (active) => ({
    background: active ? '#ff8c00' : '#333',
    color: active ? '#000' : '#555',
    border: 'none',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '3px 12px',
    cursor: active ? 'pointer' : 'default',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  }),
  empty: {
    color: '#444',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    padding: '16px 10px',
    textAlign: 'center',
  },
};

export default function ExportPanel({ onClose }) {
  const { exportKeys, exportSelected } = useExport();
  const [selected, setSelected] = useState(new Set());
  const panelRef = useRef(null);

  // Select all by default when panel opens or keys change
  useEffect(() => {
    setSelected(new Set(exportKeys.map(e => e.key)));
  }, [exportKeys]);

  const toggle = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const allSelected = exportKeys.length > 0 && selected.size === exportKeys.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(exportKeys.map(e => e.key)));
    }
  };

  const handleExport = () => {
    if (selected.size === 0) return;
    exportSelected(Array.from(selected));
    onClose();
  };

  return (
    <>
      <div style={S.overlay} onClick={onClose} />
      <div style={S.panel} ref={panelRef}>
        <div style={S.header}>
          <span style={S.title}>CSV EXPORT</span>
          {exportKeys.length > 0 && (
            <button style={S.selectAll} onClick={toggleAll}>
              {allSelected ? 'NONE' : 'ALL'}
            </button>
          )}
        </div>

        <div style={S.list}>
          {exportKeys.length === 0 && (
            <div style={S.empty}>NO DATA LOADED — NAVIGATE TO A TAB FIRST</div>
          )}
          {exportKeys.map(({ key, label }) => (
            <div key={key} style={S.row(selected.has(key))} onClick={() => toggle(key)}>
              <input
                type="checkbox"
                checked={selected.has(key)}
                onChange={() => toggle(key)}
                style={S.checkbox}
              />
              <span style={S.label(selected.has(key))}>{label}</span>
            </div>
          ))}
        </div>

        {exportKeys.length > 0 && (
          <div style={S.footer}>
            <span style={S.count}>{selected.size} / {exportKeys.length} SELECTED</span>
            <button
              style={S.exportBtn(selected.size > 0)}
              onClick={handleExport}
              disabled={selected.size === 0}
            >
              EXPORT CSV
            </button>
          </div>
        )}
      </div>
    </>
  );
}
