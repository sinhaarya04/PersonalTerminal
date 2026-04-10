import { useState, useCallback, useEffect } from 'react';

/**
 * Load/save chart drawings per user+ticker in Supabase.
 * Falls back to localStorage if the API is unavailable.
 * Returns { savedChart, saveChart, deleteSavedChart }
 */
export function useSavedChart(email, ticker) {
  const [savedChart, setSavedChart] = useState(null);

  // Load on mount and when email/ticker change
  useEffect(() => {
    if (!email || !ticker) { setSavedChart(null); return; }
    let cancelled = false;

    (async () => {
      const lsKey = `saved_chart_v1_${email.toLowerCase().trim()}_${ticker.toUpperCase()}`;
      try {
        const res = await fetch(`/api/charts?user_id=${encodeURIComponent(email)}&ticker=${encodeURIComponent(ticker)}`);
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        if (cancelled) return;
        if (data.length > 0) {
          const c = data[0];
          setSavedChart({
            drawings: c.drawings || [],
            indicators: c.indicators || [],
            chartMode: c.chart_mode || 'CANDLE',
            range: c.range || '1Y',
            savedAt: new Date(c.saved_at).getTime(),
          });
        } else {
          // Supabase empty — check localStorage for migration
          try {
            const raw = localStorage.getItem(lsKey);
            setSavedChart(raw ? JSON.parse(raw) : null);
          } catch {
            setSavedChart(null);
          }
        }
      } catch (err) {
        console.warn('[charts] API load failed, using localStorage:', err);
        if (cancelled) return;
        try {
          const raw = localStorage.getItem(lsKey);
          setSavedChart(raw ? JSON.parse(raw) : null);
        } catch {
          setSavedChart(null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [email, ticker]);

  const saveChart = useCallback(async (drawings, indicators, chartMode, range) => {
    if (!email || !ticker) return;
    const data = { drawings, indicators, chartMode, range, savedAt: Date.now() };
    setSavedChart(data);

    try {
      const res = await fetch('/api/charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: email,
          ticker: ticker.toUpperCase(),
          drawings,
          indicators,
          chart_mode: chartMode,
          range,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`API ${res.status}: ${text}`);
      }
    } catch (err) {
      console.warn('[charts] API save failed, using localStorage:', err);
      try {
        const key = `saved_chart_v1_${email.toLowerCase().trim()}_${ticker.toUpperCase()}`;
        localStorage.setItem(key, JSON.stringify(data));
      } catch { /* quota */ }
    }
  }, [email, ticker]);

  const deleteSavedChart = useCallback(async () => {
    if (!email || !ticker) return;
    setSavedChart(null);

    try {
      await fetch(`/api/charts?user_id=${encodeURIComponent(email)}&ticker=${encodeURIComponent(ticker)}`, {
        method: 'DELETE',
      });
    } catch {
      // Fallback: remove from localStorage
      const key = `saved_chart_v1_${email.toLowerCase().trim()}_${ticker.toUpperCase()}`;
      localStorage.removeItem(key);
    }
  }, [email, ticker]);

  return { savedChart, saveChart, deleteSavedChart };
}

/** List all saved chart tickers for a user */
export async function listSavedCharts(email) {
  if (!email) return [];
  try {
    const res = await fetch(`/api/charts?user_id=${encodeURIComponent(email)}`);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.map(c => ({
      ticker: c.ticker,
      drawings: c.drawings,
      indicators: c.indicators,
      chartMode: c.chart_mode,
      range: c.range,
      savedAt: new Date(c.saved_at).getTime(),
    }));
  } catch {
    // Fallback to localStorage
    const prefix = `saved_chart_v1_${email.toLowerCase().trim()}_`;
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
}
