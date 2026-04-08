import React, { useState, useEffect, useMemo } from 'react';
import { GLOSSARY, GLOSSARY_CATEGORIES } from '../data/glossary';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

// ── Styles ──────────────────────────────────────────────────────────────────
const FONT = "'Consolas','Courier New',monospace";

const S = {
  container: {
    background: '#000000',
    minHeight: '600px',
    fontFamily: FONT,
    color: '#ffffff',
  },
  header: {
    background: '#0d0d1a',
    borderBottom: '1px solid #333333',
    padding: '6px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#ff8c00',
    fontFamily: FONT,
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    margin: 0,
  },
  countLabel: {
    color: '#888',
    fontFamily: FONT,
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  searchWrap: {
    padding: '8px 12px',
    borderBottom: '1px solid #333333',
  },
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    background: '#000000',
    color: '#ffcc00',
    border: '1px solid #ff8c00',
    fontFamily: FONT,
    fontSize: '12px',
    padding: '5px 8px',
    outline: 'none',
    letterSpacing: '0.5px',
  },
  categoryHeader: {
    background: '#0d0d1a',
    padding: '5px 12px',
    borderBottom: '1px solid #1a1a2e',
    borderTop: '1px solid #1a1a2e',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  },
  categoryLabel: {
    color: '#ff8c00',
    fontFamily: FONT,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    margin: 0,
  },
  categoryCount: {
    color: '#888',
    fontFamily: FONT,
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  chevron: (open) => ({
    color: '#ff8c00',
    fontFamily: FONT,
    fontSize: '10px',
    transition: 'transform 0.15s',
    transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
    display: 'inline-block',
    marginRight: '6px',
  }),
  cardList: {
    padding: '0 12px 4px 12px',
  },
  card: (expanded) => ({
    background: expanded ? '#0d0d1a' : 'transparent',
    borderLeft: expanded ? '2px solid #ff8c00' : '2px solid transparent',
    borderBottom: '1px solid #1a1a2e',
    padding: '5px 10px',
    cursor: 'pointer',
    userSelect: 'none',
  }),
  termName: {
    color: '#ffffff',
    fontFamily: FONT,
    fontSize: '12px',
    margin: 0,
  },
  detailBlock: {
    paddingTop: '4px',
    paddingLeft: '4px',
  },
  label: {
    color: '#888',
    fontFamily: FONT,
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginTop: '6px',
    marginBottom: '2px',
  },
  defText: {
    color: '#b0b0b0',
    fontFamily: FONT,
    fontSize: '11px',
    lineHeight: '1.5',
    margin: 0,
  },
  formulaText: {
    color: '#ffcc00',
    fontFamily: FONT,
    fontSize: '11px',
    margin: 0,
  },
  exampleText: {
    color: '#b0b0b0',
    fontFamily: FONT,
    fontSize: '11px',
    fontStyle: 'italic',
    margin: 0,
  },
  link: {
    color: '#ff8c00',
    fontFamily: FONT,
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textDecoration: 'none',
  },
  empty: {
    color: '#888',
    fontFamily: FONT,
    fontSize: '11px',
    textAlign: 'center',
    padding: '24px 12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
};

export default function GlossaryPanel() {
  const [search, setSearch] = useState('');
  const [expandedTerm, setExpandedTerm] = useState(null);
  const [collapsedCats, setCollapsedCats] = useState({});

  const { register, unregister } = useExport();

  // ── CSV Export Registration ───────────────────────────────────────────────
  useEffect(() => {
    const entries = Object.values(GLOSSARY);
    if (entries.length > 0) {
      register('GLOSSARY', 'Glossary', () => {
        const rows = entries.map(e => ({
          term: e.term,
          category: e.category,
          definition: e.definition,
          formula: e.formula || '',
          example: e.example || '',
          learn_more: e.learnMore || '',
        }));
        const date = new Date().toISOString().split('T')[0];
        exportCSV(rows, `glossary_${date}.csv`);
      });
    } else {
      unregister('GLOSSARY');
    }
    return () => unregister('GLOSSARY');
  }, [register, unregister]);

  // ── Filter entries by search query ────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = Object.entries(GLOSSARY);
    if (!q) return all;
    return all.filter(([, entry]) =>
      entry.term.toLowerCase().includes(q) ||
      entry.definition.toLowerCase().includes(q)
    );
  }, [search]);

  // ── Group filtered entries by category ────────────────────────────────────
  const grouped = useMemo(() => {
    const map = {};
    for (const cat of GLOSSARY_CATEGORIES) map[cat] = [];
    for (const [key, entry] of filtered) {
      if (map[entry.category]) map[entry.category].push({ key, ...entry });
    }
    return map;
  }, [filtered]);

  const toggleCat = (cat) => {
    setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const toggleTerm = (key) => {
    setExpandedTerm(prev => (prev === key ? null : key));
  };

  const totalShown = filtered.length;

  return (
    <div style={S.container}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={S.header}>
        <div style={S.title}>GLOSSARY</div>
        <span style={S.countLabel}>
          {totalShown} TERM{totalShown !== 1 ? 'S' : ''}
        </span>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <div style={S.searchWrap}>
        <input
          style={S.searchInput}
          type="text"
          placeholder="SEARCH TERMS..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── Categories + Terms ──────────────────────────────────────────────── */}
      {totalShown === 0 && (
        <div style={S.empty}>NO MATCHING TERMS</div>
      )}

      {GLOSSARY_CATEGORIES.map((cat) => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        const isOpen = !collapsedCats[cat];

        return (
          <div key={cat}>
            {/* Category header */}
            <div style={S.categoryHeader} onClick={() => toggleCat(cat)}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={S.chevron(isOpen)}>&#9654;</span>
                <span style={S.categoryLabel}>{cat}</span>
              </div>
              <span style={S.categoryCount}>{items.length}</span>
            </div>

            {/* Term cards */}
            {isOpen && (
              <div style={S.cardList}>
                {items.map((entry) => {
                  const expanded = expandedTerm === entry.key;
                  return (
                    <div
                      key={entry.key}
                      style={S.card(expanded)}
                      onClick={() => toggleTerm(entry.key)}
                    >
                      <div style={S.termName}>{entry.term}</div>

                      {expanded && (
                        <div style={S.detailBlock}>
                          {/* Definition */}
                          <div style={S.label}>DEFINITION</div>
                          <p style={S.defText}>{entry.definition}</p>

                          {/* Formula */}
                          {entry.formula && (
                            <>
                              <div style={S.label}>FORMULA</div>
                              <p style={S.formulaText}>{entry.formula}</p>
                            </>
                          )}

                          {/* Example */}
                          {entry.example && (
                            <>
                              <div style={S.label}>EXAMPLE</div>
                              <p style={S.exampleText}>{entry.example}</p>
                            </>
                          )}

                          {/* Learn More */}
                          {entry.learnMore && (
                            <>
                              <div style={S.label}>LEARN MORE</div>
                              <a
                                href={entry.learnMore}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={S.link}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {entry.learnMore}
                              </a>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
