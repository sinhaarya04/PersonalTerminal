import React from 'react';

const FONT = "'Consolas','Courier New',monospace";

function vixToScore(vix) {
  if (vix == null) return null;
  if (vix < 12) return 90;
  if (vix < 15) return 75;
  if (vix < 20) return 60;
  if (vix < 25) return 45;
  if (vix < 30) return 30;
  if (vix < 35) return 18;
  return 8;
}

function scoreLabel(score) {
  if (score >= 75) return { text: 'EXTREME GREED', color: '#00cc00' };
  if (score >= 55) return { text: 'GREED', color: '#66cc66' };
  if (score >= 40) return { text: 'NEUTRAL', color: '#ffcc00' };
  if (score >= 25) return { text: 'FEAR', color: '#ff8844' };
  return { text: 'EXTREME FEAR', color: '#ff4444' };
}

export default function FearGreedGauge({ vix }) {
  const score = vixToScore(vix);
  if (score == null) {
    return <div style={{ color: '#555', fontSize: 11, fontFamily: FONT, padding: 8 }}>LOADING...</div>;
  }
  const label = scoreLabel(score);

  return (
    <div style={{ padding: '8px 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, color: label.color }}>{score}</span>
        <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: label.color, letterSpacing: '0.5px' }}>
          {label.text}
        </span>
      </div>
      {/* Gradient bar */}
      <div style={{
        position: 'relative',
        height: 6,
        borderRadius: 3,
        background: 'linear-gradient(to right, #ff4444, #ff8844, #ffcc00, #66cc66, #00cc00)',
      }}>
        {/* Needle */}
        <div style={{
          position: 'absolute',
          left: `${score}%`,
          top: -3,
          width: 2,
          height: 12,
          background: '#fff',
          transform: 'translateX(-1px)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontFamily: FONT, fontSize: 8, color: '#ff4444' }}>FEAR</span>
        <span style={{ fontFamily: FONT, fontSize: 8, color: '#00cc00' }}>GREED</span>
      </div>
      {vix != null && (
        <div style={{ fontFamily: FONT, fontSize: 9, color: '#666', marginTop: 4 }}>
          VIX: {typeof vix === 'number' ? vix.toFixed(2) : vix}
        </div>
      )}
    </div>
  );
}
