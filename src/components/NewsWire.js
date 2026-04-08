import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchGoogleNews } from '../hooks/useYahooFinance';
import { useExport } from '../context/ExportContext';
import { exportCSV } from '../utils/csvExport';

const S = {
  container: { background: '#000000' },
  header: {
    background: '#0d0d1a',
    borderBottom: '1px solid #333333',
    padding: '4px 8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#ff8c00', fontFamily: "'Consolas','Courier New',monospace", fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' },
  refreshBtn: { background: '#0d0d1a', color: '#ff8c00', border: '1px solid #333333', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px', padding: '1px 8px', cursor: 'pointer', textTransform: 'uppercase' },
  ttsOnBtn: { background: '#0d0d1a', color: '#00cc00', border: '1px solid #00cc00', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px', padding: '1px 8px', cursor: 'pointer', textTransform: 'uppercase' },
  ttsOffBtn: { background: '#0d0d1a', color: '#444444', border: '1px solid #333333', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px', padding: '1px 8px', cursor: 'pointer', textTransform: 'uppercase' },
  newsItem: (hover) => ({ background: hover ? '#1a3a5c' : '#000000', borderBottom: '1px solid #222222', padding: '6px 10px', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'flex-start' }),
  headline: { color: '#ffffff', fontFamily: "'Consolas','Courier New',monospace", fontSize: '12px', display: 'block', lineHeight: '1.4' },
  itemMeta: { display: 'flex', gap: '12px', marginTop: '3px', alignItems: 'center' },
  publisher: { color: '#ff8c00', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px', textTransform: 'uppercase' },
  timestamp: { color: '#666666', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px' },
  tickers: { color: '#ffcc00', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px' },
  loading: { padding: '20px', color: '#ff8c00', fontFamily: "'Consolas','Courier New',monospace", fontSize: '12px', textAlign: 'center' },
  empty: { padding: '20px', color: '#555555', fontFamily: "'Consolas','Courier New',monospace", fontSize: '12px', textAlign: 'center' },
};

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NewsItem({ item }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={S.newsItem(hover)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => item.article_url && item.article_url !== '#' && window.open(item.article_url, '_blank', 'noopener')}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={S.headline}>{item.title}</span>
        <div style={S.itemMeta}>
          <span style={S.publisher}>{item.publisher?.name || 'NEWS'}</span>
          <span style={S.timestamp}>{relativeTime(item.published_utc)}</span>
          {item.tickers?.length > 0 && (
            <span style={S.tickers}>{item.tickers.slice(0, 4).join(' · ')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewsWire({ polygonKey, apiKey, ticker }) {
  const key = polygonKey || apiKey;
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('');
  const [countdown, setCountdown] = useState(300);
  const { register, unregister } = useExport();

  // TTS state and refs
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const seenIds = useRef(new Set());
  const speechQueue = useRef([]);
  const isSpeaking = useRef(false);

  const speakNext = useCallback(() => {
    if (!window.speechSynthesis) return;
    if (speechQueue.current.length === 0) { isSpeaking.current = false; return; }
    isSpeaking.current = true;
    const text = speechQueue.current.shift();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.0;
    utt.onend = () => speakNext();
    utt.onerror = () => speakNext();
    window.speechSynthesis.speak(utt);
  }, []);

  const toggleTts = useCallback(() => {
    setTtsEnabled(prev => {
      const next = !prev;
      if (!next) {
        // Turning off: cancel and drain
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        speechQueue.current = [];
        isSpeaking.current = false;
      }
      return next;
    });
  }, []);

  // When news updates and TTS is on, queue only unseen headlines
  useEffect(() => {
    if (!ttsEnabled || news.length === 0) return;
    if (!window.speechSynthesis) return;

    const isFirstEnable = seenIds.current.size === 0;

    const newItems = news.filter(item => {
      const id = item.id || item.published_utc || item.title;
      return !seenIds.current.has(id);
    });

    // Mark all current headlines as seen
    news.forEach(item => {
      const id = item.id || item.published_utc || item.title;
      seenIds.current.add(id);
    });

    if (newItems.length === 0) return;

    // On first enable, only speak the most recent headline
    const toSpeak = isFirstEnable ? [newItems[0]] : newItems;

    toSpeak.forEach(item => speechQueue.current.push(item.title));

    if (!isSpeaking.current) speakNext();
  }, [news, ttsEnabled, speakNext]);

  // When TTS is first toggled ON, seed seenIds with all current headlines
  // except the most recent one (which we want to speak once).
  // This is handled above by checking seenIds.size === 0 on first run.

  // On unmount, cancel any active speech
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setNews([]);
    let fetched = false;

    // 1. Polygon (best — structured, ticker-tagged)
    if (key) {
      try {
        const params = new URLSearchParams({ limit: 10, apiKey: key });
        if (ticker) params.set('ticker', ticker);
        const res = await fetch(`https://api.polygon.io/v2/reference/news?${params}`);
        const data = await res.json();
        if (data.results?.length > 0) {
          setNews(data.results);
          setSource('POLYGON');
          setCountdown(300);
          fetched = true;
        }
      } catch { /* fall through */ }
    }

    // 2. Google News RSS (always free, no key needed)
    if (!fetched) {
      try {
        const query = ticker ? `${ticker} stock earnings` : 'stock market S&P 500';
        const items = await fetchGoogleNews(query, 12);
        if (items?.length > 0) {
          setNews(items);
          setSource('GOOGLE NEWS');
          setCountdown(300);
          fetched = true;
        }
      } catch { /* fall through */ }
    }

    if (!fetched) {
      setSource('');
      setNews([]);
    }
    setLoading(false);
  }, [key, ticker]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  useEffect(() => {
    if (news.length > 0) {
      register('NEWS', `News (${ticker || 'MARKET'})`, () => {
        const date = new Date().toISOString().split('T')[0];
        const rows = news.map(item => ({
          title: item.title,
          publisher: item.publisher?.name || '',
          published_utc: item.published_utc || '',
          tickers: (item.tickers || []).join(', '),
          url: item.article_url || '',
        }));
        exportCSV(rows, `news_${ticker || 'market'}_${date}.csv`);
      });
    } else {
      unregister('NEWS');
    }
    return () => unregister('NEWS');
  }, [news, ticker, register, unregister]);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { fetchNews(); return 300; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [fetchNews]);

  const formatCountdown = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const srcColor = source === 'POLYGON' ? '#ff8c00' : source === 'GOOGLE NEWS' ? '#00cc00' : '#555555';

  return (
    <div style={S.container}>
      <div style={S.header}>
        <span style={S.headerTitle}>
          NEWS WIRE {ticker ? `— ${ticker}` : ''}
          {source && (
            <span style={{ color: srcColor, fontSize: '11px', marginLeft: '8px' }}>● {source}</span>
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!loading && (
            <span style={{ color: '#444444', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px' }}>
              ↻ {formatCountdown(countdown)}
            </span>
          )}
          {loading && (
            <span style={{ color: '#ff8c00', fontFamily: "'Consolas','Courier New',monospace", fontSize: '11px' }}>
              REFRESHING...
            </span>
          )}
          <button style={ttsEnabled ? S.ttsOnBtn : S.ttsOffBtn} onClick={toggleTts}>
            {ttsEnabled ? 'TTS ON' : 'TTS OFF'}
          </button>
          <button style={S.refreshBtn} onClick={fetchNews} disabled={loading}>↻ REFRESH</button>
        </div>
      </div>

      {loading && <div style={S.loading}>LOADING NEWS...</div>}
      {!loading && news.length === 0 && (
        <div style={S.empty}>NO NEWS FOUND — CHECK CONNECTION OR REFRESH</div>
      )}
      {news.map((item, i) => (
        <NewsItem key={item.id || item.published_utc || i} item={item} />
      ))}
    </div>
  );
}
