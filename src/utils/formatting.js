// Number formatting utilities

export function formatValue(v, decimals = 2) {
  if (v === null || v === undefined || isNaN(v)) return '--';
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatChange(v, decimals = 2) {
  if (v === null || v === undefined || isNaN(v)) return '--';
  const sign = v >= 0 ? '+' : '';
  return sign + Number(v).toFixed(decimals);
}

export function formatPct(v, decimals = 2) {
  if (v === null || v === undefined || isNaN(v)) return '--';
  const sign = v >= 0 ? '+' : '';
  return sign + Number(v).toFixed(decimals) + '%';
}

export function getCellClass(v) {
  if (v === null || v === undefined || isNaN(v)) return '';
  if (v >= 10) return 'cell-pos-high';
  if (v >= 5)  return 'cell-pos-mid';
  if (v >= 0)  return 'cell-pos-low';
  if (v >= -5) return 'cell-neg-low';
  if (v >= -10) return 'cell-neg-mid';
  return 'cell-neg-high';
}

export function getCellStyle(v) {
  if (v === null || v === undefined || isNaN(v)) return {};
  if (v >= 10)  return { background: '#005500', color: '#00ff00' };
  if (v >= 5)   return { background: '#003300', color: '#00cc00' };
  if (v >= 0)   return { background: '#001a00', color: '#00aa00' };
  if (v >= -5)  return { background: '#1a0000', color: '#ff4444' };
  if (v >= -10) return { background: '#330000', color: '#ff0000' };
  return { background: '#550000', color: '#ff0000' };
}

export function getChangeColor(v) {
  if (v === null || v === undefined || isNaN(v)) return '#ffffff';
  return v >= 0 ? '#00cc00' : '#ff0000';
}

export function formatLargeNumber(v) {
  if (v === null || v === undefined || isNaN(v)) return '--';
  if (Math.abs(v) >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (Math.abs(v) >= 1e9)  return (v / 1e9).toFixed(2) + 'B';
  if (Math.abs(v) >= 1e6)  return (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3)  return (v / 1e3).toFixed(2) + 'K';
  return v.toFixed(2);
}

export function tsToTime(ms) {
  if (!ms) return '--';
  const d = new Date(ms);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function tsToDate(ms) {
  if (!ms) return '--';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
