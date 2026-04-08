import React, { useState, useEffect, useCallback, useRef } from 'react';
import TopBanner from './components/TopBanner';
import WorldEquityIndices from './components/WorldEquityIndices';
import AltDataTable from './components/AltDataTable';
import ComparisonTable from './components/ComparisonTable';
import NewsWire from './components/NewsWire';
import ResearchReading from './components/ResearchReading';
import ProjectIdeas from './components/ProjectIdeas';
import GeoIntelligencePanel from './components/GeoIntelligencePanel';
import MacroDashboard from './components/MacroDashboard';
import CorrelationMatrix from './components/CorrelationMatrix';
import SectorHeatmap from './components/SectorHeatmap';
import OverlayChart from './components/OverlayChart';
import NewsTicker from './components/NewsTicker';
import TopMovers from './components/TopMovers';
import EarningsCalendar from './components/EarningsCalendar';
import WatchlistSidebar from './components/WatchlistSidebar';
import { setRateLimitCallback } from './utils/rateLimiter';
import { isMarketOpen } from './utils/marketHours';
import PriceChart from './components/PriceChart';
import {
  fetchYFChart,
  fetchYFQuotes,
  fetchYFQuotesLive,
} from './hooks/useYahooFinance';
import { getDefaultPeers } from './data/peerMap';
import { MACRO_EVENTS } from './data/macroEvents';
import { useExport } from './context/ExportContext';
import { exportCSV } from './utils/csvExport';
import { TradingProvider } from './context/TradingContext';
import PaperTrading from './components/PaperTrading';
import GlossaryPanel from './components/GlossaryPanel';
import StockScreener from './components/StockScreener';

const S = {
  app: {
    background: '#000000',
    minHeight: '100vh',
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
  },
  apiSetup: {
    background: '#0d0d1a',
    border: '1px solid #ff8c00',
    margin: '8px',
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  apiLabel: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
  apiInput: {
    flex: 1,
    minWidth: '200px',
    background: '#000000',
    color: '#ffcc00',
    border: '1px solid #333333',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    padding: '3px 8px',
    outline: 'none',
    letterSpacing: '1px',
  },
  apiBtn: {
    background: '#ff8c00',
    color: '#000000',
    border: 'none',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    fontWeight: 'bold',
    padding: '3px 14px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  },
  apiHint: {
    color: '#555555',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
  },
  statusBar: {
    background: '#0d0d1a',
    borderTop: '1px solid #222222',
    padding: '2px 8px',
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statusItem: {
    color: '#666666',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
  },
  statusVal: { color: '#b0b0b0', marginLeft: '4px' },
  loading: {
    padding: '20px',
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
  },
};


// ── Helpers ──────────────────────────────────────────────────────────────────

function avgClose(bars) {
  const v = bars.map(b => b.c).filter(x => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

function computePop(bars, days) {
  const recent = bars.slice(-days);
  const prior = bars.slice(-days * 2, -days);
  const r = avgClose(recent), p = avgClose(prior);
  if (!r || !p) return null;
  return ((r - p) / p) * 100;
}

function computeYoY(bars, days) {
  // YoY: last N trading days vs same N days ~1 year ago (252 sessions)
  if (bars.length < days + 252) return computePop(bars, days); // fallback to pop
  const recent = bars.slice(-days);
  const yearAgo = bars.slice(-(days + 252), -252);
  const r = avgClose(recent), p = avgClose(yearAgo.slice(-days));
  if (!r || !p) return null;
  return ((r - p) / p) * 100;
}

// Build AltDataTable metrics from price bars
function buildMetricsFromBars(bars) {
  const d91 = 63, d28 = 20, d7 = 5; // trading day approximations

  return [
    {
      id: 'price_mom',
      label: 'Price Momentum',
      yoy91: computeYoY(bars, d91), yoy28: computeYoY(bars, d28), yoy7: computeYoY(bars, d7),
      pop91: computePop(bars, d91), pop28: computePop(bars, d28), pop7: computePop(bars, d7),
    },
    {
      id: 'short_term',
      label: 'Short-Term Trend',
      yoy91: computePop(bars, d91), yoy28: computePop(bars, d28), yoy7: computePop(bars, d7),
      pop91: computePop(bars, Math.floor(d91 / 2)),
      pop28: computePop(bars, Math.floor(d28 / 2)),
      pop7:  computePop(bars, Math.floor(d7 / 2)),
    },
  ];
}

// Build quote object from YF quote result + chart bars
function buildQuote(sym, yfQuote, bars) {
  if (yfQuote) {
    return {
      ticker: sym,
      name: yfQuote.longName || yfQuote.shortName || sym,
      price: yfQuote.regularMarketPrice ?? 0,
      change: yfQuote.regularMarketChange ?? 0,
      pctChange: yfQuote.regularMarketChangePercent ?? 0,
      open: yfQuote.regularMarketOpen ?? 0,
      high: yfQuote.regularMarketDayHigh ?? 0,
      low: yfQuote.regularMarketDayLow ?? 0,
      volume: yfQuote.regularMarketVolume ?? 0,
      avgVolume: yfQuote.averageDailyVolume3Month ?? 0,
      mktCap: yfQuote.marketCap ?? 0,
      pe: yfQuote.trailingPE ?? 0,
      eps: yfQuote.epsTrailingTwelveMonths ?? 0,
      week52High: yfQuote.fiftyTwoWeekHigh ?? (bars ? Math.max(...bars.map(b => b.h ?? 0)) : 0),
      week52Low:  yfQuote.fiftyTwoWeekLow  ?? (bars ? Math.min(...bars.map(b => b.l ?? Infinity)) : 0),
    };
  }

  if (bars && bars.length > 0) {
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2] || last;
    const change = last.c - prev.c;
    return {
      ticker: sym,
      name: sym,
      price: last.c,
      change,
      pctChange: (change / prev.c) * 100,
      open: last.o,
      high: last.h,
      low: last.l,
      volume: last.v,
      avgVolume: Math.round(bars.reduce((s, b) => s + (b.v || 0), 0) / bars.length),
      mktCap: 0,
      pe: 0,
      eps: 0,
      week52High: Math.max(...bars.map(b => b.h ?? 0)),
      week52Low:  Math.min(...bars.map(b => b.l ?? Infinity)),
    };
  }

  return null; // no data available
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [polygonKey, setPolygonKey] = useState(
    process.env.REACT_APP_POLYGON_API_KEY || localStorage.getItem('poly_api_key') || ''
  );
  const [keyInput, setKeyInput] = useState('');
  const [showKeyBar, setShowKeyBar] = useState(!polygonKey);

  const [fredKey, setFredKey] = useState(
    localStorage.getItem('fred_api_key') || ''
  );

  const [activeTab, setActiveTab]   = useState('OVERVIEW');
  const [ticker, setTicker]         = useState('SPY');
  const [isRateLimited, setIsRateLimited] = useState(false);

  const [altData, setAltData]       = useState(null);
  const [quoteData, setQuoteData]   = useState(null);
  const [chartBars, setChartBars]   = useState(null);
  const [dataSource, setDataSource] = useState('DEMO');
  const [loadingTicker, setLoadingTicker] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // ── Watchlist state ──────────────────────────────────────────────────────
  const DEFAULT_WATCHLIST = [
    { symbol: 'SPY' }, { symbol: 'AAPL' }, { symbol: 'MSFT' },
    { symbol: 'GOOG' }, { symbol: 'AMZN' }, { symbol: 'TSLA' },
  ];
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem('watchlist');
      if (saved) {
        const syms = JSON.parse(saved);
        return syms.map(s => (typeof s === 'string' ? { symbol: s } : s));
      }
    } catch { /* ignore */ }
    return DEFAULT_WATCHLIST;
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;

  // Persist watchlist symbols to localStorage
  useEffect(() => {
    localStorage.setItem('watchlist', JSON.stringify(watchlist.map(w => w.symbol)));
  }, [watchlist]);

  const fetchAllQuotesRef = useRef(null);
  const handleAddToWatchlist = useCallback((sym) => {
    setWatchlist(prev => {
      if (prev.some(w => w.symbol === sym)) return prev;
      return [...prev, { symbol: sym }];
    });
    // Fetch quotes immediately so the new ticker doesn't sit blank
    setTimeout(() => fetchAllQuotesRef.current?.(), 200);
  }, []);

  const handleRemoveFromWatchlist = useCallback((sym) => {
    setWatchlist(prev => prev.filter(w => w.symbol !== sym));
  }, []);

  useEffect(() => { setRateLimitCallback(setIsRateLimited); }, []);

  // ── Register App-owned data for CSV export ────────────────────────────────
  const { register, unregister } = useExport();
  const tickerRef = useRef(ticker);
  tickerRef.current = ticker;

  const isChartTab = activeTab === 'INFLECTION';

  useEffect(() => {
    if (!isChartTab) {
      unregister('PRICE_HISTORY');
      unregister('QUOTE_SNAPSHOT');
      unregister('ALT_DATA');
      return;
    }
    const date = new Date().toISOString().split('T')[0];
    if (chartBars && chartBars.length > 0) {
      register('PRICE_HISTORY', 'Price History (OHLCV)', () => {
        const rows = chartBars.map(b => ({
          date: new Date(b.t).toISOString().split('T')[0],
          open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v,
        }));
        exportCSV(rows, `${tickerRef.current}_price_history_${date}.csv`);
      });
    }
    if (quoteData) {
      register('QUOTE_SNAPSHOT', 'Quote Snapshot', () => {
        exportCSV([quoteData], `${tickerRef.current}_quote_${date}.csv`);
      });
    }
    if (altData?.metrics?.length > 0) {
      register('ALT_DATA', 'Alt Data Metrics', () => {
        const rows = altData.metrics.map(m => ({
          metric: m.label, yoy_91d: m.yoy91, yoy_28d: m.yoy28, yoy_7d: m.yoy7,
          pop_91d: m.pop91, pop_28d: m.pop28, pop_7d: m.pop7,
        }));
        exportCSV(rows, `${tickerRef.current}_alt_metrics_${date}.csv`);
      });
    }
  }, [isChartTab, chartBars, quoteData, altData, register, unregister]);

  const savePolygonKey = () => {
    const k = keyInput.trim();
    if (!k) return;
    setPolygonKey(k);
    localStorage.setItem('poly_api_key', k);
    setShowKeyBar(false);
  };

  // ── Fetch ticker data — Yahoo first, Polygon upgrade ──────────────────────
  const fetchTickerData = useCallback(async (sym) => {
    setLoadingTicker(true);
    setAltData(null);
    setQuoteData(null);
    setChartBars(null);

    const today = new Date();
    const fmt = d => d.toISOString().split('T')[0];

    // ── 1. Try Yahoo Finance (always available) ───────────────────────────
    let yfQuoteObj = null;
    let bars = null;
    let source = '';

    try {
      const [chartResult, quoteResult] = await Promise.allSettled([
        fetchYFChart(sym, '2y', '1d'),
        fetchYFQuotes([sym]),
      ]);

      if (chartResult.status === 'fulfilled' && chartResult.value?.bars?.length > 0) {
        bars = chartResult.value.bars;
        setChartBars(bars);
        source = 'YAHOO';
      }

      if (quoteResult.status === 'fulfilled' && quoteResult.value?.length > 0) {
        yfQuoteObj = quoteResult.value[0];
        source = 'YAHOO';
      }
    } catch { /* fall through to Polygon or demo */ }

    // ── 2. Upgrade with Polygon if key is set ────────────────────────────
    if (polygonKey) {
      try {
        const from = new Date(today);
        from.setFullYear(from.getFullYear() - 2);

        const [detailsRes, aggsRes] = await Promise.allSettled([
          fetch(`https://api.polygon.io/v3/reference/tickers/${sym}?apiKey=${polygonKey}`),
          fetch(`https://api.polygon.io/v2/aggs/ticker/${sym}/range/1/day/${fmt(from)}/${fmt(today)}?adjusted=true&limit=500&apiKey=${polygonKey}`),
        ]);

        let polyName = null;
        if (detailsRes.status === 'fulfilled') {
          const d = await detailsRes.value.json();
          polyName = d?.results?.name || null;
        }

        if (aggsRes.status === 'fulfilled') {
          const d = await aggsRes.value.json();
          if (d?.results?.length > 0) {
            bars = d.results.map(b => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));
            setChartBars(bars);
            if (polyName && yfQuoteObj) yfQuoteObj = { ...yfQuoteObj, longName: polyName };
            source = 'POLYGON';
          }
        }
      } catch { /* keep Yahoo data */ }
    }

    // ── 3. Build quote + alt data from whatever we got ────────────────────
    const quote = buildQuote(sym, yfQuoteObj, bars);
    const metrics = bars && bars.length > 10 ? buildMetricsFromBars(bars) : [];

    setQuoteData(quote);
    if (quote) {
      setAltData({
        ticker: sym,
        name: quote.name,
        dataDate: fmt(today),
        about: { source: source === 'POLYGON' ? 'Polygon.io' : 'Yahoo Finance', panelSize: 'N/A', geo: 'US', cardType: 'Price Data' },
        metrics,
      });
    }
    setDataSource(source);
    setLoadingTicker(false);
  }, [polygonKey]);

  const handleTickerChange = useCallback((sym) => {
    setTicker(sym);
    setActiveTab('INFLECTION');
    fetchTickerData(sym);
  }, [fetchTickerData]);

  const handleSetFredKey = useCallback((k) => {
    setFredKey(k);
    localStorage.setItem('fred_api_key', k);
  }, []);

  // Fetch initial ticker on mount
  useEffect(() => { fetchTickerData('SPY'); }, []); // eslint-disable-line

  // ── Fetch watchlist + main ticker quotes ──────────────────────────────────
  const tickerForPoll = useRef(ticker);
  tickerForPoll.current = ticker;

  const fetchAllQuotes = useCallback(async () => {
    try {
      const wlSymbols = watchlistRef.current.map(w => w.symbol);
      const allSymbols = [tickerForPoll.current, ...wlSymbols.filter(s => s !== tickerForPoll.current)];
      const quotes = await fetchYFQuotesLive(allSymbols);
      const bySymbol = {};
      quotes.forEach(q => { bySymbol[q.symbol] = q; });

      // Update main ticker quote
      const mainQ = bySymbol[tickerForPoll.current];
      if (mainQ) {
        setQuoteData(prev => prev ? {
          ...prev,
          price: mainQ.regularMarketPrice ?? prev.price,
          change: mainQ.regularMarketChange ?? prev.change,
          pctChange: mainQ.regularMarketChangePercent ?? prev.pctChange,
          volume: mainQ.regularMarketVolume ?? prev.volume,
          high: mainQ.regularMarketDayHigh ?? prev.high,
          low: mainQ.regularMarketDayLow ?? prev.low,
        } : prev);
      }

      // Update watchlist prices
      setWatchlist(prev => prev.map(w => {
        const q = bySymbol[w.symbol];
        if (!q) return w;
        return {
          ...w,
          price: q.regularMarketPrice,
          change: q.regularMarketChange,
          pctChange: q.regularMarketChangePercent,
        };
      }));

      setIsLive(isMarketOpen());
    } catch {
      setIsLive(false);
    }
  }, []);

  fetchAllQuotesRef.current = fetchAllQuotes;

  // Always fetch once on mount to populate watchlist prices
  useEffect(() => {
    fetchAllQuotes();
  }, [fetchAllQuotes]);

  // Poll every 30s during market hours
  useEffect(() => {
    const id = setInterval(() => {
      if (isMarketOpen()) fetchAllQuotes();
    }, 30000);
    return () => clearInterval(id);
  }, [fetchAllQuotes]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const renderMain = () => {
    if (activeTab === 'OVERVIEW') {
      return (
        <div>
          <WorldEquityIndices />
          <TopMovers onTickerChange={handleTickerChange} />
        </div>
      );
    }

    if (activeTab === 'INFLECTION') {
      if (loadingTicker) {
        return (
          <div style={S.loading}>
            FETCHING {ticker} FROM {polygonKey ? 'POLYGON.IO' : 'YAHOO FINANCE'}...
          </div>
        );
      }
      return (
        <div>
          <PriceChart bars={chartBars} ticker={ticker} quote={quoteData} events={MACRO_EVENTS} />
          <AltDataTable
            data={altData}
            quote={quoteData}
            ticker={ticker}
            dataSource={dataSource}
          />
          <EarningsCalendar ticker={ticker} peers={getDefaultPeers(ticker)} />
        </div>
      );
    }

    if (activeTab === 'KPI CORRELATION') {
      if (loadingTicker) {
        return (
          <div style={S.loading}>
            FETCHING {ticker} FROM {polygonKey ? 'POLYGON.IO' : 'YAHOO FINANCE'}...
          </div>
        );
      }
      return <CorrelationMatrix ticker={ticker} allBars={chartBars} />;
    }

    if (activeTab === 'TREND ANALYSIS') return <ComparisonTable ticker={ticker} allBars={chartBars} />;
    if (activeTab === 'OVERLAY')        return <OverlayChart defaultTicker={ticker} />;
    if (activeTab === 'HEATMAP')        return <SectorHeatmap />;
    if (activeTab === 'MACRO ECON')     return <MacroDashboard fredKey={fredKey} onSetFredKey={handleSetFredKey} />;
    if (activeTab === 'GEO INTEL')      return <GeoIntelligencePanel />;
    if (activeTab === 'NEWS')           return <NewsWire polygonKey={polygonKey} ticker={ticker} />;
    if (activeTab === 'RESEARCH')       return <ResearchReading />;
    if (activeTab === 'PROJECTS')       return <ProjectIdeas />;
    if (activeTab === 'SCREENER')       return <StockScreener onTickerChange={handleTickerChange} />;
    if (activeTab === 'PAPER TRADE')    return <PaperTrading ticker={ticker} quoteData={quoteData} onTickerChange={handleTickerChange} />;
    if (activeTab === 'GLOSSARY')       return <GlossaryPanel />;

    return <WorldEquityIndices />;
  };


  const dataSourceLabel = dataSource === 'POLYGON'
    ? 'POLYGON.IO'
    : dataSource === 'YAHOO'
    ? 'YAHOO FINANCE'
    : loadingTicker ? 'LOADING...' : 'NO DATA';

  const dataSourceColor = dataSource === 'POLYGON'
    ? '#ff8c00'
    : dataSource === 'YAHOO'
    ? '#00cc00'
    : '#555555';

  return (
    <TradingProvider>
    <div style={S.app}>
      <TopBanner
        ticker={ticker}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onTickerChange={handleTickerChange}
        apiKey={polygonKey}
        isRateLimited={isRateLimited}
        isLive={isLive}
      />

      {/* Live scrolling news ticker */}
      <NewsTicker ticker={ticker} />

      {/* Polygon key upgrade bar */}
      {showKeyBar && (
        <div style={S.apiSetup}>
          <span style={S.apiLabel}>POLYGON API KEY (OPTIONAL):</span>
          <input
            style={S.apiInput}
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && savePolygonKey()}
            placeholder="PASTE POLYGON.IO KEY FOR NEWS + TECHNICALS..."
            spellCheck={false}
          />
          <button style={S.apiBtn} onClick={savePolygonKey}>CONNECT</button>
          <button
            style={{ ...S.apiBtn, background: '#222222', color: '#888888' }}
            onClick={() => setShowKeyBar(false)}
          >
            CLOSE
          </button>
          <span style={S.apiHint}>
            FREE TIER: yahoo finance (always on) · polygon adds news + technicals
          </span>
        </div>
      )}

      {/* Main content with sidebar */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
        <WatchlistSidebar
          watchlist={watchlist}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(v => !v)}
          onTickerChange={handleTickerChange}
          onAdd={handleAddToWatchlist}
          onRemove={handleRemoveFromWatchlist}
          activeTicker={ticker}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          {renderMain()}
        </div>
      </div>

      {/* Status bar */}
      <div style={S.statusBar}>
        <span style={S.statusItem}>BLOOMBERG TERMINAL CLONE <span style={S.statusVal}>v1.0</span></span>
        <span style={S.statusItem}>
          TICKER: <span style={{ ...S.statusVal, color: '#ffcc00' }}>{ticker}</span>
        </span>
        <span style={S.statusItem}>
          DATA: <span style={{ ...S.statusVal, color: dataSourceColor }}>{dataSourceLabel}</span>
        </span>
        {!polygonKey && (
          <span style={{ ...S.statusItem, color: '#555555' }}>
            · ADD POLYGON KEY FOR NEWS &amp; TECHNICALS
          </span>
        )}
        {isRateLimited && (
          <span style={{ ...S.statusItem, color: '#ff8c00' }}>⚠ RATE LIMITED — CACHED DATA</span>
        )}
        <span style={{ ...S.statusItem, marginLeft: 'auto' }}>
          ARYAN SINHA · NEU · CLASS OF 2027
        </span>
      </div>
    </div>
    </TradingProvider>
  );
}
