import React, { useState, useEffect } from 'react';
import { PROJECT_IDEAS } from '../data/projects';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

const DIFF_COLORS = {
  BEGINNER: { bg: '#001a00', color: '#00cc00', border: '#00cc00' },
  INTERMEDIATE: { bg: '#1a1400', color: '#ffcc00', border: '#ffcc00' },
  ADVANCED: { bg: '#1a0000', color: '#ff4444', border: '#ff4444' },
};

const S = {
  container: { background: '#000000' },
  header: {
    background: '#0d0d1a',
    borderBottom: '1px solid #333333',
    padding: '4px 8px',
  },
  headerTitle: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
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
  projTitle: {
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '14px',
    fontWeight: 'bold',
    display: 'block',
    marginBottom: '4px',
  },
  stack: {
    color: '#888888',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    display: 'block',
    marginBottom: '6px',
  },
  description: {
    color: '#b0b0b0',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    lineHeight: '1.5',
    display: 'block',
    marginBottom: '8px',
  },
  badgeRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  tag: {
    background: '#1a1a2e',
    color: '#ffcc00',
    border: '1px solid #ffcc00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 6px',
    textTransform: 'uppercase',
  },
  diff: (d) => ({
    background: DIFF_COLORS[d]?.bg || '#0d0d1a',
    color: DIFF_COLORS[d]?.color || '#ffffff',
    border: `1px solid ${DIFF_COLORS[d]?.border || '#333333'}`,
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    padding: '1px 6px',
    textTransform: 'uppercase',
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
  },
  projRow: (hover, isSelected) => ({
    background: isSelected ? '#0d2035' : (hover ? '#1a3a5c' : '#000000'),
    borderBottom: '1px solid #1a1a1a',
    padding: '6px 10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    borderLeft: isSelected ? '3px solid #ff8c00' : '3px solid transparent',
  }),
  rowTitle: {
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    flex: 1,
  },
  rowStack: {
    color: '#666666',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    marginTop: '2px',
  },
};

function ProjectRow({ project, isSelected, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={S.projRow(hover, isSelected)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onClick(project)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
        <span style={S.tag}>{project.tag}</span>
        <span style={S.diff(project.difficulty)}>{project.difficulty}</span>
      </div>
      <div>
        <div style={S.rowTitle}>{project.title}</div>
        <div style={S.rowStack}>{project.stack}</div>
      </div>
    </div>
  );
}

const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

export default function ProjectIdeas() {
  const [featured, setFeatured] = useState(null);
  const [activeDiff, setActiveDiff] = useState(null);
  const [activeTag, setActiveTag] = useState(null);
  const { register, unregister } = useExport();

  useEffect(() => {
    const idx = Math.floor(Math.random() * PROJECT_IDEAS.length);
    setFeatured(PROJECT_IDEAS[idx]);
  }, []);

  useEffect(() => {
    register('PROJECTS', 'Project Ideas', () => {
      const rows = PROJECT_IDEAS.map(p => ({
        title: p.title, stack: p.stack, difficulty: p.difficulty,
        tag: p.tag, description: p.description,
      }));
      exportCSV(rows, 'project_ideas.csv');
    });
    return () => unregister('PROJECTS');
  }, [register, unregister]);

  const allTags = [...new Set(PROJECT_IDEAS.map(p => p.tag))];
  const filtered = PROJECT_IDEAS.filter(p => {
    if (activeDiff && p.difficulty !== activeDiff) return false;
    if (activeTag && p.tag !== activeTag) return false;
    return true;
  });

  if (!featured) return null;

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.headerTitle}>BUILD IDEAS — QUANT FINANCE PROJECT PIPELINE</span>
      </div>

      {/* Featured */}
      <div style={S.featured}>
        <span style={S.featuredLabel}>◉ SESSION BUILD IDEA</span>
        <span style={S.projTitle}>{featured.title}</span>
        <span style={S.stack}>STACK: {featured.stack}</span>
        <span style={S.description}>{featured.description}</span>
        <div style={S.badgeRow}>
          <span style={S.tag}>{featured.tag}</span>
          <span style={S.diff(featured.difficulty)}>{featured.difficulty}</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: '#0d0d1a',
        borderBottom: '1px solid #333333',
        padding: '4px 8px',
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <span style={{ color: '#888888', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px', marginRight: '4px' }}>DIFFICULTY:</span>
        <button
          style={{
            background: !activeDiff ? '#ff8c00' : '#0d0d1a',
            color: !activeDiff ? '#000000' : '#888888',
            border: `1px solid ${!activeDiff ? '#ff8c00' : '#333333'}`,
            fontFamily: "'Consolas','Courier New',monospace",
            fontSize: '10px',
            padding: '1px 6px',
            cursor: 'pointer',
          }}
          onClick={() => setActiveDiff(null)}
        >
          ALL
        </button>
        {DIFFICULTIES.map(d => {
          const dc = DIFF_COLORS[d];
          const isActive = activeDiff === d;
          return (
            <button
              key={d}
              style={{
                background: isActive ? dc.bg : '#0d0d1a',
                color: isActive ? dc.color : '#666666',
                border: `1px solid ${isActive ? dc.border : '#222222'}`,
                fontFamily: "'Consolas','Courier New',monospace",
                fontSize: '10px',
                padding: '1px 6px',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
              onClick={() => setActiveDiff(activeDiff === d ? null : d)}
            >
              {d}
            </button>
          );
        })}

        <span style={{ color: '#333333', margin: '0 4px' }}>|</span>
        <span style={{ color: '#888888', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px', marginRight: '4px' }}>TAG:</span>
        {allTags.map(tag => (
          <button
            key={tag}
            style={{
              background: activeTag === tag ? '#1a3a5c' : '#0d0d1a',
              color: activeTag === tag ? '#ffcc00' : '#666666',
              border: `1px solid ${activeTag === tag ? '#ffcc00' : '#222222'}`,
              fontFamily: "'Consolas','Courier New',monospace",
              fontSize: '10px',
              padding: '1px 6px',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={S.listHeader}>
        {activeDiff || activeTag
          ? `FILTERED (${filtered.length} OF ${PROJECT_IDEAS.length})`
          : `ALL PROJECT IDEAS (${PROJECT_IDEAS.length})`}
      </div>
      {filtered.map(p => (
        <ProjectRow
          key={p.id}
          project={p}
          isSelected={p.id === featured.id}
          onClick={setFeatured}
        />
      ))}
      {filtered.length === 0 && (
        <div style={{ padding: '20px', color: '#555555', fontFamily: "'Consolas','Courier New',monospace", fontSize: '12px', textAlign: 'center' }}>
          NO PROJECTS MATCH FILTERS
        </div>
      )}
    </div>
  );
}
