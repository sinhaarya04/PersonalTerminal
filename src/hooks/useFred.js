// FRED (Federal Reserve Economic Data) — routed through CRA dev-server proxy
// /fred → api.stlouisfed.org   (see src/setupProxy.js)

// ── Cache (1-hour TTL — macro data updates daily/monthly at most) ────────────
const _cache = new Map();
const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

function cacheGet(k) {
  const e = _cache.get(k);
  if (!e) return null;
  if (Date.now() > e.exp) { _cache.delete(k); return null; }
  return e.v;
}
function cacheSet(k, v, ttl = DEFAULT_TTL) {
  _cache.set(k, { v, exp: Date.now() + ttl });
}

// ── Core fetch through /fred proxy ──────────────────────────────────────────
async function fredFetch(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `/fred${path}${qs ? '?' + qs : ''}`;

  const cached = cacheGet(url);
  if (cached) return cached;

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`FRED ${res.status}`);

  const data = await res.json();
  cacheSet(url, data);
  return data;
}

// ── Series definitions ──────────────────────────────────────────────────────
export const MACRO_SERIES = [
  // Growth
  { id: 'GDP',      label: 'GDP',            category: 'GROWTH & OUTPUT',     unit: '$', scale: 1e9, suffix: '',  pctChange: true,  decimals: 1 },
  { id: 'GDPC1',    label: 'REAL GDP',       category: 'GROWTH & OUTPUT',     unit: '$', scale: 1e9, suffix: '',  pctChange: true,  decimals: 1 },
  // Inflation
  { id: 'CPIAUCSL', label: 'CPI',            category: 'INFLATION',           unit: '',  scale: 1,   suffix: '',  pctChange: true,  decimals: 1 },
  { id: 'CPILFESL', label: 'CORE CPI',       category: 'INFLATION',           unit: '',  scale: 1,   suffix: '',  pctChange: true,  decimals: 1 },
  // Employment
  { id: 'UNRATE',   label: 'UNEMPLOYMENT',   category: 'EMPLOYMENT',          unit: '',  scale: 1,   suffix: '%', pctChange: false, decimals: 1 },
  { id: 'PAYEMS',   label: 'NONFARM PAYROLLS', category: 'EMPLOYMENT',        unit: '',  scale: 1e3, suffix: '',  pctChange: false, decimals: 0 },
  { id: 'ICSA',     label: 'INITIAL CLAIMS', category: 'EMPLOYMENT',          unit: '',  scale: 1e3, suffix: '',  pctChange: false, decimals: 0 },
  // Rates
  { id: 'DFF',      label: 'FED FUNDS RATE', category: 'RATES & YIELDS',      unit: '',  scale: 1,   suffix: '%', pctChange: false, decimals: 2 },
  { id: 'DGS10',    label: '10Y TREASURY',   category: 'RATES & YIELDS',      unit: '',  scale: 1,   suffix: '%', pctChange: false, decimals: 2 },
  { id: 'DGS2',     label: '2Y TREASURY',    category: 'RATES & YIELDS',      unit: '',  scale: 1,   suffix: '%', pctChange: false, decimals: 2 },
  // Activity & Sentiment
  { id: 'RSXFS',    label: 'RETAIL SALES',   category: 'ACTIVITY & SENTIMENT', unit: '$', scale: 1e6, suffix: '',  pctChange: true,  decimals: 1 },
  { id: 'UMCSENT',  label: 'CONSUMER SENT.', category: 'ACTIVITY & SENTIMENT', unit: '',  scale: 1,   suffix: '',  pctChange: false, decimals: 1 },
];

// Yield curve maturities
const YIELD_MATURITIES = [
  { id: 'DGS1MO', label: '1M',  months: 1 },
  { id: 'DGS3MO', label: '3M',  months: 3 },
  { id: 'DGS6MO', label: '6M',  months: 6 },
  { id: 'DGS1',   label: '1Y',  months: 12 },
  { id: 'DGS2',   label: '2Y',  months: 24 },
  { id: 'DGS3',   label: '3Y',  months: 36 },
  { id: 'DGS5',   label: '5Y',  months: 60 },
  { id: 'DGS7',   label: '7Y',  months: 84 },
  { id: 'DGS10',  label: '10Y', months: 120 },
  { id: 'DGS20',  label: '20Y', months: 240 },
  { id: 'DGS30',  label: '30Y', months: 360 },
];

// ── Public API ──────────────────────────────────────────────────────────────

export async function fetchFredSeries(seriesId, apiKey, opts = {}) {
  const params = {
    series_id: seriesId,
    api_key: apiKey,
    file_type: 'json',
    sort_order: 'desc',
    limit: opts.limit || 60,
    ...opts,
  };
  const data = await fredFetch('/fred/series/observations', params);
  // Filter out "." values (FRED uses "." for missing data)
  const obs = (data?.observations || [])
    .filter(o => o.value !== '.' && o.value != null)
    .map(o => ({ date: o.date, value: parseFloat(o.value) }));
  return obs;
}

export async function fetchMultipleSeries(apiKey) {
  const ids = MACRO_SERIES.map(s => s.id);
  const results = await Promise.allSettled(
    ids.map(id => fetchFredSeries(id, apiKey, { limit: 60 }))
  );

  const out = {};
  ids.forEach((id, i) => {
    if (results[i].status === 'fulfilled') {
      out[id] = results[i].value;
    } else {
      out[id] = [];
    }
  });
  return out;
}

export async function fetchYieldCurve(apiKey) {
  const results = await Promise.allSettled(
    YIELD_MATURITIES.map(m =>
      fetchFredSeries(m.id, apiKey, { limit: 5 })
    )
  );

  return YIELD_MATURITIES.map((m, i) => {
    const obs = results[i].status === 'fulfilled' ? results[i].value : [];
    // Get the most recent non-null value
    const latest = obs.find(o => !isNaN(o.value));
    return {
      ...m,
      yield: latest ? latest.value : null,
      date: latest ? latest.date : null,
    };
  }).filter(p => p.yield != null);
}

// ── Helpers for formatting ──────────────────────────────────────────────────

export function formatMacroValue(value, meta) {
  if (value == null || isNaN(value)) return '--';

  let scaled = value;
  let prefix = meta.unit;
  let suffix = meta.suffix;

  // Scale large values
  if (meta.scale >= 1e9) {
    scaled = value / 1000; // FRED GDP is in billions, display as trillions
    suffix = 'T';
  } else if (meta.scale >= 1e6) {
    // FRED retail sales in millions, display in billions
    scaled = value / 1000;
    suffix = 'B';
  } else if (meta.scale >= 1e3) {
    // Already in thousands (payrolls, claims)
    suffix = 'K';
  }

  const formatted = scaled.toFixed(meta.decimals);
  return `${prefix}${formatted}${suffix}`;
}

export function computeChange(observations, meta) {
  if (!observations || observations.length < 2) return { change: null, direction: 0 };

  const latest = observations[0].value;
  const prev = observations[1].value;

  if (latest == null || prev == null) return { change: null, direction: 0 };

  let change;
  let changeStr;

  if (meta.pctChange) {
    // Show % change
    change = ((latest - prev) / Math.abs(prev)) * 100;
    changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  } else {
    // Show absolute change
    change = latest - prev;
    const abs = Math.abs(change);
    if (meta.scale >= 1e3) {
      changeStr = `${change >= 0 ? '+' : '-'}${abs.toFixed(0)}K`;
    } else {
      changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(meta.decimals)}`;
    }
  }

  return {
    change,
    changeStr,
    direction: change > 0.001 ? 1 : change < -0.001 ? -1 : 0,
  };
}
