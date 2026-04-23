import React, { useState, useEffect, useCallback } from 'react';

const FONT = "'Consolas','Courier New',monospace";

// Channel URLs — the /live page always points to the current stream
const CHANNELS = [
  { id: 'bloomberg', name: 'BLOOMBERG TV', liveUrl: 'https://www.youtube.com/channel/UCIALMKvObZNtJ6AmdCLP7Lg/live', fallbackId: 'iEpJwprxDdk', desc: 'Global business & markets', color: '#9D4EDD' },
  { id: 'cnbc',      name: 'CNBC LIVE',    liveUrl: 'https://www.youtube.com/@CNBCtelevision/live',                   fallbackId: '9NyxcX3rhQs', desc: 'US market coverage',       color: '#2563eb' },
  { id: 'yahoo',     name: 'YAHOO FINANCE', liveUrl: 'https://www.youtube.com/@YahooFinance/live',                     fallbackId: 'KQp-e_XQnDE', desc: '24/7 market coverage',     color: '#16a34a' },
  { id: 'ndtv',      name: 'NDTV PROFIT',  liveUrl: 'https://www.youtube.com/channel/UCRWFSbif-RFENbBrSiez1DA/live',  fallbackId: 'kf8tVmwfUHI', desc: 'India business & markets', color: '#0891b2' },
  { id: 'aljazeera', name: 'AL JAZEERA',   liveUrl: 'https://www.youtube.com/@aljazeeraenglish/live',                 fallbackId: 'gCNeDWCI0vo', desc: 'World news & finance',     color: '#d97706' },
];

// Resolve a channel's current live video ID via our serverless proxy
const resolvedCache = {};
async function resolveLiveId(channel) {
  if (resolvedCache[channel.id] && Date.now() < resolvedCache[channel.id].exp) {
    return resolvedCache[channel.id].videoId;
  }
  try {
    const res = await fetch(`/ytlive?url=${encodeURIComponent(channel.liveUrl)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.videoId) {
        resolvedCache[channel.id] = { videoId: data.videoId, exp: Date.now() + 10 * 60 * 1000 };
        return data.videoId;
      }
    }
  } catch { /* fall through */ }
  return channel.fallbackId;
}

export default function LiveTVWidget() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [videoId, setVideoId] = useState(null);
  const [resolving, setResolving] = useState(true);

  const active = CHANNELS[activeIdx];

  const loadChannel = useCallback(async (ch) => {
    setResolving(true);
    const id = await resolveLiveId(ch);
    setVideoId(id);
    setResolving(false);
  }, []);

  // Resolve on channel change
  useEffect(() => {
    loadChannel(active);
  }, [activeIdx, active, loadChannel]);

  // Re-resolve every 10 min in case stream ID rotates
  useEffect(() => {
    const id = setInterval(() => loadChannel(active), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [activeIdx, active, loadChannel]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Channel selector bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderBottom: '1px solid #111', flexShrink: 0, overflow: 'hidden',
      }}>
        {CHANNELS.map((ch, i) => (
          <button
            key={ch.id}
            onClick={() => setActiveIdx(i)}
            style={{
              flex: 1,
              background: activeIdx === i ? '#111' : 'transparent',
              border: 'none',
              borderBottom: activeIdx === i ? `2px solid ${ch.color}` : '2px solid transparent',
              color: activeIdx === i ? ch.color : '#555',
              fontFamily: FONT,
              fontSize: 8,
              fontWeight: 700,
              padding: '5px 2px',
              cursor: 'pointer',
              letterSpacing: '0.3px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={ch.desc}
          >
            {ch.name}
          </button>
        ))}
      </div>

      {/* Video embed */}
      <div style={{ flex: 1, position: 'relative', background: '#000', minHeight: 0 }}>
        {resolving ? (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            fontFamily: FONT, fontSize: 11, color: '#ff8c00',
          }}>
            RESOLVING STREAM...
          </div>
        ) : videoId ? (
          <iframe
            key={videoId}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0&modestbranding=1`}
            title={active.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '100%', height: '100%',
              border: 'none',
            }}
          />
        ) : (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            fontFamily: FONT, fontSize: 11, color: '#ff4444', textAlign: 'center',
          }}>
            NO LIVE STREAM FOUND<br />
            <span style={{ fontSize: 9, color: '#555' }}>Channel may be offline</span>
          </div>
        )}
      </div>

      {/* Now playing bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 8px', borderTop: '1px solid #111', flexShrink: 0,
        background: '#0a0a0a',
      }}>
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: resolving ? '#ffcc00' : active.color, flexShrink: 0,
        }} />
        <span style={{ fontFamily: FONT, fontSize: 8, color: active.color, fontWeight: 700 }}>
          {active.name}
        </span>
        <span style={{ fontFamily: FONT, fontSize: 8, color: '#444' }}>
          {resolving ? 'Resolving...' : active.desc}
        </span>
      </div>
    </div>
  );
}
