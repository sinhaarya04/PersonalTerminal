// CSV export utilities — RFC 4180 compliant with Excel BOM

function escapeCell(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function arrayToCSV(rows, headers) {
  if (!rows || rows.length === 0) return '';
  const cols = headers || Object.keys(rows[0]);
  const lines = [cols.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(cols.map(c => escapeCell(row[c])).join(','));
  }
  return lines.join('\r\n');
}

export function downloadCSV(csvString, filename) {
  if (!csvString) return;
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCSV(rows, filename, headers) {
  const csv = arrayToCSV(rows, headers);
  if (csv) {
    // Lazy-import analytics to avoid circular deps
    import('../lib/analytics').then(({ track }) => {
      track('csv_export', { filename, rows: rows.length });
    }).catch(() => {});
    downloadCSV(csv, filename);
  }
}
