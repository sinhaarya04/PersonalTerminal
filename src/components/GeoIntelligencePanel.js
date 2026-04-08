import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GEO_REGIONS, GEO_FEEDS } from '../data/geoFeeds';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

// ── RSS fetch strategy ───────────────────────────────────────────────────────
// Primary: local dev-server proxy at /rssproxy (no CORS issues, no third-party dependency)
// Fallback: allorigins.win, corsproxy.io (in case dev proxy isn't available)

async function fetchXML(feedUrl) {
  // 1. Local dev-server proxy (most reliable — runs on same origin)
  try {
    const res = await fetch(
      `/rssproxy?url=${encodeURIComponent(feedUrl)}`,
      { signal: AbortSignal.timeout(12000) }
    );
    if (res.ok) {
      const text = await res.text();
      if (text.length > 100) return text;
    }
  } catch { /* fall through */ }

  // 2. allorigins.win (backup)
  try {
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.contents && data.contents.length > 100) return data.contents;
    }
  } catch { /* fall through */ }

  // 3. corsproxy.io (last resort)
  try {
    const res = await fetch(
      `https://corsproxy.io/?${encodeURIComponent(feedUrl)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (res.ok) {
      const text = await res.text();
      if (text.length > 100) return text;
    }
  } catch { /* fall through */ }

  return null;
}

// Parse RSS 2.0 and Atom XML in browser
function parseRSS(xmlString, feedName) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    if (doc.querySelector('parsererror')) return [];

    const items = [...doc.querySelectorAll('item, entry')];
    return items.slice(0, 8).map((item, i) => {
      const get = (...selectors) => {
        for (const sel of selectors) {
          try {
            const el = item.querySelector(sel);
            const text = el?.textContent?.trim();
            if (text) return text;
          } catch { /* invalid selector, skip */ }
        }
        return '';
      };

      // <link> is an attribute in Atom, text in RSS
      const linkEl = item.querySelector('link');
      const link =
        linkEl?.getAttribute('href') ||
        linkEl?.textContent?.trim() ||
        get('origLink', 'feedburner\\:origLink') ||
        '';

      const rawTitle = get('title');
      // Google News RSS embeds "- Publisher Name" at end of title
      const title = rawTitle.replace(/\s+[-–]\s+[^-–]+$/, '').trim() || rawTitle;

      const pubDate =
        get('pubDate', 'published', 'updated') ||
        item.querySelector('pubDate, published, updated')?.textContent?.trim() ||
        '';

      const description = get('description', 'summary')
        .replace(/<[^>]+>/g, '')
        .trim()
        .substring(0, 220);

      const guid = get('guid', 'id') || link || `${feedName}-${i}`;

      // Try to extract publisher from Google News <source> tag
      const source = item.querySelector('source')?.textContent?.trim() || feedName;

      return {
        id: guid,
        title: title.replace(/<[^>]+>/g, '').trim(),
        source: source.toUpperCase(),
        feedSource: feedName,
        published_utc: pubDate ? (() => {
          try { return new Date(pubDate).toISOString(); } catch { return new Date().toISOString(); }
        })() : new Date().toISOString(),
        article_url: link || '#',
        description,
      };
    }).filter(item => item.title.length > 3);
  } catch {
    return [];
  }
}

async function fetchFeed(feedUrl, feedName) {
  const xml = await fetchXML(feedUrl);
  if (!xml) return [];
  return parseRSS(xml, feedName);
}

// ── Cache ────────────────────────────────────────────────────────────────────
const feedCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function cacheGet(key) {
  const e = feedCache.get(key);
  if (!e || Date.now() - e.ts > CACHE_TTL) { feedCache.delete(key); return null; }
  return e.items;
}
function cacheSet(key, items) { feedCache.set(key, { items, ts: Date.now() }); }

// ── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  return `${Math.floor(hrs / 24)}D AGO`;
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  container: { display: 'flex', background: '#000000', minHeight: '600px' },
  sidebar: { width: '130px', flexShrink: 0, borderRight: '1px solid #222222', background: '#050505', display: 'flex', flexDirection: 'column' },
  sidebarTop: {
    background: '#cc0000',
    padding: '4px 8px',
    color: '#fff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  regionBtn: (active, color) => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: active ? '#0d1a2e' : 'transparent',
    color: active ? color : '#555555',
    border: 'none',
    borderLeft: `3px solid ${active ? color : 'transparent'}`,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    padding: '5px 8px',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #0d0d0d',
  }),
  main: { flex: 1, minWidth: 0 },
  header: {
    background: '#0d0d1a',
    borderBottom: '1px solid #222222',
    padding: '4px 10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  title: (color) => ({
    color,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  }),
  rightMeta: { display: 'flex', alignItems: 'center', gap: '10px' },
  dot: (color) => ({
    display: 'inline-block', width: '6px', height: '6px',
    borderRadius: '50%', background: color, marginRight: '4px',
  }),
  statusTxt: (color) => ({
    color,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
  }),
  refreshBtn: {
    background: 'transparent',
    color: '#ff8c00',
    border: '1px solid #333333',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 8px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  },
  progressBar: (pct) => ({
    height: '2px',
    background: `linear-gradient(to right, #ff8c00 ${pct}%, #0d0d1a ${pct}%)`,
    transition: 'none',
  }),
  filterRow: {
    padding: '3px 10px',
    borderBottom: '1px solid #111111',
    background: '#030303',
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  filterLabel: {
    color: '#333333',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    marginRight: '2px',
  },
  chip: (active, color) => ({
    background: active ? '#0d1a2e' : 'transparent',
    color: active ? color : '#444444',
    border: `1px solid ${active ? color : '#1a1a1a'}`,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 5px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  }),
  item: (hover) => ({
    background: hover ? '#08101a' : '#000000',
    borderBottom: '1px solid #0a0a0a',
    padding: '6px 10px',
    cursor: 'pointer',
    display: 'block',
  }),
  itemTitle: {
    color: '#d8d8d8',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    lineHeight: '1.45',
    display: 'block',
    marginBottom: '3px',
  },
  itemDesc: {
    color: '#3a3a3a',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginBottom: '3px',
  },
  itemMeta: { display: 'flex', gap: '10px', alignItems: 'center' },
  src: (color) => ({
    color,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
  }),
  time: {
    color: '#333333',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
  },
  msgCenter: {
    padding: '30px',
    color: '#444444',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textAlign: 'center',
  },
  footer: {
    padding: '6px 10px',
    color: '#222222',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    borderTop: '1px solid #0d0d0d',
    textAlign: 'right',
  },
};

function NewsItem({ item, color }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={S.item(hover)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => item.article_url !== '#' && window.open(item.article_url, '_blank', 'noopener')}
    >
      <span style={S.itemTitle}>{item.title}</span>
      {item.description && <span style={S.itemDesc}>{item.description}</span>}
      <div style={S.itemMeta}>
        <span style={S.src(color)}>{item.source !== item.feedSource ? `${item.feedSource} / ${item.source}` : item.source}</span>
        <span style={S.time}>{relativeTime(item.published_utc)}</span>
      </div>
    </div>
  );
}

// ── Google News search via /gnews proxy ─────────────────────────────────────
async function searchGoogleNews(query, count = 20) {
  const params = new URLSearchParams({
    q: query,
    hl: 'en-US',
    gl: 'US',
    ceid: 'US:en',
  });
  const url = `/gnews/rss/search?${params}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return [];
    const text = await res.text();
    return parseRSS(text, 'SEARCH').slice(0, count);
  } catch {
    return [];
  }
}

export default function GeoIntelligencePanel() {
  const [activeRegion, setActiveRegion] = useState('global');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const abortRef = useRef(false);
  const { register, unregister } = useExport();

  const region = searchMode
    ? { id: 'search', label: `SEARCH: ${searchQuery.toUpperCase()}`, color: '#ffcc00' }
    : GEO_REGIONS.find(r => r.id === activeRegion) || GEO_REGIONS[0];
  const feeds = GEO_FEEDS[activeRegion] || [];

  const load = useCallback(async (regionId, force = false) => {
    if (!force) {
      const cached = cacheGet(regionId);
      if (cached) { setItems(cached); return; }
    } else {
      feedCache.delete(regionId);
    }

    abortRef.current = false;
    setLoading(true);
    setError(null);
    setItems([]);
    setProgress(0);
    setActiveFilters(new Set());

    const regionFeeds = GEO_FEEDS[regionId] || [];
    const all = [];

    for (let i = 0; i < regionFeeds.length; i++) {
      if (abortRef.current) break;
      const f = regionFeeds[i];
      if (i > 0) await new Promise(r => setTimeout(r, 300));
      try {
        const fetched = await fetchFeed(f.url, f.name);
        all.push(...fetched);
      } catch { /* skip */ }
      setProgress(Math.round(((i + 1) / regionFeeds.length) * 100));
    }

    if (!abortRef.current) {
      all.sort((a, b) => new Date(b.published_utc) - new Date(a.published_utc));
      const seen = new Set();
      const deduped = all.filter(item => {
        const key = item.title.toLowerCase().substring(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      cacheSet(regionId, deduped);
      setItems(deduped);
      if (deduped.length === 0) setError('All feeds failed to load — CORS proxies may be down. Try refreshing.');
    }

    setLoading(false);
    setProgress(100);
  }, []);

  const executeSearch = useCallback(async (query) => {
    if (!query.trim()) return;
    abortRef.current = false;
    setSearchMode(true);
    setLoading(true);
    setError(null);
    setItems([]);
    setProgress(0);
    setActiveFilters(new Set());

    try {
      setProgress(50);
      const results = await searchGoogleNews(query.trim(), 25);
      if (!abortRef.current) {
        setItems(results);
        setProgress(100);
        if (results.length === 0) setError('No results found — try different keywords.');
      }
    } catch {
      if (!abortRef.current) setError('Search failed — check connection.');
    }
    setLoading(false);
  }, []);

  const handleRegionClick = useCallback((regionId) => {
    setSearchMode(false);
    setActiveRegion(regionId);
  }, []);

  useEffect(() => {
    if (searchMode) return; // don't auto-load when in search mode
    abortRef.current = true; // cancel any in-flight load
    setItems([]);
    load(activeRegion);
  }, [activeRegion, load, searchMode]);

  useEffect(() => {
    if (items.length > 0) {
      register('GEO_INTEL', 'Geo Intelligence Feed', () => {
        const date = new Date().toISOString().split('T')[0];
        const rows = items.map(item => ({
          title: item.title, source: item.source, feed_source: item.feedSource,
          published_utc: item.published_utc, description: item.description || '',
          url: item.article_url || '',
        }));
        exportCSV(rows, `geo_intel_${date}.csv`);
      });
    } else {
      unregister('GEO_INTEL');
    }
    return () => unregister('GEO_INTEL');
  }, [items, register, unregister]);

  const toggleFilter = (src) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(src)) next.delete(src); else next.add(src);
      return next;
    });
  };

  const uniqueSources = [...new Set(items.map(i => i.feedSource))];
  const visible = activeFilters.size === 0 ? items : items.filter(i => activeFilters.has(i.feedSource));

  const statusColor = loading ? '#ff8c00' : error ? '#ff4444' : items.length > 0 ? '#00cc00' : '#555555';
  const statusLabel = loading ? `LOADING ${progress}%` : error ? 'ERROR' : items.length > 0 ? `LIVE · ${visible.length} ITEMS` : 'NO DATA';

  return (
    <div style={S.container}>
      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={S.sidebarTop}>GEO INTEL</div>
        {GEO_REGIONS.map(r => (
          <button
            key={r.id}
            style={S.regionBtn(!searchMode && activeRegion === r.id, r.color)}
            onClick={() => handleRegionClick(r.id)}
          >
            {!searchMode && activeRegion === r.id ? '▶ ' : '  '}{r.label}
          </button>
        ))}
        {/* Search section */}
        <div style={{
          borderTop: '1px solid #333',
          padding: '6px 6px',
          marginTop: 'auto',
        }}>
          <div style={{
            color: '#ffcc00',
            fontFamily: "'Consolas','Courier New',monospace",
            fontSize: '10px',
            letterSpacing: '0.5px',
            marginBottom: '4px',
            textTransform: 'uppercase',
          }}>
            SEARCH NEWS
          </div>
          <input
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#000',
              color: '#ffcc00',
              border: '1px solid #333',
              fontFamily: "'Consolas','Courier New',monospace",
              fontSize: '11px',
              padding: '3px 5px',
              outline: 'none',
              textTransform: 'uppercase',
            }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') executeSearch(searchQuery); }}
            placeholder="TOPIC..."
            spellCheck={false}
          />
          <button
            style={{
              width: '100%',
              marginTop: '4px',
              background: searchMode ? '#ffcc00' : '#1a1a2e',
              color: searchMode ? '#000' : '#ffcc00',
              border: '1px solid #ffcc00',
              fontFamily: "'Consolas','Courier New',monospace",
              fontSize: '10px',
              padding: '2px 0',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
            onClick={() => executeSearch(searchQuery)}
            disabled={loading || !searchQuery.trim()}
          >
            SEARCH
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={S.main}>
        <div style={S.header}>
          <span style={S.title(region.color)}>{region.label} — GEO INTELLIGENCE</span>
          <div style={S.rightMeta}>
            <span>
              <span style={S.dot(statusColor)} />
              <span style={S.statusTxt(statusColor)}>{statusLabel}</span>
            </span>
            <button
              style={S.refreshBtn}
              onClick={() => searchMode ? executeSearch(searchQuery) : load(activeRegion, true)}
              disabled={loading}
            >
              ↻
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {loading && <div style={S.progressBar(progress)} />}

        {/* Source filter chips */}
        {!loading && uniqueSources.length > 1 && (
          <div style={S.filterRow}>
            <span style={S.filterLabel}>FILTER:</span>
            {uniqueSources.map(src => (
              <button
                key={src}
                style={S.chip(activeFilters.has(src), region.color)}
                onClick={() => toggleFilter(src)}
              >
                {src}
              </button>
            ))}
            {activeFilters.size > 0 && (
              <button
                style={S.chip(true, '#ff8c00')}
                onClick={() => setActiveFilters(new Set())}
              >
                ALL
              </button>
            )}
          </div>
        )}

        {loading && items.length === 0 && (
          <div style={S.msgCenter}>
            FETCHING {feeds.length} SOURCES FOR {region.label}...
            <br />
            <span style={{ color: '#333333', fontSize: '11px' }}>
              PROXY: ALLORIGINS.WIN → CORSPROXY.IO
            </span>
          </div>
        )}

        {!loading && error && <div style={{ ...S.msgCenter, color: '#ff4444' }}>⚠ {error}</div>}

        {visible.map(item => (
          <NewsItem key={item.id} item={item} color={region.color} />
        ))}

        {!loading && visible.length > 0 && (
          <div style={S.footer}>
            {visible.length} ITEMS · {uniqueSources.length} SOURCES · WORLDMONITOR.APP FEED CATALOG · AGPL-3.0
          </div>
        )}
      </div>
    </div>
  );
}
