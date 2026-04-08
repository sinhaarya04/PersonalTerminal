import { useState, useCallback, useRef } from 'react';
import { cacheGet, cacheSet } from '../utils/cache';
import { rateLimitedFetch } from '../utils/rateLimiter';

const BASE = 'https://api.polygon.io';

export function usePolygonAPI(apiKey) {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [lastError, setLastError] = useState(null);

  const get = useCallback(async (path, params = {}) => {
    if (!apiKey) return null;

    const qs = new URLSearchParams({ ...params, apiKey }).toString();
    const url = `${BASE}${path}?${qs}`;
    const cacheKey = url;

    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const data = await rateLimitedFetch(async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });

      if (data.status === 'OK' || data.resultsCount > 0 || data.results) {
        cacheSet(cacheKey, data);
        setLastError(null);
        return data;
      }

      return data;
    } catch (e) {
      setLastError(e.message);
      return null;
    }
  }, [apiKey]);

  // Get grouped daily bars for a date
  const getGroupedDaily = useCallback((date) => {
    return get(`/v2/aggs/grouped/locale/us/market/stocks/${date}`);
  }, [get]);

  // Get OHLCV bars for a ticker range
  const getAggs = useCallback((ticker, multiplier, timespan, from, to) => {
    return get(`/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}`, { limit: 500, adjusted: true });
  }, [get]);

  // Last trade
  const getLastTrade = useCallback((ticker) => {
    return get(`/v2/last/trade/${ticker}`);
  }, [get]);

  // News
  const getNews = useCallback((params = {}) => {
    return get('/v2/reference/news', { limit: 10, ...params });
  }, [get]);

  // Ticker details
  const getTickerDetails = useCallback((ticker) => {
    return get(`/v3/reference/tickers/${ticker}`);
  }, [get]);

  // Ticker search autocomplete
  const searchTickers = useCallback((query) => {
    return get('/v3/reference/tickers', { search: query, market: 'stocks', active: true, limit: 10 });
  }, [get]);

  // Technical indicators
  const getSMA = useCallback((ticker, window_size = 50, timespan = 'day') => {
    return get(`/v1/indicators/sma/${ticker}`, { window: window_size, timespan, series_type: 'close', limit: 50 });
  }, [get]);

  const getRSI = useCallback((ticker, window_size = 14, timespan = 'day') => {
    return get(`/v1/indicators/rsi/${ticker}`, { window: window_size, timespan, series_type: 'close', limit: 50 });
  }, [get]);

  const getEMA = useCallback((ticker, window_size = 20, timespan = 'day') => {
    return get(`/v1/indicators/ema/${ticker}`, { window: window_size, timespan, series_type: 'close', limit: 50 });
  }, [get]);

  return {
    isRateLimited,
    lastError,
    getGroupedDaily,
    getAggs,
    getLastTrade,
    getNews,
    getTickerDetails,
    searchTickers,
    getSMA,
    getRSI,
    getEMA,
  };
}
