// Yahoo Finance — routed through CRA dev-server proxy (/yf → query2.finance.yahoo.com)
// Google News RSS — routed through CRA dev-server proxy (/gnews → news.google.com)
// See src/setupProxy.js for proxy configuration

// ── Simple in-memory cache ────────────────────────────────────────────────────
const _cache = new Map();
function yfCacheGet(k) {
  const e = _cache.get(k);
  if (!e) return null;
  if (Date.now() > e.exp) { _cache.delete(k); return null; }
  return e.v;
}
function yfCacheSet(k, v, ttlMs = 5 * 60 * 1000) {
  _cache.set(k, { v, exp: Date.now() + ttlMs });
}

// ── Core fetch — routes through /yf dev-server proxy ─────────────────────────
async function yfFetch(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `/yf${path}${qs ? '?' + qs : ''}`;

  const cached = yfCacheGet(url);
  if (cached) return cached;

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);

  const data = await res.json();
  yfCacheSet(url, data);
  return data;
}

// ── World index symbols ───────────────────────────────────────────────────────
export const INDEX_META = {
  americas: [
    { id: 4,  symbol: '^DJI',     name: 'DOW JONES INDUS AVG' },
    { id: 5,  symbol: '^GSPC',    name: 'S&P 500 INDEX' },
    { id: 6,  symbol: '^IXIC',    name: 'NASDAQ COMPOSITE' },
    { id: 7,  symbol: '^GSPTSE',  name: 'S&P/TSX COMPOSITE' },
    { id: 8,  symbol: '^MXX',     name: 'MEXICO IPC INDEX' },
    { id: 9,  symbol: '^BVSP',    name: 'BRAZIL BOVESPA' },
  ],
  emea: [
    { id: 10, symbol: '^STOXX50E', name: 'EURO STOXX 50' },
    { id: 11, symbol: '^FTSE',     name: 'FTSE 100' },
    { id: 12, symbol: '^FCHI',     name: 'CAC 40' },
    { id: 13, symbol: '^GDAXI',    name: 'DAX' },
    { id: 14, symbol: '^IBEX',     name: 'IBEX 35' },
    { id: 15, symbol: 'FTSEMIB.MI',name: 'FTSE MIB' },
    { id: 16, symbol: '^AEX',      name: 'AEX INDEX' },
    { id: 17, symbol: '^OMX',      name: 'OMX STOCKHOLM 30' },
    { id: 18, symbol: '^SSMI',     name: 'SWISS MARKET INDEX' },
  ],
  asia: [
    { id: 24, symbol: '^N225',  name: 'NIKKEI 225' },
    { id: 25, symbol: '^HSI',   name: 'HANG SENG INDEX' },
    { id: 26, symbol: '^AXJO',  name: 'S&P/ASX 200' },
  ],
};

const ALL_INDEX_SYMBOLS = [
  ...INDEX_META.americas,
  ...INDEX_META.emea,
  ...INDEX_META.asia,
].map(x => x.symbol);

// ── Single quote from v8 chart meta (v7/quote is 401, v8/chart works) ─────────
async function fetchQuoteFromChart(ticker) {
  const data = await yfFetch(`/v8/finance/chart/${encodeURIComponent(ticker)}`, {
    interval: '1d',
    range: '1d',
    includePrePost: false,
  });
  const result = data?.chart?.result?.[0];
  if (!result) return null;
  const meta = result.meta;
  if (!meta) return null;

  const price    = meta.regularMarketPrice ?? null;
  const prev     = meta.chartPreviousClose ?? price;
  const change   = price != null && prev != null ? price - prev : null;
  const changePct = change != null && prev ? (change / prev) * 100 : null;
  // Get today's open from the first indicator bar (more accurate than prev close)
  const open = result.indicators?.quote?.[0]?.open?.[0] ?? prev ?? 0;

  return {
    symbol:                       meta.symbol,
    longName:                     meta.longName || meta.shortName || meta.symbol,
    shortName:                    meta.shortName || meta.symbol,
    regularMarketPrice:           price,
    regularMarketChange:          change,
    regularMarketChangePercent:   changePct,
    regularMarketOpen:            open,
    regularMarketDayHigh:         meta.regularMarketDayHigh  ?? null,
    regularMarketDayLow:          meta.regularMarketDayLow   ?? null,
    regularMarketVolume:          meta.regularMarketVolume   ?? null,
    regularMarketTime:            meta.regularMarketTime     ?? null,
    fiftyTwoWeekHigh:             meta.fiftyTwoWeekHigh      ?? null,
    fiftyTwoWeekLow:              meta.fiftyTwoWeekLow       ?? null,
    // Not available from chart endpoint
    marketCap:                    null,
    trailingPE:                   null,
    epsTrailingTwelveMonths:      null,
    averageDailyVolume3Month:     null,
    ytdReturn:                    null,
  };
}

// ── Batch quote (replaces v7/quote which now returns 401) ─────────────────────
export async function fetchYFQuotes(symbols) {
  if (!symbols?.length) return [];
  const results = await Promise.allSettled(symbols.map(s => fetchQuoteFromChart(s)));
  return results
    .filter(r => r.status === 'fulfilled' && r.value != null)
    .map(r => r.value);
}

// ── Live quote (short TTL for polling) ────────────────────────────────────────
async function fetchQuoteFromChartLive(ticker) {
  const url = `/yf/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d&includePrePost=false`;
  const liveKey = `live:${url}`;
  const cached = yfCacheGet(liveKey);
  if (cached) return cached;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return null;
  const meta = result.meta;
  if (!meta) return null;

  const price = meta.regularMarketPrice ?? null;
  const prev = meta.chartPreviousClose ?? price;
  const change = price != null && prev != null ? price - prev : null;
  const changePct = change != null && prev ? (change / prev) * 100 : null;

  const q = {
    symbol: meta.symbol,
    longName: meta.longName || meta.shortName || meta.symbol,
    shortName: meta.shortName || meta.symbol,
    regularMarketPrice: price,
    regularMarketChange: change,
    regularMarketChangePercent: changePct,
    regularMarketOpen: result.indicators?.quote?.[0]?.open?.[0] ?? prev ?? 0,
    regularMarketDayHigh: meta.regularMarketDayHigh ?? null,
    regularMarketDayLow: meta.regularMarketDayLow ?? null,
    regularMarketVolume: meta.regularMarketVolume ?? null,
  };
  yfCacheSet(liveKey, q, 20 * 1000); // 20s TTL for live polling
  return q;
}

export async function fetchYFQuotesLive(symbols) {
  if (!symbols?.length) return [];
  const results = await Promise.allSettled(symbols.map(s => fetchQuoteFromChartLive(s)));
  return results
    .filter(r => r.status === 'fulfilled' && r.value != null)
    .map(r => r.value);
}

// ── Top Movers / Most Active (Yahoo screener) ────────────────────────────────
export async function fetchTopMovers(count = 10) {
  const ids = ['day_gainers', 'day_losers', 'most_actives'];
  const results = await Promise.allSettled(
    ids.map(scrId => yfFetch('/v1/finance/screener/predefined/saved', { scrIds: scrId, count }))
  );
  const map = (r) => {
    if (r.status !== 'fulfilled') return [];
    const quotes = r.value?.finance?.result?.[0]?.quotes || [];
    return quotes.map(q => ({
      symbol: q.symbol,
      name: q.shortName || q.longName || q.symbol,
      price: q.regularMarketPrice ?? 0,
      change: q.regularMarketChange ?? 0,
      changePct: q.regularMarketChangePercent ?? 0,
      volume: q.regularMarketVolume ?? 0,
      avgVolume: q.averageDailyVolume3Month ?? 0,
    }));
  };
  return { gainers: map(results[0]), losers: map(results[1]), actives: map(results[2]) };
}

// ── Earnings data from screener quotes ───────────────────────────────────────
export async function fetchEarningsData(symbols) {
  // Fetch from screeners to get earnings fields
  const movers = await fetchTopMovers(50);
  const pool = {};
  [...movers.gainers, ...movers.losers, ...movers.actives].forEach(q => { pool[q.symbol] = q; });

  // Also fetch direct quotes for requested symbols not in the pool
  const missing = symbols.filter(s => !pool[s]);
  if (missing.length > 0) {
    const quotes = await fetchYFQuotes(missing);
    quotes.forEach(q => { pool[q.symbol] = q; });
  }

  // For earnings fields, we need the raw screener data — re-fetch with symbols
  const earningsResults = await Promise.allSettled(
    symbols.map(s => yfFetch(`/v8/finance/chart/${encodeURIComponent(s)}`, {
      interval: '1d', range: '5d', includePrePost: false,
    }))
  );

  return symbols.map((sym, i) => {
    const chartResult = earningsResults[i];
    const meta = chartResult?.status === 'fulfilled'
      ? chartResult.value?.chart?.result?.[0]?.meta : null;
    const poolQ = pool[sym];

    return {
      symbol: sym,
      name: poolQ?.name || meta?.shortName || meta?.longName || sym,
      price: poolQ?.price ?? meta?.regularMarketPrice ?? null,
      change: poolQ?.change ?? (meta ? (meta.regularMarketPrice - (meta.chartPreviousClose || 0)) : null),
      changePct: poolQ?.changePct ?? null,
      earningsTimestamp: meta?.earningsTimestamp ?? null,
      earningsTimestampStart: meta?.earningsTimestampStart ?? null,
      earningsTimestampEnd: meta?.earningsTimestampEnd ?? null,
      epsForward: meta?.epsForward ?? null,
      epsCurrentYear: meta?.epsCurrentYear ?? null,
      epsTTM: meta?.epsTrailingTwelveMonths ?? null,
    };
  });
}

// ── Historical OHLCV chart ────────────────────────────────────────────────────
export async function fetchYFChart(ticker, range = '2y', interval = '1d') {
  const data = await yfFetch(`/v8/finance/chart/${encodeURIComponent(ticker)}`, {
    interval,
    range,
    includePrePost: false,
  });
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const { timestamp, indicators, meta } = result;
  const quote = indicators?.quote?.[0];
  if (!timestamp || !quote) return null;

  const bars = timestamp.map((t, i) => ({
    t: t * 1000,
    o: quote.open?.[i],
    h: quote.high?.[i],
    l: quote.low?.[i],
    c: quote.close?.[i],
    v: quote.volume?.[i],
  })).filter(b => b.c !== null && b.c !== undefined);

  return { bars, meta };
}

// ── World Equity Indices ──────────────────────────────────────────────────────
export async function fetchWorldIndices() {
  const quotes = await fetchYFQuotes(ALL_INDEX_SYMBOLS);
  const bySymbol = {};
  quotes.forEach(q => { bySymbol[q.symbol] = q; });

  function mapRegion(region) {
    return region.map(meta => {
      const q = bySymbol[meta.symbol];
      if (!q) return null;
      const timeMs = (q.regularMarketTime || 0) * 1000;
      const d = new Date(timeMs);
      const time = timeMs ? `${d.getMonth() + 1}/${d.getDate()}` : '--';
      return {
        id:     meta.id,
        symbol: meta.symbol,
        name:   meta.name,
        value:  q.regularMarketPrice         ?? null,
        netChg: q.regularMarketChange        ?? null,
        pctChg: q.regularMarketChangePercent ?? null,
        time,
        ytd:    null, // not available without an extra chart call
      };
    }).filter(Boolean);
  }

  return {
    americas: mapRegion(INDEX_META.americas),
    emea:     mapRegion(INDEX_META.emea),
    asia:     mapRegion(INDEX_META.asia),
  };
}

// ── Google News RSS ───────────────────────────────────────────────────────────
export async function fetchGoogleNews(query, count = 10) {
  const params = new URLSearchParams({
    q:    query,
    hl:   'en-US',
    gl:   'US',
    ceid: 'US:en',
  });
  const cacheKey = `gnews:${query}`;

  const cached = yfCacheGet(cacheKey);
  if (cached) return cached;

  const res = await fetch(`/gnews/rss/search?${params}`, {
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`news ${res.status}`);

  const text = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
  if (doc.querySelector('parsererror')) return [];

  const items = [...doc.querySelectorAll('item')].slice(0, count);
  const normalized = items.map((item, i) => {
    const get = (tag) => item.querySelector(tag)?.textContent?.trim() || '';
    const rawTitle = get('title');
    const title = rawTitle.replace(/\s+[-–]\s+[^-–]{2,40}$/, '').trim() || rawTitle;
    const link     = get('link');
    const pubDate  = get('pubDate');
    const source   = item.querySelector('source')?.textContent?.trim() || 'GOOGLE NEWS';

    return {
      id:            get('guid') || link || `item-${i}`,
      title,
      publisher:     { name: source.toUpperCase() },
      published_utc: pubDate
        ? (() => { try { return new Date(pubDate).toISOString(); } catch { return new Date().toISOString(); } })()
        : new Date().toISOString(),
      article_url:   link || '#',
      tickers:       [],
    };
  }).filter(i => i.title.length > 3);

  yfCacheSet(cacheKey, normalized, 3 * 60 * 1000);
  return normalized;
}

// ── Stock Screener — broad universe from predefined screeners ───────────────
export async function fetchScreenerUniverse() {
  const cacheKey = 'screener_universe';
  const cached = yfCacheGet(cacheKey);
  if (cached) return cached;

  const screenerIds = [
    'most_actives',
    'day_gainers',
    'day_losers',
    'undervalued_growth_stocks',
    'aggressive_small_caps',
    'growth_technology_stocks',
    'undervalued_large_caps',
    'small_cap_gainers',
  ];

  const results = await Promise.allSettled(
    screenerIds.map(scrId =>
      yfFetch('/v1/finance/screener/predefined/saved', { scrIds: scrId, count: 250 })
    )
  );

  const pool = {};
  results.forEach(r => {
    if (r.status !== 'fulfilled') return;
    const quotes = r.value?.finance?.result?.[0]?.quotes || [];
    quotes.forEach(q => {
      if (!q.symbol || pool[q.symbol]) return;
      pool[q.symbol] = {
        symbol: q.symbol,
        name: q.shortName || q.longName || q.symbol,
        price: q.regularMarketPrice ?? null,
        changePct: q.regularMarketChangePercent ?? null,
        pe: q.trailingPE ?? q.forwardPE ?? null,
        marketCap: q.marketCap ?? null,
        volume: q.regularMarketVolume ?? null,
        avgVolume: q.averageDailyVolume3Month ?? null,
        week52High: q.fiftyTwoWeekHigh ?? null,
        week52Low: q.fiftyTwoWeekLow ?? null,
        sector: q.sector ?? null,
        exchange: q.exchange ?? null,
      };
    });
  });

  const universe = Object.values(pool);
  if (universe.length > 0) yfCacheSet(cacheKey, universe, 5 * 60 * 1000);
  return universe;
}

// ── Global snapshot — VIX, 10Y, DXY, Gold, Oil, BTC ─────────────────────────
export async function fetchGlobalSnapshot() {
  const symbols = ['^VIX', '^TNX', 'DX-Y.NYB', 'GC=F', 'CL=F', 'BTC-USD'];
  return fetchYFQuotesLive(symbols);
}

// ── RSI batch — lazy fetch for screener RSI filter ──────────────────────────
export async function fetchRSIBatch(symbols, period = 14) {
  const results = await Promise.allSettled(
    symbols.slice(0, 50).map(async sym => {
      const data = await yfFetch(`/v8/finance/chart/${encodeURIComponent(sym)}`, {
        interval: '1d', range: '1mo', includePrePost: 'false',
      });
      const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(c => c != null);
      if (!closes || closes.length < period + 1) return { symbol: sym, rsi: null };

      const gains = [], losses = [];
      for (let i = 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? -diff : 0);
      }
      let avgGain = gains.slice(0, period).reduce((s, x) => s + x, 0) / period;
      let avgLoss = losses.slice(0, period).reduce((s, x) => s + x, 0) / period;
      for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      }
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      return { symbol: sym, rsi: Math.round(rsi * 100) / 100 };
    })
  );

  const rsiMap = {};
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value) rsiMap[r.value.symbol] = r.value.rsi;
  });
  return rsiMap;
}
