import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

const FONT = "'Consolas','Courier New',monospace";
const COUNTRIES = 'USA;CHN;JPN;DEU;IND;GBR;FRA;BRA;ITA;CAN;KOR;AUS;ESP;MEX;IDN;NLD;SAU;TUR;CHE;SGP';
const INDICATORS = [
  { id: 'NY.GDP.MKTP.CD', label: 'GDP ($)', fmt: v => { if (!v) return '--'; if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T'; return '$' + (v / 1e9).toFixed(0) + 'B'; } },
  { id: 'NY.GDP.MKTP.KD.ZG', label: 'GDP GROWTH %', fmt: v => v != null ? v.toFixed(2) + '%' : '--', color: v => v > 2 ? '#00cc00' : v > 0 ? '#ffcc00' : '#ff4444' },
  { id: 'FP.CPI.TOTL.ZG', label: 'INFLATION %', fmt: v => v != null ? v.toFixed(2) + '%' : '--', color: v => v < 3 ? '#00cc00' : v < 6 ? '#ffcc00' : '#ff4444' },
  { id: 'SP.POP.TOTL', label: 'POPULATION', fmt: v => { if (!v) return '--'; if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'; if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'; return v.toLocaleString(); } },
  { id: 'SL.UEM.TOTL.ZS', label: 'UNEMP %', fmt: v => v != null ? v.toFixed(1) + '%' : '--', color: v => v < 5 ? '#00cc00' : v < 8 ? '#ffcc00' : '#ff4444' },
  { id: 'NE.TRD.GNFS.ZS', label: 'TRADE % GDP', fmt: v => v != null ? v.toFixed(1) + '%' : '--' },
];

const S = {
  container: { padding: 0, background: '#000' },
  header: { background: '#0d0d1a', borderBottom: '2px solid #ff8c00', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#ff8c00', fontFamily: FONT, fontSize: 13, letterSpacing: 1 },
  thRow: { display: 'flex', padding: '3px 8px', background: '#0d0d1a', borderBottom: '1px solid #333' },
  row: { display: 'flex', padding: '3px 8px', borderBottom: '1px solid #111', alignItems: 'center' },
  cell: (w, align) => ({ fontFamily: FONT, fontSize: 11, width: w, textAlign: align || 'right', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  loading: { padding: 20, fontFamily: FONT, fontSize: 12, color: '#ff8c00', textAlign: 'center' },
};

export default function WorldEconDashboard() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState('NY.GDP.MKTP.CD');
  const [sortDir, setSortDir] = useState('desc');
  const { register, unregister } = useExport();

  const load = useCallback(async () => {
    try {
      const results = await Promise.allSettled(
        INDICATORS.map(ind =>
          fetch(`/worldbank/v2/country/${COUNTRIES}/indicator/${ind.id}?format=json&date=2020:2024&per_page=500`, { signal: AbortSignal.timeout(15000) })
            .then(r => r.json())
            .then(d => ({ id: ind.id, records: Array.isArray(d) && d[1] ? d[1] : [] }))
        )
      );
      const merged = {};
      results.forEach(r => {
        if (r.status !== 'fulfilled') return;
        const { id, records } = r.value;
        records.forEach(rec => {
          if (rec.value == null) return;
          const cc = rec.countryiso3code || rec.country?.id;
          if (!cc) return;
          if (!merged[cc]) merged[cc] = { code: cc, name: rec.country?.value || cc };
          // Keep most recent non-null value
          if (!merged[cc][id] || rec.date > (merged[cc][id + '_year'] || '')) {
            merged[cc][id] = rec.value;
            merged[cc][id + '_year'] = rec.date;
          }
        });
      });
      setData(merged);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const countries = useMemo(() => {
    const list = Object.values(data);
    return [...list].sort((a, b) => {
      const va = a[sortCol] ?? 0, vb = b[sortCol] ?? 0;
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [data, sortCol, sortDir]);

  useEffect(() => {
    if (countries.length) register('WORLD_ECON', 'World Economies', () => {
      exportCSV(countries.map(c => {
        const row = { Country: c.name };
        INDICATORS.forEach(ind => { row[ind.label] = c[ind.id]; });
        return row;
      }), 'world_economies.csv');
    });
    return () => unregister('WORLD_ECON');
  }, [countries, register, unregister]);

  const handleSort = (col) => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc'); } };
  const arrow = (col) => sortCol === col ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  if (loading) return <div style={S.loading}>LOADING WORLD ECONOMY DATA...</div>;

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.title}>WORLD ECONOMY</span>
        <span style={{ fontFamily: FONT, fontSize: 10, color: '#666' }}>WORLD BANK | TOP 20 ECONOMIES</span>
      </div>
      <div style={S.thRow}>
        <span style={{ ...S.cell(130, 'left'), color: '#888', fontWeight: 600, cursor: 'pointer' }} onClick={() => handleSort('name')}>COUNTRY{arrow('name')}</span>
        {INDICATORS.map(ind => (
          <span key={ind.id} style={{ ...S.cell(110), color: '#888', fontWeight: 600, cursor: 'pointer' }} onClick={() => handleSort(ind.id)}>
            {ind.label}{arrow(ind.id)}
          </span>
        ))}
      </div>
      {countries.map(c => (
        <div key={c.code} style={S.row}>
          <span style={{ ...S.cell(130, 'left'), color: '#ddd', fontWeight: 600 }}>{c.name}</span>
          {INDICATORS.map(ind => {
            const v = c[ind.id];
            const color = ind.color ? ind.color(v) : '#ccc';
            return <span key={ind.id} style={{ ...S.cell(110), color }}>{ind.fmt(v)}</span>;
          })}
        </div>
      ))}
    </div>
  );
}
