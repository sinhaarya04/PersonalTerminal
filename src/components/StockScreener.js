import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchScreenerUniverse, fetchRSIBatch } from '../hooks/useYahooFinance';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

// ── Formatting helpers ──────────────────────────────────────────────────────
function fmtMktCap(n) {
  if (n == null) return '--';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + 'M';
  return String(n);
}

function fmtVolume(n) {
  if (n == null || n === 0) return '--';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(n);
}

function fmtPrice(p) {
  if (p == null) return '--';
  return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(p) {
  if (p == null) return '--';
  const sign = p >= 0 ? '+' : '';
  return sign + p.toFixed(2) + '%';
}

function fmtPE(p) {
  if (p == null) return '--';
  return p.toFixed(1);
}

function pctColor(p) {
  if (p == null) return '#555';
  return p >= 0 ? '#00cc00' : '#ff4444';
}

function nullText(v) {
  return v == null ? '--' : v;
}

// ── Market cap bucket logic ─────────────────────────────────────────────────
const CAP_BUCKETS = [
  { key: 'MICRO',  label: 'MICRO',  min: 0,     max: 3e8    },
  { key: 'SMALL',  label: 'SMALL',  min: 3e8,   max: 2e9    },
  { key: 'MID',    label: 'MID',    min: 2e9,   max: 1e10   },
  { key: 'LARGE',  label: 'LARGE',  min: 1e10,  max: 2e11   },
  { key: 'MEGA',   label: 'MEGA',   min: 2e11,  max: Infinity },
];

const VOLUME_THRESHOLDS = [
  { key: 'ANY',  label: 'ANY',   value: 0     },
  { key: '100K', label: '>100K', value: 1e5   },
  { key: '500K', label: '>500K', value: 5e5   },
  { key: '1M',   label: '>1M',   value: 1e6   },
  { key: '5M',   label: '>5M',   value: 5e6   },
];

// ── Presets ──────────────────────────────────────────────────────────────────
const PRESETS = {
  VALUE:     { peMin: 0, peMax: 15, caps: ['MID','LARGE','MEGA'], volKey: '500K', sortCol: 'pe', sortDir: 'asc', changePctMin: '', changePctMax: '', rsiThreshold: '', sectors: [] },
  MOMENTUM:  { peMin: '', peMax: '', caps: ['SMALL','MID','LARGE','MEGA'], volKey: '1M', sortCol: 'changePct', sortDir: 'desc', changePctMin: 3, changePctMax: '', rsiThreshold: '', sectors: [] },
  OVERSOLD:  { peMin: '', peMax: '', caps: ['SMALL','MID','LARGE','MEGA'], volKey: 'ANY', sortCol: 'rsi', sortDir: 'asc', changePctMin: '', changePctMax: '', rsiThreshold: 30, sectors: [] },
  'LARGE CAP TECH': { peMin: '', peMax: '', caps: ['LARGE','MEGA'], volKey: 'ANY', sortCol: 'marketCap', sortDir: 'desc', changePctMin: '', changePctMax: '', rsiThreshold: '', sectors: ['Technology'] },
};

// ── Style constants ─────────────────────────────────────────────────────────
const FONT = "'Consolas','Courier New',monospace";
const CLR = {
  bg: '#000000', headerBg: '#0d0d1a', filterBg: '#050510',
  orange: '#ff8c00', yellow: '#ffcc00', green: '#00cc00', red: '#ff4444',
  dim: '#555', muted: '#888', text: '#cccccc', rowHover: '#1a3a5c',
  activeBg: '#0d1a2e', border: '#333',
};

const baseBtn = {
  fontFamily: FONT, fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase',
  cursor: 'pointer', border: `1px solid ${CLR.border}`, borderRadius: '2px',
  padding: '3px 8px', background: 'transparent', color: CLR.muted, transition: 'all 0.15s',
};

const activeBtn = { ...baseBtn, background: CLR.activeBg, color: CLR.orange, borderColor: CLR.orange };

const inputStyle = {
  fontFamily: FONT, fontSize: '11px', background: '#000', color: CLR.yellow,
  border: `1px solid ${CLR.border}`, borderRadius: '2px', padding: '3px 6px',
  outline: 'none', width: '70px',
};

// ── Component ───────────────────────────────────────────────────────────────
export default function StockScreener({ onTickerChange }) {
  // Data state
  const [universe, setUniverse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rsiMap, setRsiMap] = useState({});
  const [rsiLoading, setRsiLoading] = useState(false);

  // Filter state
  const [peMin, setPeMin] = useState('');
  const [peMax, setPeMax] = useState('');
  const [caps, setCaps] = useState([]);
  const [changePctMin, setChangePctMin] = useState('');
  const [changePctMax, setChangePctMax] = useState('');
  const [volKey, setVolKey] = useState('ANY');
  const [rsiThreshold, setRsiThreshold] = useState('');
  const [sectors, setSectors] = useState([]);

  // Sort state
  const [sortCol, setSortCol] = useState('marketCap');
  const [sortDir, setSortDir] = useState('desc');

  // UI state
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [activePreset, setActivePreset] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);

  const { register, unregister } = useExport();

  // ── Load universe on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchScreenerUniverse()
      .then(data => { if (!cancelled) setUniverse(data || []); })
      .catch(() => { if (!cancelled) setUniverse([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Derive available sectors ────────────────────────────────────────────
  const availableSectors = useMemo(() => {
    const set = new Set();
    universe.forEach(s => { if (s.sector) set.add(s.sector); });
    return Array.from(set).sort();
  }, [universe]);

  // ── Filter logic ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return universe.filter(s => {
      // P/E range
      if (peMin !== '' && peMin !== null) {
        if (s.pe == null || s.pe < Number(peMin)) return false;
      }
      if (peMax !== '' && peMax !== null) {
        if (s.pe == null || s.pe > Number(peMax)) return false;
      }
      // Market cap buckets
      if (caps.length > 0) {
        if (s.marketCap == null) return false;
        const inBucket = caps.some(ck => {
          const b = CAP_BUCKETS.find(x => x.key === ck);
          return b && s.marketCap >= b.min && s.marketCap < b.max;
        });
        if (!inBucket) return false;
      }
      // Change% range
      if (changePctMin !== '' && changePctMin !== null) {
        if (s.changePct == null || s.changePct < Number(changePctMin)) return false;
      }
      if (changePctMax !== '' && changePctMax !== null) {
        if (s.changePct == null || s.changePct > Number(changePctMax)) return false;
      }
      // Volume threshold
      const volThresh = VOLUME_THRESHOLDS.find(v => v.key === volKey);
      if (volThresh && volThresh.value > 0) {
        if (s.volume == null || s.volume < volThresh.value) return false;
      }
      // RSI threshold — only filter stocks that have RSI data
      if (rsiThreshold !== '' && rsiThreshold !== null) {
        const rsi = rsiMap[s.symbol];
        if (rsi == null) return false;
        if (rsi > Number(rsiThreshold)) return false;
      }
      // Sectors
      if (sectors.length > 0) {
        if (!s.sector || !sectors.includes(s.sector)) return false;
      }
      return true;
    });
  }, [universe, peMin, peMax, caps, changePctMin, changePctMax, volKey, rsiThreshold, rsiMap, sectors]);

  // ── Sort logic ──────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va, vb;
      if (sortCol === 'rsi') {
        va = rsiMap[a.symbol] ?? null;
        vb = rsiMap[b.symbol] ?? null;
      } else if (sortCol === 'symbol') {
        va = a.symbol; vb = b.symbol;
      } else if (sortCol === 'name') {
        va = a.name; vb = b.name;
      } else {
        va = a[sortCol]; vb = b[sortCol];
      }
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string') {
        const cmp = va.localeCompare(vb);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return arr;
  }, [filtered, sortCol, sortDir, rsiMap]);

  // ── Fetch RSI when threshold is set ─────────────────────────────────────
  useEffect(() => {
    if (rsiThreshold === '' || rsiThreshold === null) return;
    const syms = filtered.map(s => s.symbol).filter(s => rsiMap[s] === undefined);
    if (syms.length === 0) return;

    let cancelled = false;
    setRsiLoading(true);
    fetchRSIBatch(syms)
      .then(map => {
        if (!cancelled) setRsiMap(prev => ({ ...prev, ...map }));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setRsiLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rsiThreshold, universe, peMin, peMax, caps, changePctMin, changePctMax, volKey, sectors]);

  // ── Register CSV export ─────────────────────────────────────────────────
  useEffect(() => {
    const doExport = () => {
      const rows = sorted.map((s, i) => ({
        '#': i + 1,
        Symbol: s.symbol,
        Name: s.name,
        Price: s.price,
        'Chg%': s.changePct != null ? s.changePct.toFixed(2) : '',
        'P/E': s.pe != null ? s.pe.toFixed(1) : '',
        'Mkt Cap': s.marketCap,
        Volume: s.volume,
        '52W High': s.week52High,
        '52W Low': s.week52Low,
        RSI: rsiMap[s.symbol] ?? '',
      }));
      exportCSV(rows, 'screener_results.csv');
    };
    register('screener', 'SCREENER RESULTS', doExport);
    return () => unregister('screener');
  }, [sorted, rsiMap, register, unregister]);

  // ── Preset handler ──────────────────────────────────────────────────────
  const applyPreset = useCallback((name) => {
    if (activePreset === name) {
      // Clear all filters
      setPeMin(''); setPeMax(''); setCaps([]); setChangePctMin(''); setChangePctMax('');
      setVolKey('ANY'); setRsiThreshold(''); setSectors([]);
      setSortCol('marketCap'); setSortDir('desc');
      setActivePreset(null);
      return;
    }
    const p = PRESETS[name];
    setPeMin(p.peMin); setPeMax(p.peMax); setCaps(p.caps);
    setChangePctMin(p.changePctMin); setChangePctMax(p.changePctMax);
    setVolKey(p.volKey); setRsiThreshold(p.rsiThreshold); setSectors(p.sectors);
    setSortCol(p.sortCol); setSortDir(p.sortDir);
    setActivePreset(name);
  }, [activePreset]);

  // ── Sort handler ────────────────────────────────────────────────────────
  const handleSort = useCallback((col) => {
    setActivePreset(null);
    setSortCol(prev => {
      if (prev === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return col; }
      setSortDir('asc');
      return col;
    });
  }, []);

  // ── Toggle helpers ──────────────────────────────────────────────────────
  const toggleCap = useCallback((key) => {
    setActivePreset(null);
    setCaps(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);

  const toggleSector = useCallback((sec) => {
    setActivePreset(null);
    setSectors(prev => prev.includes(sec) ? prev.filter(s => s !== sec) : [...prev, sec]);
  }, []);

  // ── Active filter pills ─────────────────────────────────────────────────
  const activePills = useMemo(() => {
    const pills = [];
    if (peMin !== '') pills.push({ label: `P/E >= ${peMin}`, clear: () => setPeMin('') });
    if (peMax !== '') pills.push({ label: `P/E <= ${peMax}`, clear: () => setPeMax('') });
    caps.forEach(c => pills.push({ label: `CAP: ${c}`, clear: () => setCaps(prev => prev.filter(x => x !== c)) }));
    if (changePctMin !== '') pills.push({ label: `CHG% >= ${changePctMin}`, clear: () => setChangePctMin('') });
    if (changePctMax !== '') pills.push({ label: `CHG% <= ${changePctMax}`, clear: () => setChangePctMax('') });
    if (volKey !== 'ANY') pills.push({ label: `VOL ${VOLUME_THRESHOLDS.find(v => v.key === volKey)?.label}`, clear: () => setVolKey('ANY') });
    if (rsiThreshold !== '') pills.push({ label: `RSI < ${rsiThreshold}`, clear: () => setRsiThreshold('') });
    sectors.forEach(s => pills.push({ label: `SECT: ${s}`, clear: () => setSectors(prev => prev.filter(x => x !== s)) }));
    return pills;
  }, [peMin, peMax, caps, changePctMin, changePctMax, volKey, rsiThreshold, sectors]);

  // ── Column definitions ──────────────────────────────────────────────────
  const columns = useMemo(() => [
    { key: 'index',     label: '#',        width: '36px',  align: 'right'  },
    { key: 'symbol',    label: 'SYMBOL',   width: '80px',  align: 'left'   },
    { key: 'name',      label: 'NAME',     width: '1fr',   align: 'left'   },
    { key: 'price',     label: 'PRICE',    width: '80px',  align: 'right'  },
    { key: 'changePct', label: 'CHG%',     width: '72px',  align: 'right'  },
    { key: 'pe',        label: 'P/E',      width: '60px',  align: 'right'  },
    { key: 'marketCap', label: 'MKT CAP',  width: '82px',  align: 'right'  },
    { key: 'volume',    label: 'VOLUME',   width: '72px',  align: 'right'  },
    { key: 'week52High',label: '52W HIGH', width: '78px',  align: 'right'  },
    { key: 'week52Low', label: '52W LOW',  width: '78px',  align: 'right'  },
    { key: 'rsi',       label: 'RSI',      width: '52px',  align: 'right'  },
  ], []);

  const gridTemplate = columns.map(c => c.width).join(' ');

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: CLR.bg, fontFamily: FONT, padding: '40px', textAlign: 'center' }}>
        <div style={{ color: CLR.orange, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          LOADING SCREENER UNIVERSE...
        </div>
        <div style={{ color: CLR.dim, fontSize: '10px', marginTop: '8px' }}>
          Fetching ~300-600 stocks from multiple screeners
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: CLR.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div style={{
        background: CLR.headerBg, borderBottom: `2px solid ${CLR.orange}`,
        padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
      }}>
        <span style={{ color: CLR.orange, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: FONT }}>
          STOCK SCREENER
        </span>
        <span style={{ color: CLR.dim, fontSize: '10px', fontFamily: FONT }}>
          {sorted.length} / {universe.length} RESULTS
        </span>

        {/* Preset buttons */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
          {Object.keys(PRESETS).map(name => (
            <button
              key={name}
              onClick={() => applyPreset(name)}
              style={activePreset === name ? activeBtn : baseBtn}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setFiltersOpen(o => !o)}
          style={{ ...baseBtn, color: CLR.orange, borderColor: CLR.orange }}
        >
          FILTERS {filtersOpen ? '\u25B2' : '\u25BC'}
        </button>
      </div>

      {/* ── Active filter pills ─────────────────────────────────────────── */}
      {activePills.length > 0 && (
        <div style={{
          background: CLR.headerBg, padding: '3px 10px', display: 'flex', gap: '6px', flexWrap: 'wrap',
          borderBottom: `1px solid ${CLR.border}`,
        }}>
          {activePills.map((pill, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: CLR.activeBg, border: `1px solid ${CLR.orange}`, borderRadius: '2px',
              padding: '1px 6px', fontSize: '9px', color: CLR.orange, fontFamily: FONT,
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              {pill.label}
              <span
                onClick={pill.clear}
                style={{ cursor: 'pointer', color: CLR.red, fontWeight: 'bold', fontSize: '11px', lineHeight: 1 }}
              >
                \u00D7
              </span>
            </span>
          ))}
        </div>
      )}

      {/* ── Collapsible filter panel ────────────────────────────────────── */}
      {filtersOpen && (
        <div style={{
          background: CLR.filterBg, padding: '8px 10px', borderBottom: `1px solid ${CLR.border}`,
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          {/* Row 1: P/E, Change%, Volume, RSI */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* P/E range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: CLR.muted, fontSize: '10px', textTransform: 'uppercase', fontFamily: FONT }}>P/E</span>
              <input
                type="number" placeholder="min" value={peMin}
                onChange={e => { setPeMin(e.target.value); setActivePreset(null); }}
                style={inputStyle}
              />
              <span style={{ color: CLR.dim, fontSize: '10px' }}>-</span>
              <input
                type="number" placeholder="max" value={peMax}
                onChange={e => { setPeMax(e.target.value); setActivePreset(null); }}
                style={inputStyle}
              />
            </div>

            {/* Change% range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: CLR.muted, fontSize: '10px', textTransform: 'uppercase', fontFamily: FONT }}>CHG%</span>
              <input
                type="number" placeholder="min" value={changePctMin} step="0.5"
                onChange={e => { setChangePctMin(e.target.value); setActivePreset(null); }}
                style={inputStyle}
              />
              <span style={{ color: CLR.dim, fontSize: '10px' }}>-</span>
              <input
                type="number" placeholder="max" value={changePctMax} step="0.5"
                onChange={e => { setChangePctMax(e.target.value); setActivePreset(null); }}
                style={inputStyle}
              />
            </div>

            {/* Volume threshold */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: CLR.muted, fontSize: '10px', textTransform: 'uppercase', fontFamily: FONT }}>VOL</span>
              {VOLUME_THRESHOLDS.map(vt => (
                <button
                  key={vt.key}
                  onClick={() => { setVolKey(vt.key); setActivePreset(null); }}
                  style={volKey === vt.key ? activeBtn : baseBtn}
                >
                  {vt.label}
                </button>
              ))}
            </div>

            {/* RSI threshold */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: CLR.muted, fontSize: '10px', textTransform: 'uppercase', fontFamily: FONT }}>RSI &lt;</span>
              <input
                type="number" placeholder="e.g. 30" value={rsiThreshold} min="0" max="100"
                onChange={e => { setRsiThreshold(e.target.value); setActivePreset(null); }}
                style={{ ...inputStyle, width: '56px' }}
              />
              {rsiLoading && <span style={{ color: CLR.orange, fontSize: '9px', fontFamily: FONT }}>LOADING...</span>}
            </div>
          </div>

          {/* Row 2: Market Cap buckets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <span style={{ color: CLR.muted, fontSize: '10px', textTransform: 'uppercase', fontFamily: FONT, marginRight: '4px' }}>MKT CAP</span>
            {CAP_BUCKETS.map(b => (
              <button
                key={b.key}
                onClick={() => toggleCap(b.key)}
                style={caps.includes(b.key) ? activeBtn : baseBtn}
              >
                {b.label}
              </button>
            ))}
            {caps.length > 0 && (
              <button
                onClick={() => { setCaps([]); setActivePreset(null); }}
                style={{ ...baseBtn, color: CLR.red, borderColor: CLR.red, fontSize: '9px' }}
              >
                CLEAR
              </button>
            )}
          </div>

          {/* Row 3: Sector toggles */}
          {availableSectors.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <span style={{ color: CLR.muted, fontSize: '10px', textTransform: 'uppercase', fontFamily: FONT, marginRight: '4px' }}>SECTOR</span>
              {availableSectors.map(sec => (
                <button
                  key={sec}
                  onClick={() => toggleSector(sec)}
                  style={sectors.includes(sec) ? activeBtn : baseBtn}
                >
                  {sec.toUpperCase()}
                </button>
              ))}
              {sectors.length > 0 && (
                <button
                  onClick={() => { setSectors([]); setActivePreset(null); }}
                  style={{ ...baseBtn, color: CLR.red, borderColor: CLR.red, fontSize: '9px' }}
                >
                  CLEAR
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Table header ────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: gridTemplate,
        background: CLR.headerBg, padding: '4px 10px', borderBottom: `1px solid ${CLR.border}`,
        position: 'sticky', top: 0, zIndex: 2,
      }}>
        {columns.map(col => {
          const isActive = sortCol === col.key;
          const isSortable = col.key !== 'index';
          const arrow = isActive ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';
          return (
            <div
              key={col.key}
              onClick={isSortable ? () => handleSort(col.key) : undefined}
              style={{
                color: isActive ? CLR.orange : CLR.muted,
                fontSize: '10px', fontFamily: FONT, textTransform: 'uppercase',
                letterSpacing: '0.5px', textAlign: col.align,
                cursor: isSortable ? 'pointer' : 'default',
                userSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden',
                padding: '0 2px',
              }}
            >
              {col.label}{arrow}
            </div>
          );
        })}
      </div>

      {/* ── Table body ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {sorted.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: CLR.dim, fontSize: '11px', fontFamily: FONT, textTransform: 'uppercase' }}>
            No stocks match current filters
          </div>
        ) : (
          sorted.map((stock, idx) => {
            const rsi = rsiMap[stock.symbol] ?? null;
            const isHovered = hoveredRow === idx;
            return (
              <div
                key={stock.symbol}
                onClick={() => onTickerChange && onTickerChange(stock.symbol)}
                onMouseEnter={() => setHoveredRow(idx)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  display: 'grid', gridTemplateColumns: gridTemplate,
                  padding: '3px 10px', cursor: 'pointer',
                  background: isHovered ? CLR.rowHover : 'transparent',
                  borderBottom: `1px solid ${CLR.border}11`,
                  transition: 'background 0.1s',
                }}
              >
                {/* # */}
                <div style={{ color: CLR.dim, fontSize: '10px', fontFamily: FONT, textAlign: 'right', padding: '0 2px' }}>
                  {idx + 1}
                </div>

                {/* Symbol */}
                <div style={{ color: CLR.yellow, fontSize: '11px', fontFamily: FONT, fontWeight: 'bold', textAlign: 'left', padding: '0 2px', letterSpacing: '0.3px' }}>
                  {stock.symbol}
                </div>

                {/* Name */}
                <div style={{
                  color: CLR.text, fontSize: '10px', fontFamily: FONT, textAlign: 'left',
                  padding: '0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {stock.name || '--'}
                </div>

                {/* Price */}
                <div style={{ color: CLR.text, fontSize: '11px', fontFamily: FONT, textAlign: 'right', padding: '0 2px' }}>
                  {fmtPrice(stock.price)}
                </div>

                {/* Chg% */}
                <div style={{ color: pctColor(stock.changePct), fontSize: '11px', fontFamily: FONT, textAlign: 'right', padding: '0 2px' }}>
                  {fmtPct(stock.changePct)}
                </div>

                {/* P/E */}
                <div style={{ color: stock.pe != null ? CLR.text : CLR.dim, fontSize: '11px', fontFamily: FONT, textAlign: 'right', padding: '0 2px' }}>
                  {fmtPE(stock.pe)}
                </div>

                {/* Mkt Cap */}
                <div style={{ color: stock.marketCap != null ? CLR.text : CLR.dim, fontSize: '11px', fontFamily: FONT, textAlign: 'right', padding: '0 2px' }}>
                  {fmtMktCap(stock.marketCap)}
                </div>

                {/* Volume */}
                <div style={{ color: stock.volume != null ? CLR.text : CLR.dim, fontSize: '11px', fontFamily: FONT, textAlign: 'right', padding: '0 2px' }}>
                  {fmtVolume(stock.volume)}
                </div>

                {/* 52W High */}
                <div style={{ color: stock.week52High != null ? CLR.text : CLR.dim, fontSize: '11px', fontFamily: FONT, textAlign: 'right', padding: '0 2px' }}>
                  {fmtPrice(stock.week52High)}
                </div>

                {/* 52W Low */}
                <div style={{ color: stock.week52Low != null ? CLR.text : CLR.dim, fontSize: '11px', fontFamily: FONT, textAlign: 'right', padding: '0 2px' }}>
                  {fmtPrice(stock.week52Low)}
                </div>

                {/* RSI */}
                <div style={{
                  color: rsi != null
                    ? (rsi < 30 ? CLR.red : rsi > 70 ? CLR.green : CLR.text)
                    : CLR.dim,
                  fontSize: '11px', fontFamily: FONT, textAlign: 'right', padding: '0 2px',
                }}>
                  {rsi != null ? rsi.toFixed(1) : nullText(null)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div style={{
        background: CLR.headerBg, borderTop: `1px solid ${CLR.border}`,
        padding: '3px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: CLR.dim, fontSize: '9px', fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          UNIVERSE: {universe.length} STOCKS &middot; SHOWING: {sorted.length}
          {rsiThreshold !== '' && ` \u00B7 RSI DATA: ${Object.keys(rsiMap).length} LOADED`}
        </span>
        <button
          onClick={() => {
            const rows = sorted.map((s, i) => ({
              '#': i + 1, Symbol: s.symbol, Name: s.name, Price: s.price,
              'Chg%': s.changePct != null ? s.changePct.toFixed(2) : '',
              'P/E': s.pe != null ? s.pe.toFixed(1) : '',
              'Mkt Cap': s.marketCap, Volume: s.volume,
              '52W High': s.week52High, '52W Low': s.week52Low,
              RSI: rsiMap[s.symbol] ?? '',
            }));
            exportCSV(rows, 'screener_results.csv');
          }}
          style={{ ...baseBtn, color: CLR.orange, borderColor: CLR.orange }}
        >
          EXPORT CSV
        </button>
      </div>
    </div>
  );
}
