# PersonalTerminal

**A full-featured Bloomberg Terminal clone built entirely in React — 9,700+ lines of hand-written code, zero UI libraries, zero charting dependencies.**

Real-time market data, interactive charts, macro economics, global news intelligence, and quantitative research — all in a single-page app that looks and feels like the $25,000/year terminal, running free on `localhost`.

![Bloomberg Terminal Clone](https://img.shields.io/badge/REAC

T-18.2-61dafb?style=flat-square&logo=react) ![Lines of Code](https://img.shields.io/badge/LOC-9700+-ff8c00?style=flat-square) ![License](https://img.shields.io/badge/LICENSE-AGPL--3.0-green?style=flat-square) ![APIs](https://img.shields.io/badge/APIs-5%20LIVE%20FEEDS-cc0000?style=flat-square)

---

## What It Does

This is a real-time financial intelligence platform that replicates the core Bloomberg Terminal experience in the browser. It pulls live data from 5 different APIs, renders everything with custom-built SVG charts (no D3, no Chart.js, no Recharts), and runs entirely client-side with a lightweight proxy layer for CORS.

**It's not a mockup. Every number is real. Every chart is interactive. Every feed is live.**

---

## Features

### Market Data & Charts
- **Interactive Candlestick Charts** — OHLCV with click-drag zoom, crosshair tooltips, and range selection (1M to 2Y)
- **Technical Indicators** — SMA(20/50), EMA(20), Bollinger Bands, RSI — all computed client-side
- **Multi-Ticker Overlay** — Normalize and compare up to 8 tickers on a single rebased chart
- **Sector Heatmap** — S&P 500 treemap across 11 SPDR sectors with custom recursive layout algorithm
- **Correlation Matrix** — NxN Pearson correlation heatmap with rolling correlation time-series drill-down
- **Top Movers** — Live gainers, losers, and most-active with auto-refresh
- **World Equity Indices** — 18+ global indices (Dow, S&P, FTSE, Nikkei, Hang Seng, etc.) grouped by region

### Watchlist & Quotes
- **Live Watchlist Sidebar** — Add/remove tickers, real-time price updates, click to drill into any stock
- **Quote Bar** — Price, change, open, high, low, volume, market cap, P/E, EPS, 52-week range
- **Peer Comparison Tables** — Auto-detected peers with YoY/QoQ/MoM growth metrics across configurable timeframes

### Macro Economics
- **FRED Dashboard** — 12 Federal Reserve series (GDP, CPI, unemployment, fed funds rate, retail sales, consumer sentiment, and more) with sparklines and period-over-period deltas
- **Live Yield Curve** — Interactive 1M-to-30Y treasury yield curve with real-time inversion detection

### News & Intelligence
- **Live News Ticker** — Auto-scrolling headline bar from Google News RSS, pause on hover
- **News Wire** — Full article feed with publisher attribution, relative timestamps, related tickers, and text-to-speech (TTS)
- **Geo Intelligence** — Aggregated RSS feeds from global sources across every major region (Americas, EMEA, Asia-Pacific, Middle East, Africa), with source filtering and search
- **Google News Search** — Full-text search across global news within the Geo Intel panel

### Research
- **Quant Finance Library** — Live search across arXiv and Semantic Scholar with curated reading list
- **Paper Viewer** — Featured paper display with abstract, authors, citations, PDF links, and Google Scholar links
- **Project Ideas** — Curated quant finance project ideas with difficulty levels and tech stack tags

### Earnings & Fundamentals
- **Earnings Calendar** — Next earnings dates for any ticker and its peers, with EPS estimates and confirmation status

### Export
- **One-Click CSV Export** — Every single panel supports CSV export: price history, quotes, alt data, news, research, macro data, correlation matrices, and more

---

## Architecture

```
src/
├── App.js                    # Main app — state management, data orchestration
├── components/
│   ├── TopBanner.js          # Header, tabs, search, clock, export
│   ├── PriceChart.js         # Custom SVG candlestick/line chart engine
│   ├── OverlayChart.js       # Multi-ticker normalized comparison chart
│   ├── SectorHeatmap.js      # Custom recursive treemap (no D3)
│   ├── CorrelationMatrix.js  # NxN heatmap + rolling correlation
│   ├── MacroDashboard.js     # FRED macro dashboard + yield curve
│   ├── GeoIntelligencePanel.js # Global RSS intelligence feed
│   ├── ResearchReading.js    # arXiv + Semantic Scholar search
│   ├── WatchlistSidebar.js   # Live watchlist with prices
│   ├── NewsWire.js           # News feed with TTS
│   ├── NewsTicker.js         # Scrolling headline ticker
│   ├── ComparisonTable.js    # Peer growth comparison
│   ├── AltDataTable.js       # Alternative data metrics
│   ├── EarningsCalendar.js   # Earnings dates + EPS
│   ├── TopMovers.js          # Gainers/losers/most active
│   ├── WorldEquityIndices.js # 18+ global indices
│   ├── ExportPanel.js        # CSV export manager
│   └── ProjectIdeas.js       # Curated project ideas
├── hooks/
│   ├── useYahooFinance.js    # Yahoo Finance data layer (primary)
│   ├── usePolygonAPI.js      # Polygon.io data layer (optional upgrade)
│   └── useFred.js            # Federal Reserve (FRED) data layer
├── data/
│   ├── geoFeeds.js           # Global RSS feed catalog
│   ├── papers.js             # Curated research papers
│   ├── peerMap.js            # Ticker → peer group mapping
│   ├── macroEvents.js        # Macro event calendar
│   └── projects.js           # Project ideas database
├── utils/
│   ├── indicators.js         # SMA, EMA, Bollinger, RSI
│   ├── csvExport.js          # CSV generation + download
│   ├── marketHours.js        # NYSE market hours detection
│   ├── rateLimiter.js        # API rate limit handling
│   ├── cache.js              # In-memory TTL cache
│   └── formatting.js         # Number/currency formatting
├── context/
│   └── ExportContext.js       # Global CSV export registry
└── setupProxy.js             # Dev-server proxy (Yahoo, arXiv, FRED, etc.)
```

---

## Data Sources

| Source | What It Powers | Auth Required |
|--------|---------------|---------------|
| **Yahoo Finance** | Quotes, charts, earnings, indices, top movers, sector data | No (free, proxied) |
| **Polygon.io** | News, technicals, ticker search, company details | Optional (free tier) |
| **FRED (St. Louis Fed)** | Macro series, yield curve | Optional (free key) |
| **arXiv** | Quantitative finance research papers | No (free, proxied) |
| **Semantic Scholar** | Academic paper search + citation data | No (free, proxied) |
| **Google News RSS** | Live news headlines, geo intelligence | No (free, proxied) |

---

## Quick Start

```bash
# Clone
git clone https://github.com/sinhaarya04/PersonalTerminal.git
cd PersonalTerminal

# Install
npm install

# Run
npm start
```

Open [http://localhost:3000](http://localhost:3000). That's it. No API keys needed for the base experience.

### Optional: Upgrade with API Keys

For additional features (news, technicals, macro data), add API keys through the in-app UI:

- **Polygon.io** — Free tier at [polygon.io](https://polygon.io) → adds news feed + technical indicators + ticker search
- **FRED** — Free key at [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) → enables the macro economics dashboard

---

## Technical Highlights

- **Zero charting libraries** — Every chart (candlestick, line, treemap, heatmap, sparkline, yield curve) is hand-built SVG
- **Zero UI component libraries** — All styling is inline JS objects, Bloomberg-authentic dark theme
- **5 API proxy routes** — CRA `setupProxy.js` handles CORS for Yahoo Finance, Polygon, FRED, arXiv, Semantic Scholar, and Google News
- **Client-side technical analysis** — SMA, EMA, Bollinger Bands, RSI, Pearson correlation, log-returns — all computed in-browser
- **Smart caching** — Multi-tier TTL cache (5s–60min) across all data layers to stay within free API rate limits
- **Text-to-Speech** — News wire can read headlines aloud via the Web Speech API
- **CSV export everywhere** — Global export registry pattern lets every panel register its data for one-click CSV download

---

## Built By

**Aryan Sinha** — Northeastern University, Class of 2027

---

## License

[AGPL-3.0](LICENSE) — Free to use, modify, and distribute. If you deploy a modified version, you must open-source your changes.
