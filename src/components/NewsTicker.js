import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchGoogleNews } from '../hooks/useYahooFinance';

const TICKER_H = 22;

const S = {
  wrapper: {
    background: '#0a0a14',
    borderBottom: '1px solid #1a1a2e',
    height: `${TICKER_H}px`,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  label: {
    background: '#cc0000',
    color: '#ffffff',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    fontWeight: 'bold',
    padding: '0 8px',
    height: `${TICKER_H}px`,
    lineHeight: `${TICKER_H}px`,
    letterSpacing: '1px',
    whiteSpace: 'nowrap',
    zIndex: 2,
    flexShrink: 0,
  },
  track: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    height: '100%',
  },
  scroll: {
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    whiteSpace: 'nowrap',
    position: 'absolute',
    willChange: 'transform',
  },
  item: {
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    color: '#cccccc',
    paddingRight: '40px',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  dot: {
    display: 'inline-block',
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    background: '#ff8c00',
    flexShrink: 0,
  },
  source: {
    color: '#ff8c00',
    fontSize: '10px',
    letterSpacing: '0.5px',
  },
  time: {
    color: '#555555',
    fontSize: '10px',
  },
};

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'NOW';
  if (mins < 60) return `${mins}M`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H`;
  return `${Math.floor(hrs / 24)}D`;
}

export default function NewsTicker({ ticker }) {
  const [headlines, setHeadlines] = useState([]);
  const scrollRef = useRef(null);
  const animRef = useRef(null);
  const posRef = useRef(0);
  const pausedRef = useRef(false);

  const fetchHeadlines = useCallback(async () => {
    try {
      const query = ticker ? `${ticker} stock` : 'stock market S&P 500';
      const items = await fetchGoogleNews(query, 15);
      if (items?.length > 0) setHeadlines(items);
    } catch { /* silent */ }
  }, [ticker]);

  useEffect(() => { fetchHeadlines(); }, [fetchHeadlines]);

  // Refresh every 5 minutes
  useEffect(() => {
    const id = setInterval(fetchHeadlines, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchHeadlines]);

  // Scroll animation
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || headlines.length === 0) return;

    const speed = 0.6; // px per frame (~36px/s at 60fps)
    let lastTime = 0;

    const animate = (ts) => {
      if (!lastTime) lastTime = ts;
      const dt = ts - lastTime;
      lastTime = ts;

      if (!pausedRef.current && dt < 100) {
        posRef.current -= speed * (dt / 16.67);
        const contentW = el.scrollWidth / 2; // we duplicate content
        if (Math.abs(posRef.current) >= contentW) {
          posRef.current += contentW;
        }
        el.style.transform = `translateX(${posRef.current}px)`;
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [headlines]);

  if (headlines.length === 0) return null;

  // Duplicate items for seamless loop
  const items = [...headlines, ...headlines];

  return (
    <div
      style={S.wrapper}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <span style={S.label}>LIVE</span>
      <div style={S.track}>
        <div ref={scrollRef} style={S.scroll}>
          {items.map((item, i) => (
            <span
              key={`${item.id}-${i}`}
              style={S.item}
              onClick={() => item.article_url && item.article_url !== '#' && window.open(item.article_url, '_blank', 'noopener')}
            >
              <span style={S.dot} />
              <span style={S.source}>{item.publisher?.name || 'NEWS'}</span>
              <span>{item.title}</span>
              <span style={S.time}>{relativeTime(item.published_utc)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
