# Bloomberg Terminal Clone — Development Session Log

**Project:** PersonalTerminal
**Author:** Aryan Sinha
**Stack:** React 18 · Vanilla SVG · Supabase · 5 Live APIs
**Lines of Code:** ~12,000+

---

## What We Built

A full Bloomberg Terminal replica that runs in the browser — real-time market data, interactive charts, macro economics, global news intelligence, paper trading, and quantitative research. Every chart is hand-built SVG. Every number is live. No charting libraries, no UI frameworks.

---

## Session Progression

### Phase 1: Foundation & Auth

Started with the scaffolding — a React app with a simple session-based auth system (`AuthContext`). Email + university login stored in `sessionStorage`. Lightweight by design — this is a demo tool, not a bank.

Set up the context provider hierarchy early:
```
AuthProvider → ExportProvider → App → TradingProvider
```

This layering let us add features modularly without refactoring the root. Each context owns exactly one concern.

### Phase 2: Data Layer — Dual Source Strategy

The biggest architectural decision: **Yahoo Finance as primary, Polygon.io as optional premium.**

Built `useYahooFinance.js` (419 lines) as the core data hook. Yahoo is free and reliable, but CORS-blocked — so we wrote a CRA dev-server proxy (`setupProxy.js`) to route all requests through localhost. Six proxy routes total:

| Route | Target | Purpose |
|-------|--------|---------|
| `/yf` | Yahoo Finance | Quotes, charts, earnings, screeners |
| `/gnews` | Google News | Live headlines |
| `/arxiv` | arXiv | Research papers |
| `/semscholar` | Semantic Scholar | Citation data |
| `/fred` | St. Louis Fed | Macro economics |
| `/rssproxy` | Custom handler | Universal RSS fetch with redirect following |

Added in-memory caching with TTL — 5 min for charts, 20s for live quotes, 1 hour for macro data. This kept us well within free API rate limits while feeling responsive.

For Polygon.io, built `usePolygonAPI.js` and a client-side rate limiter (`rateLimiter.js`) that queues requests with 12-second spacing to stay within the 5-req/min free tier. The UI shows a rate-limit badge when throttling kicks in.

**Key decision:** Try both sources in parallel. If Polygon key exists, its data upgrades the Yahoo baseline. No Polygon key? Everything still works. Zero hard dependencies on paid APIs.

### Phase 3: The Chart Engine — 42,000 Lines of SVG

This was the heart of the project. `PriceChart.js` is a professional-grade candlestick chart built entirely with SVG — no D3, no Chart.js, no Recharts.

Features we built into it:
- **Candlestick & OHLC bar rendering** with proper wick/body calculation
- **Click-drag zoom** with rubber-band preview
- **Crosshair tooltip** showing OHLCV + all active indicator values
- **Technical indicators:** SMA(20/50), EMA(20), Bollinger Bands, RSI, VWAP — all computed client-side in `indicators.js`
- **Drawing tools:** Trendlines, horizontal lines, Fibonacci retracements — with save/load to Supabase (localStorage fallback)
- **Macro event overlays:** FOMC meetings and CPI releases marked on the x-axis
- **Interval switching:** 15m, 30m, 1h, 1d with context-aware range selection
- **Fullscreen mode** via `FullscreenChart.js`

The data pipeline:
```
fetchYFChart(ticker, '2y', '1d')
  → bars [{t, o, h, l, c, v}]
  → range filter (1M to 2Y)
  → zoom slice (drag selection)
  → indicator computation
  → SVG render
```

**Why no charting library?** Bundle size, full control over interactivity, and the learning experience. Trade-off was code volume — PriceChart alone is massive. But every pixel is ours.

### Phase 4: Analysis Modules

Built 9 major analysis panels, each accessible via the tab system:

**OverlayChart** (23,720 lines) — Normalize and compare up to 8 tickers on a single rebased chart. Each line is percentage-change-from-start, so you can compare AAPL vs TSLA vs SPY on the same scale.

**SectorHeatmap** (15,392 lines) — Custom recursive treemap of S&P 500 SPDR sectors. Weighted by index allocation, colored by daily change. No D3 treemap — wrote our own rectangle-packing algorithm.

**CorrelationMatrix** (24,429 lines) — NxN Pearson correlation heatmap with rolling windows (20/30/60 day). Drill down into any cell to see the rolling correlation time series. Uses log returns for accuracy.

**ComparisonTable** (10,452 lines) — Peer group comparison with YoY/QoQ/MoM growth metrics across configurable timeframes.

**AltDataTable** (12,810 lines) — 2-column layout with metrics (price momentum over 91/28/7 day windows) and trend analysis (ACCELERATING/DECELERATING based on short vs long window comparison).

**StockScreener** (30,886 lines) — Advanced filtering system. 4 presets (VALUE, MOMENTUM, OVERSOLD, TECH), customizable filters for P/E, market cap buckets, volume, RSI, and sector. Assembles a 500+ stock universe from 8 Yahoo screener endpoints, dedupes, then filters client-side. RSI is lazy-loaded in batches of 50 to reduce latency.

### Phase 5: Macro, News & Research

**MacroDashboard** (19,536 lines) — Pulls 13 FRED series (GDP, CPI, unemployment, fed funds rate, treasury yields, retail sales, consumer sentiment). Sparklines for each metric. Interactive yield curve with inversion detection. Requires a FRED API key.

**GeoIntelligencePanel** (19,780 lines) — RSS feeds from 10+ regions. 3-tier fetch strategy: local proxy → allorigins.win → corsproxy.io fallback. DOM parser handles both RSS 2.0 and Atom feeds. 5-min cache per feed.

**NewsWire** (9,769 lines) — Polygon.io news if key provided, otherwise demo data. **NewsTicker** (165 lines) — Smooth scrolling marquee using `requestAnimationFrame`, pauses on hover.

**ResearchReading** (26,380 lines) — Search arXiv and Semantic Scholar for quant finance papers. XML parser strips namespaces for arXiv. Handles Semantic Scholar's 429 rate limits with 1.5s retry. 12 suggested search topics. Paper cards show title, authors, abstract, citation count, PDF links.

### Phase 6: Paper Trading & Leaderboard

**TradingContext** (243 lines) — Redux-style reducer managing $100k starting capital, positions, transactions, and portfolio history. Persists to localStorage per user with version migration.

**PaperTrading** orchestrates 4 sub-components:
- **TradingPanel** (7,114 lines) — Buy/sell form with real-time validation
- **PortfolioView** (6,077 lines) — Holdings table with unrealized P&L
- **PerformanceChart** (7,891 lines) — Area chart of portfolio value over time
- **TransactionHistory** (4,221 lines) — Chronological trade log

**Leaderboard** (5,490 lines) — Syncs portfolio data to `/api/leaderboard` after each trade. Ranks all users by total return %. Masks emails, shows university. Highlights your own row.

### Phase 7: Polish & Export

**CSV Export Registry** — `ExportContext` lets every panel register its data for export. One-click download with 150ms stagger between files to prevent browser blocking. RFC 4180 compliant with BOM for Excel compatibility.

**Analytics** (`analytics.js`) — Event tracking with session IDs, buffered flush every 5s or 10 events. Tracks: session starts, ticker searches, tab changes, exports, trades.

**Chart Storage** (`useChartStorage.js`) — Drawings persist to Supabase API first, localStorage fallback. Auto-migrates from localStorage to API on first successful connection.

**Supabase Schema** — Tables for chart drawings, leaderboard entries, and analytics events.

**Vercel Deployment** — All proxy routes rewritten to serverless functions (`/api/yf`, `/api/gnews`, etc.). SPA fallback for client-side routing.

---

## Architecture Decisions & Why

| Decision | Why |
|----------|-----|
| No charting library | Full control, smaller bundle, learning experience |
| No UI framework | Bloomberg-authentic styling, inline JS objects |
| Yahoo Finance primary | Free, reliable, no key needed for base experience |
| In-memory caching | Stay within free API limits, instant re-renders |
| Session-based auth | Simplicity for demo context, no password management |
| Context providers over Redux | Lighter weight, sufficient for this scale |
| SVG over Canvas | DOM access for tooltips/events, easier debugging |
| Proxy over CORS headers | Can't set headers on third-party APIs |
| localStorage + Supabase | Works offline, syncs when connected |

---

## File Structure

```
src/
├── App.js                      # 768 lines — Main orchestrator
├── index.js                    # 16 lines — Root with providers
├── setupProxy.js               # 179 lines — 6 dev-server proxies
├── components/
│   ├── PriceChart.js           # Candlestick engine + drawing tools
│   ├── StockScreener.js        # Advanced stock filtering
│   ├── ResearchReading.js      # arXiv + Semantic Scholar
│   ├── CorrelationMatrix.js    # NxN heatmap + rolling correlation
│   ├── OverlayChart.js         # Multi-ticker normalized chart
│   ├── GeoIntelligencePanel.js # Global RSS intelligence
│   ├── MacroDashboard.js       # FRED macro + yield curve
│   ├── SectorHeatmap.js        # Custom treemap
│   ├── AltDataTable.js         # Price momentum metrics
│   ├── ComparisonTable.js      # Peer growth comparison
│   ├── TopMovers.js            # Gainers/losers/actives
│   ├── EarningsCalendar.js     # Earnings dates + EPS
│   ├── WorldEquityIndices.js   # 24 global indices
│   ├── NewsWire.js             # News feed
│   ├── NewsTicker.js           # Scrolling headline marquee
│   ├── GlossaryPanel.js        # Financial terms
│   ├── PaperTrading.js         # Trading simulator hub
│   ├── TradingPanel.js         # Buy/sell form
│   ├── PortfolioView.js        # Holdings table
│   ├── PerformanceChart.js     # Portfolio area chart
│   ├── TransactionHistory.js   # Trade log
│   ├── Leaderboard.js          # Ranked portfolios
│   ├── TopBanner.js            # Header + tabs + search
│   ├── WatchlistSidebar.js     # Live watchlist
│   ├── ProjectIdeas.js         # Quant project ideas
│   ├── SignInPage.js           # Auth form
│   ├── FullscreenChart.js      # Fullscreen overlay
│   ├── Tooltip.js              # Term hover definitions
│   └── ExportPanel.js          # CSV export UI
├── hooks/
│   ├── useYahooFinance.js      # 419 lines — Primary data layer
│   ├── usePolygonAPI.js        # Premium data layer
│   ├── useFred.js              # 183 lines — FRED macro data
│   └── useChartStorage.js      # 136 lines — Drawing persistence
├── data/
│   ├── geoFeeds.js             # RSS feed catalog
│   ├── papers.js               # Research paper metadata
│   ├── peerMap.js              # Ticker → peer group mapping
│   ├── macroEvents.js          # FOMC/CPI calendar
│   ├── glossary.js             # Financial terms
│   ├── projects.js             # Project ideas
│   └── demoData.js             # Offline mock data
├── utils/
│   ├── indicators.js           # SMA, EMA, Bollinger, RSI, VWAP
│   ├── csvExport.js            # RFC 4180 CSV generation
│   ├── marketHours.js          # NYSE open detection
│   ├── rateLimiter.js          # API rate limit queue
│   ├── cache.js                # In-memory TTL cache
│   └── formatting.js           # Number/currency formatting
├── context/
│   ├── AuthContext.js           # Session auth
│   ├── ExportContext.js         # CSV export registry
│   └── TradingContext.js        # Paper trading state
├── lib/
│   ├── analytics.js            # Event tracking
│   └── supabase.js             # Supabase client init
└── styles/                      # Shared style constants
```

---

## Data Sources

| Source | Free | What It Powers |
|--------|------|----------------|
| Yahoo Finance | Yes | Charts, quotes, earnings, indices, screeners, sector data |
| Polygon.io | Free tier | News, technicals, ticker search, company details |
| FRED | Free key | 13 macro series, yield curve, rate decisions |
| arXiv | Yes | Quantitative finance research papers |
| Semantic Scholar | Yes | Paper search + citation data |
| Google News RSS | Yes | Live headlines, geo intelligence |

---

## Key Numbers

- **12,000+ lines** of hand-written code
- **31 components**, 9 major analysis modules
- **5 technical indicators** computed client-side
- **24 global indices** tracked across 3 regions
- **15 tabs** in the terminal
- **$100k** paper trading starting capital
- **0 charting libraries** — pure SVG
- **0 UI libraries** — all custom styling
