import { useState, useCallback, useEffect } from 'react';

const PREFIX = 'saved_chart_v1_';

function storageKey(email, ticker) {
  return `${PREFIX}${email.toLowerCase().trim()}_${ticker.toUpperCase()}`;
}

/**
 * Load/save chart drawings per user+ticker in localStorage.
 * Returns { savedChart, saveChart, deleteSavedChart }
 *
 * savedChart shape: { drawings: [], indicators: [], chartMode: string, range: string, savedAt: number } | null
 */
export function useSavedChart(email, ticker) {
  const [savedChart, setSavedChart] = useState(null);

  // Load on mount and when email/ticker change
  useEffect(() => {
    if (!email || !ticker) { setSavedChart(null); return; }
    try {
      const raw = localStorage.getItem(storageKey(email, ticker));
      setSavedChart(raw ? JSON.parse(raw) : null);
    } catch {
      setSavedChart(null);
    }
  }, [email, ticker]);

  const saveChart = useCallback((drawings, indicators, chartMode, range) => {
    if (!email || !ticker) return;
    const data = { drawings, indicators, chartMode, range, savedAt: Date.now() };
    try {
      localStorage.setItem(storageKey(email, ticker), JSON.stringify(data));
      setSavedChart(data);
    } catch { /* quota */ }
  }, [email, ticker]);

  const deleteSavedChart = useCallback(() => {
    if (!email || !ticker) return;
    localStorage.removeItem(storageKey(email, ticker));
    setSavedChart(null);
  }, [email, ticker]);

  return { savedChart, saveChart, deleteSavedChart };
}

/** List all saved chart tickers for a user */
export function listSavedCharts(email) {
  if (!email) return [];
  const prefix = `${PREFIX}${email.toLowerCase().trim()}_`;
  const charts = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(prefix)) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        charts.push({ ticker: key.slice(prefix.length), ...data });
      } catch { /* skip */ }
    }
  }
  return charts.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}
