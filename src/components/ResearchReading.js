import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RESEARCH_PAPERS } from '../data/papers';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

// ── arXiv + Semantic Scholar fetchers ────────────────────────────────────────

const _searchCache = new Map();
function searchCacheGet(k) {
  const e = _searchCache.get(k);
  if (!e || Date.now() - e.ts > 10 * 60 * 1000) { _searchCache.delete(k); return null; }
  return e.v;
}
function searchCacheSet(k, v) { _searchCache.set(k, { v, ts: Date.now() }); }

async function fetchArxiv(query) {
  const cacheKey = `arxiv:${query}`;
  const cached = searchCacheGet(cacheKey);
  if (cached) return cached;

  // arXiv API uses + for spaces in search_query, no encodeURIComponent
  // (the param is already in a query string — browser won't double-encode it
  //  because we build the URL manually with + delimiters)
  const terms = query.trim().replace(/\s+/g, '+');

  let results = [];

  // Single broad search using all: prefix
  try {
    const url = `/arxiv/api/query?search_query=all:${terms}&start=0&max_results=15&sortBy=relevance&sortOrder=descending`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const text = await res.text();
      results = parseArxivXML(text);
    }
  } catch { /* fall through */ }

  if (results.length > 0) searchCacheSet(cacheKey, results);
  return results;
}

function parseArxivXML(text) {
  // Strip XML namespaces so querySelector works with plain tag names.
  // 1. Remove all xmlns declarations
  // 2. Remove namespace prefixes from element names (e.g. <arxiv:comment> → <comment>)
  //    Without step 2, DOMParser sees undeclared prefixes and emits parsererror.
  const cleaned = text
    .replace(/xmlns(:[a-zA-Z0-9_-]+)?\s*=\s*"[^"]*"/g, '')
    .replace(/<(\/?)([a-zA-Z0-9_-]+):/g, '<$1');

  const parser = new DOMParser();
  const xml = parser.parseFromString(cleaned, 'text/xml');
  if (xml.querySelector('parsererror')) return [];

  const entries = xml.querySelectorAll('entry');
  return Array.from(entries).map((entry, i) => {
    const title = entry.querySelector('title')?.textContent?.trim().replace(/\s+/g, ' ') || '';
    const authors = Array.from(entry.querySelectorAll('author name'))
      .map(a => a.textContent?.trim())
      .filter(Boolean);
    const summary = entry.querySelector('summary')?.textContent?.trim().replace(/\s+/g, ' ') || '';
    const published = entry.querySelector('published')?.textContent || '';
    const year = published ? new Date(published).getFullYear() : '';

    // Get PDF and abstract links
    const links = Array.from(entry.querySelectorAll('link'));
    const pdfLink = links.find(l => l.getAttribute('title') === 'pdf')?.getAttribute('href') || '';
    const absLink = links.find(l => l.getAttribute('type') === 'text/html')?.getAttribute('href')
      || entry.querySelector('id')?.textContent?.trim() || '';

    // Extract arXiv categories
    const categories = Array.from(entry.querySelectorAll('category'))
      .map(c => c.getAttribute('term'))
      .filter(Boolean);
    const primaryCat = categories[0] || '';
    const tag = primaryCat.startsWith('q-fin') ? primaryCat.replace('q-fin.', 'QFIN/')
      : primaryCat.startsWith('cs.') ? primaryCat.replace('cs.', 'CS/')
      : primaryCat.startsWith('stat.') ? primaryCat.replace('stat.', 'STAT/')
      : primaryCat.startsWith('econ.') ? primaryCat.replace('econ.', 'ECON/')
      : primaryCat.toUpperCase().substring(0, 12);

    return {
      id: `arxiv-${i}-${absLink}`,
      title,
      authors: authors.slice(0, 4).join(', ') + (authors.length > 4 ? ' et al.' : ''),
      year,
      journal: 'arXiv',
      tag: tag || 'ARXIV',
      description: summary.substring(0, 300) + (summary.length > 300 ? '...' : ''),
      scholar: absLink,
      pdfLink,
      source: 'ARXIV',
    };
  }).filter(p => p.title.length > 3);
}

async function fetchSemanticScholar(query) {
  const cacheKey = `ss:${query}`;
  const cached = searchCacheGet(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      query,
      limit: '10',
      fields: 'title,authors,year,abstract,externalIds,citationCount,venue,publicationTypes',
    });

    // Semantic Scholar has strict rate limits — retry once after 1.5s on 429
    let res = await fetch(`/semscholar/graph/v1/paper/search?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1500));
      res = await fetch(`/semscholar/graph/v1/paper/search?${params}`, {
        signal: AbortSignal.timeout(15000),
      });
    }
    if (!res.ok) return [];
    const data = await res.json();
    const results = (data.data || []).map((p, i) => {
      const authors = (p.authors || []).slice(0, 4).map(a => a.name).join(', ')
        + ((p.authors || []).length > 4 ? ' et al.' : '');
      const doi = p.externalIds?.DOI;
      const arxivId = p.externalIds?.ArXiv;
      const link = arxivId ? `https://arxiv.org/abs/${arxivId}`
        : doi ? `https://doi.org/${doi}`
        : `https://www.semanticscholar.org/paper/${p.paperId}`;

      return {
        id: `ss-${i}-${p.paperId}`,
        title: p.title || '',
        authors,
        year: p.year || '',
        journal: p.venue || 'Semantic Scholar',
        tag: (p.publicationTypes || [])[0]?.replace('JournalArticle', 'JOURNAL').toUpperCase().substring(0, 12) || 'PAPER',
        description: (p.abstract || '').substring(0, 300) + ((p.abstract || '').length > 300 ? '...' : ''),
        scholar: link,
        pdfLink: arxivId ? `https://arxiv.org/pdf/${arxivId}` : '',
        citationCount: p.citationCount || 0,
        source: 'SEMANTIC SCHOLAR',
      };
    }).filter(p => p.title.length > 3);

    searchCacheSet(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

// ── Suggested searches ──────────────────────────────────────────────────────
const SUGGESTED_SEARCHES = [
  'momentum trading strategy',
  'deep learning asset pricing',
  'portfolio optimization',
  'volatility forecasting',
  'pairs trading cointegration',
  'options pricing neural network',
  'market microstructure',
  'factor investing',
  'risk parity',
  'sentiment analysis stock market',
  'high frequency trading',
  'reinforcement learning trading',
];

// ── Styles ──────────────────────────────────────────────────────────────────
const S = {
  container: { background: '#000000', padding: '0' },
  header: {
    background: '#0d0d1a',
    borderBottom: '1px solid #333333',
    padding: '4px 8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  searchBar: {
    background: '#050510',
    borderBottom: '1px solid #333333',
    padding: '6px 8px',
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: '200px',
    background: '#000000',
    color: '#ffcc00',
    border: '1px solid #ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    padding: '4px 8px',
    outline: 'none',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  searchBtn: {
    background: '#ff8c00',
    color: '#000000',
    border: 'none',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    fontWeight: 'bold',
    padding: '4px 14px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  },
  sourceToggle: (active, color) => ({
    background: active ? '#0d1a2e' : '#0d0d1a',
    color: active ? color : '#555555',
    border: `1px solid ${active ? color : '#333333'}`,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '2px 8px',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }),
  suggestRow: {
    background: '#030308',
    borderBottom: '1px solid #111111',
    padding: '4px 8px',
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  suggestLabel: {
    color: '#333333',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    marginRight: '2px',
    flexShrink: 0,
  },
  suggestChip: {
    background: 'transparent',
    color: '#444444',
    border: '1px solid #1a1a1a',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 5px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  },
  featured: {
    background: '#0d0d1a',
    border: '1px solid #333333',
    borderLeft: '4px solid #ff8c00',
    margin: '8px',
    padding: '10px 12px',
  },
  featuredLabel: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    display: 'block',
    marginBottom: '4px',
  },
  paperTitle: {
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '13px',
    fontWeight: 'bold',
    display: 'block',
    marginBottom: '4px',
    lineHeight: '1.4',
  },
  paperMeta: {
    color: '#888888',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    display: 'block',
    marginBottom: '6px',
  },
  paperDesc: {
    color: '#b0b0b0',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    lineHeight: '1.5',
    display: 'block',
    marginBottom: '8px',
    whiteSpace: 'pre-wrap',
  },
  tag: {
    background: '#1a1a2e',
    color: '#ffcc00',
    border: '1px solid #ffcc00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginRight: '8px',
  },
  linkBtn: (color) => ({
    color: color || '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    textDecoration: 'none',
    textTransform: 'uppercase',
    marginRight: '12px',
  }),
  listHeader: {
    background: '#1a1a2e',
    borderBottom: '1px solid #333333',
    borderTop: '1px solid #333333',
    padding: '3px 8px',
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paperRow: (hover, isFeatured) => ({
    background: isFeatured ? '#0d2035' : (hover ? '#1a3a5c' : '#000000'),
    borderBottom: '1px solid #1a1a1a',
    padding: '5px 10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    borderLeft: isFeatured ? '3px solid #ff8c00' : '3px solid transparent',
  }),
  rowTag: (color) => ({
    background: '#1a1a2e',
    color: color || '#ffcc00',
    border: `1px solid ${color || '#333333'}`,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 5px',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    marginTop: '1px',
  }),
  rowTitle: {
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    flex: 1,
    lineHeight: '1.3',
  },
  rowMeta: {
    color: '#666666',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    marginTop: '2px',
  },
  sourceBadge: (source) => ({
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '9px',
    padding: '0px 4px',
    marginLeft: '6px',
    border: '1px solid',
    borderColor: source === 'ARXIV' ? '#ff6644' : source === 'SEMANTIC SCHOLAR' ? '#4488ff' : '#ffcc00',
    color: source === 'ARXIV' ? '#ff6644' : source === 'SEMANTIC SCHOLAR' ? '#4488ff' : '#ffcc00',
    background: 'transparent',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }),
  loading: {
    padding: '20px',
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textAlign: 'center',
  },
  noResults: {
    padding: '20px',
    color: '#555555',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    textAlign: 'center',
  },
  filterRow: {
    background: '#0d0d1a',
    borderBottom: '1px solid #333333',
    padding: '4px 8px',
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  filterLabel: {
    color: '#888888',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    marginRight: '4px',
  },
  filterBtn: (active) => ({
    background: active ? '#ff8c00' : '#0d0d1a',
    color: active ? '#000000' : '#888888',
    border: `1px solid ${active ? '#ff8c00' : '#333333'}`,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 6px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  }),
  filterBtnTag: (active) => ({
    background: active ? '#1a3a5c' : '#0d0d1a',
    color: active ? '#ffcc00' : '#666666',
    border: `1px solid ${active ? '#ffcc00' : '#222222'}`,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 6px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  }),
};

// ── Components ──────────────────────────────────────────────────────────────

function PaperRow({ paper, isFeatured, onClick }) {
  const [hover, setHover] = useState(false);
  const tagColor = paper.source === 'ARXIV' ? '#ff6644'
    : paper.source === 'SEMANTIC SCHOLAR' ? '#4488ff'
    : '#ffcc00';
  return (
    <div
      style={S.paperRow(hover, isFeatured)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onClick(paper)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
        <span style={S.rowTag(tagColor)}>{paper.tag}</span>
        {paper.source && paper.source !== 'CURATED' && (
          <span style={S.sourceBadge(paper.source)}>
            {paper.source === 'ARXIV' ? 'arXiv' : paper.source === 'SEMANTIC SCHOLAR' ? 'S2' : paper.source}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.rowTitle}>{paper.title}</div>
        <div style={S.rowMeta}>
          {paper.authors} · {paper.year} · {paper.journal}
          {paper.citationCount > 0 && (
            <span style={{ color: '#ff8c00', marginLeft: '8px' }}>{paper.citationCount} CITATIONS</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function ResearchReading() {
  const [featured, setFeatured] = useState(null);
  const [activeTag, setActiveTag] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [searchSource, setSearchSource] = useState('ALL'); // ALL, ARXIV, SEMSCHOLAR
  const [lastQuery, setLastQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const searchRef = useRef(null);
  const { register, unregister } = useExport();

  useEffect(() => {
    const idx = Math.floor(Math.random() * RESEARCH_PAPERS.length);
    setFeatured(RESEARCH_PAPERS[idx]);
  }, []);

  useEffect(() => {
    const allPapers = [...RESEARCH_PAPERS, ...searchResults];
    register('RESEARCH', 'Research Papers', () => {
      const date = new Date().toISOString().split('T')[0];
      const rows = allPapers.map(p => ({
        title: p.title, authors: p.authors, year: p.year, journal: p.journal,
        tag: p.tag, description: p.description || '', source: p.source || 'CURATED',
        citations: p.citationCount || '', url: p.scholar || '',
      }));
      exportCSV(rows, `research_papers_${date}.csv`);
    });
    return () => unregister('RESEARCH');
  }, [searchResults, register, unregister]);

  const handleSelectPaper = (paper) => setFeatured(paper);

  // ── Search logic ──────────────────────────────────────────────────────────
  const doSearch = useCallback(async (query) => {
    if (!query.trim()) return;
    const q = query.trim();
    setSearching(true);
    setSearchDone(false);
    setSearchResults([]);
    setSearchError('');
    setLastQuery(q);

    let results = [];
    const errors = [];

    if (searchSource === 'ALL' || searchSource === 'ARXIV') {
      try {
        const arxivResults = await fetchArxiv(q);
        results.push(...arxivResults);
      } catch (e) { errors.push(`ARXIV: ${e.message}`); }
    }

    if (searchSource === 'ALL' || searchSource === 'SEMSCHOLAR') {
      try {
        const ssResults = await fetchSemanticScholar(q);
        results.push(...ssResults);
      } catch (e) { errors.push(`S2: ${e.message}`); }
    }

    if (results.length === 0 && errors.length > 0) {
      setSearchError(errors.join(' · '));
    }

    // Deduplicate by title similarity (first 50 chars lowercase)
    const seen = new Set();
    results = results.filter(p => {
      const key = p.title.toLowerCase().substring(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort: arXiv first (typically more relevant for quant), then by year desc
    results.sort((a, b) => {
      if (a.source === 'ARXIV' && b.source !== 'ARXIV') return -1;
      if (b.source === 'ARXIV' && a.source !== 'ARXIV') return 1;
      return (b.year || 0) - (a.year || 0);
    });

    setSearchResults(results);
    setSearching(false);
    setSearchDone(true);
  }, [searchSource]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') doSearch(searchQuery);
  };

  const handleSuggest = (q) => {
    setSearchQuery(q);
    doSearch(q);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchDone(false);
    setLastQuery('');
    setSearchError('');
  };

  // ── Curated list filters ──────────────────────────────────────────────────
  const allTags = [...new Set(RESEARCH_PAPERS.map(p => p.tag))];
  const filtered = activeTag
    ? RESEARCH_PAPERS.filter(p => p.tag === activeTag)
    : RESEARCH_PAPERS;

  // ── Featured panel ────────────────────────────────────────────────────────
  const renderFeatured = () => {
    if (!featured) return null;
    const isLive = featured.source === 'ARXIV' || featured.source === 'SEMANTIC SCHOLAR';
    const srcColor = featured.source === 'ARXIV' ? '#ff6644' : featured.source === 'SEMANTIC SCHOLAR' ? '#4488ff' : '#ff8c00';

    return (
      <div style={S.featured}>
        <span style={S.featuredLabel}>
          {isLive ? '◉ SEARCH RESULT — LIVE' : '◉ FEATURED PAPER — SESSION PICK'}
          {isLive && <span style={S.sourceBadge(featured.source)}>
            {featured.source === 'ARXIV' ? 'arXiv' : 'S2'}
          </span>}
        </span>
        <span style={S.paperTitle}>{featured.title}</span>
        <span style={S.paperMeta}>
          {featured.authors} · {featured.year} · {featured.journal}
          {featured.citationCount > 0 && (
            <span style={{ color: '#ff8c00' }}> · {featured.citationCount} citations</span>
          )}
        </span>
        <span style={S.paperDesc}>{featured.description}</span>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          <span style={S.tag}>{featured.tag}</span>
          {featured.scholar && (
            <a href={featured.scholar} target="_blank" rel="noreferrer" style={S.linkBtn(srcColor)}>
              → {isLive ? 'VIEW PAPER' : 'GOOGLE SCHOLAR'} ↗
            </a>
          )}
          {featured.pdfLink && (
            <a href={featured.pdfLink} target="_blank" rel="noreferrer" style={S.linkBtn('#ff4444')}>
              → PDF ↗
            </a>
          )}
        </div>
      </div>
    );
  };

  if (!featured) return null;

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.headerTitle}>RESEARCH READING — QUANT FINANCE LIBRARY</span>
        <div style={S.headerRight}>
          {searchDone && (
            <span style={{ color: '#00cc00', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px' }}>
              ● {searchResults.length} RESULTS
            </span>
          )}
          {searching && (
            <span style={{ color: '#ff8c00', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px' }}>
              SEARCHING...
            </span>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div style={S.searchBar}>
        <span style={{ color: '#ff8c00', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px', flexShrink: 0 }}>
          SEARCH:
        </span>
        <input
          ref={searchRef}
          style={S.searchInput}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="SEARCH ARXIV + SEMANTIC SCHOLAR..."
          spellCheck={false}
        />
        <button
          style={S.searchBtn}
          onClick={() => doSearch(searchQuery)}
          disabled={searching || !searchQuery.trim()}
        >
          {searching ? '...' : 'GO'}
        </button>
        {searchDone && (
          <button
            style={{ ...S.searchBtn, background: '#333333', color: '#888888' }}
            onClick={clearSearch}
          >
            CLEAR
          </button>
        )}
        <span style={{ color: '#222222', margin: '0 2px' }}>|</span>
        {[
          { key: 'ALL', label: 'ALL', color: '#ff8c00' },
          { key: 'ARXIV', label: 'arXiv', color: '#ff6644' },
          { key: 'SEMSCHOLAR', label: 'S2', color: '#4488ff' },
        ].map(s => (
          <button
            key={s.key}
            style={S.sourceToggle(searchSource === s.key, s.color)}
            onClick={() => setSearchSource(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Suggested searches */}
      {!searchDone && (
        <div style={S.suggestRow}>
          <span style={S.suggestLabel}>SUGGESTED:</span>
          {SUGGESTED_SEARCHES.map(q => (
            <button
              key={q}
              style={S.suggestChip}
              onClick={() => handleSuggest(q)}
              onMouseEnter={e => { e.currentTarget.style.color = '#ff8c00'; e.currentTarget.style.borderColor = '#ff8c00'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#444444'; e.currentTarget.style.borderColor = '#1a1a1a'; }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Featured paper */}
      {renderFeatured()}

      {/* Search results */}
      {searching && <div style={S.loading}>QUERYING {searchSource === 'ALL' ? 'ARXIV + SEMANTIC SCHOLAR' : searchSource === 'ARXIV' ? 'ARXIV' : 'SEMANTIC SCHOLAR'}...</div>}

      {searchDone && (
        <>
          <div style={S.listHeader}>
            <span>
              SEARCH: "{lastQuery.toUpperCase()}" — {searchResults.length} RESULTS
            </span>
            <span style={{ color: '#555555', fontSize: '10px' }}>
              {searchResults.filter(p => p.source === 'ARXIV').length} ARXIV · {searchResults.filter(p => p.source === 'SEMANTIC SCHOLAR').length} S2
            </span>
          </div>
          {searchResults.length === 0 && !searching && (
            <div style={S.noResults}>
              NO RESULTS FOUND — TRY A DIFFERENT QUERY
              {searchError && (
                <div style={{ color: '#ff4444', marginTop: '6px', fontSize: '11px' }}>
                  ⚠ {searchError}
                </div>
              )}
            </div>
          )}
          {searchResults.map(paper => (
            <PaperRow
              key={paper.id}
              paper={paper}
              isFeatured={featured?.id === paper.id}
              onClick={handleSelectPaper}
            />
          ))}
        </>
      )}

      {/* Tag filters for curated list */}
      <div style={S.filterRow}>
        <span style={S.filterLabel}>CURATED:</span>
        <button style={S.filterBtn(!activeTag)} onClick={() => setActiveTag(null)}>
          ALL ({RESEARCH_PAPERS.length})
        </button>
        {allTags.map(tag => (
          <button
            key={tag}
            style={S.filterBtnTag(activeTag === tag)}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Curated reading list */}
      <div style={S.listHeader}>
        <span>
          {activeTag ? `${activeTag} (${filtered.length})` : `CURATED READING LIST (${RESEARCH_PAPERS.length} PAPERS)`}
        </span>
      </div>
      {filtered.map(paper => (
        <PaperRow
          key={paper.id}
          paper={{ ...paper, source: 'CURATED' }}
          isFeatured={featured?.id === paper.id}
          onClick={handleSelectPaper}
        />
      ))}
    </div>
  );
}
