import React, { useState, useEffect, useCallback } from 'react';
import { fetchGoogleNews } from '../hooks/useYahooFinance';

const FONT = "'Consolas','Courier New',monospace";

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'NOW';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function DashboardNewsWidget() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(180);

  const load = useCallback(async () => {
    try {
      const data = await fetchGoogleNews('stock market finance', 10);
      if (data && data.length) setArticles(data);
    } catch { /* silent */ }
    setLoading(false);
    setCountdown(180);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 3 min
  useEffect(() => {
    const id = setInterval(load, 180000);
    return () => clearInterval(id);
  }, [load]);

  // Countdown display
  useEffect(() => {
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  if (loading && articles.length === 0) {
    return <div style={{ color: '#555', fontSize: 11, fontFamily: FONT, padding: 8 }}>LOADING NEWS...</div>;
  }

  return (
    <div style={{ padding: 0 }}>
      {/* Header with live indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 8px', borderBottom: '1px solid #111',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: '#ff4444',
            animation: 'pulse 2s infinite',
          }} />
          <span style={{ fontFamily: FONT, fontSize: 9, color: '#ff4444', fontWeight: 700 }}>LIVE</span>
        </div>
        <span style={{ fontFamily: FONT, fontSize: 8, color: '#444' }}>
          {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
        </span>
      </div>
      {/* Article list */}
      {articles.slice(0, 8).map((a, i) => (
        <a
          key={a.id || i}
          href={a.article_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            padding: '5px 8px',
            borderBottom: '1px solid #0a0a0a',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#111'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{
            fontFamily: FONT, fontSize: 10, color: '#ddd', lineHeight: '14px',
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {a.title}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            {a.publisher?.name && (
              <span style={{ fontFamily: FONT, fontSize: 8, color: '#ff8c00', fontWeight: 600 }}>
                {a.publisher.name}
              </span>
            )}
            <span style={{ fontFamily: FONT, fontSize: 8, color: '#444' }}>
              {timeAgo(a.published_utc)}
            </span>
          </div>
        </a>
      ))}
      {/* Inline CSS for pulse animation */}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
    </div>
  );
}
