import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { GLOSSARY } from '../data/glossary';

const S = {
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: '1px solid #333',
    color: '#555',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '9px',
    cursor: 'pointer',
    marginLeft: '4px',
    flexShrink: 0,
    lineHeight: 1,
    userSelect: 'none',
    verticalAlign: 'middle',
  },
  triggerHover: {
    border: '1px solid #ff8c00',
    color: '#ff8c00',
    background: '#1a0d00',
  },
  inlineTrigger: {
    borderBottom: '1px dotted #555',
    cursor: 'pointer',
  },
  inlineTriggerHover: {
    borderBottom: '1px dotted #ff8c00',
    color: '#ff8c00',
  },
  popup: {
    position: 'fixed',
    zIndex: 10000,
    background: '#0d0d1a',
    border: '1px solid #ff8c00',
    borderRadius: '2px',
    padding: '10px 12px',
    maxWidth: '360px',
    minWidth: '220px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
    pointerEvents: 'auto',
  },
  term: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '12px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
    borderBottom: '1px solid #1a1a2e',
    paddingBottom: '4px',
    display: 'block',
  },
  definition: {
    color: '#b0b0b0',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    lineHeight: '1.5',
    marginBottom: '6px',
    display: 'block',
  },
  formula: {
    color: '#ffcc00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '11px',
    background: '#0a0a14',
    padding: '4px 8px',
    borderLeft: '2px solid #ff8c00',
    marginBottom: '6px',
    whiteSpace: 'pre-wrap',
    display: 'block',
  },
  example: {
    color: '#888',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    fontStyle: 'italic',
    lineHeight: '1.4',
    marginBottom: '6px',
    display: 'block',
  },
  learnMore: {
    color: '#ff8c00',
    fontFamily: "'Consolas','Courier New',monospace",
    fontSize: '10px',
    textDecoration: 'underline',
    opacity: 0.8,
  },
};

function TooltipPopup({ entry, triggerRect }) {
  const popupRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!popupRef.current || !triggerRect) return;
    const popup = popupRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = triggerRect.top - popup.height - 8;
    let left = triggerRect.left + triggerRect.width / 2 - popup.width / 2;

    // Flip below if clipping top
    if (top < 4) top = triggerRect.bottom + 8;
    // Clamp horizontal
    if (left < 4) left = 4;
    if (left + popup.width > vw - 4) left = vw - popup.width - 4;
    // Clamp bottom
    if (top + popup.height > vh - 4) top = vh - popup.height - 4;

    setPos({ top, left });
  }, [triggerRect]);

  return ReactDOM.createPortal(
    <div ref={popupRef} style={{ ...S.popup, top: pos.top, left: pos.left }}>
      <span style={S.term}>{entry.term}</span>
      <span style={S.definition}>{entry.definition}</span>
      {entry.formula && <span style={S.formula}>{entry.formula}</span>}
      {entry.example && <span style={S.example}>{entry.example}</span>}
      {entry.learnMore && (
        <a
          href={entry.learnMore}
          target="_blank"
          rel="noreferrer"
          style={S.learnMore}
          onClick={e => e.stopPropagation()}
        >
          LEARN MORE →
        </a>
      )}
    </div>,
    document.body
  );
}

export default function Tooltip({ termKey, children, inline }) {
  const entry = GLOSSARY[termKey];
  const [show, setShow] = useState(false);
  const [hover, setHover] = useState(false);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const enterTimer = useRef(null);
  const exitTimer = useRef(null);

  const handleEnter = useCallback(() => {
    clearTimeout(exitTimer.current);
    enterTimer.current = setTimeout(() => {
      if (triggerRef.current) {
        setRect(triggerRef.current.getBoundingClientRect());
      }
      setShow(true);
    }, 200);
    setHover(true);
  }, []);

  const handleLeave = useCallback(() => {
    clearTimeout(enterTimer.current);
    exitTimer.current = setTimeout(() => {
      setShow(false);
    }, 150);
    setHover(false);
  }, []);

  // Allow hovering into the popup itself
  const handlePopupEnter = useCallback(() => {
    clearTimeout(exitTimer.current);
  }, []);

  const handlePopupLeave = useCallback(() => {
    exitTimer.current = setTimeout(() => setShow(false), 150);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(enterTimer.current);
      clearTimeout(exitTimer.current);
    };
  }, []);

  if (!entry) return null;

  if (inline) {
    return (
      <span
        ref={triggerRef}
        style={{ ...S.inlineTrigger, ...(hover ? S.inlineTriggerHover : {}) }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {children}
        {show && (
          <span onMouseEnter={handlePopupEnter} onMouseLeave={handlePopupLeave}>
            <TooltipPopup entry={entry} triggerRect={rect} />
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      ref={triggerRef}
      style={{ ...S.trigger, ...(hover ? S.triggerHover : {}) }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      ?
      {show && (
        <span onMouseEnter={handlePopupEnter} onMouseLeave={handlePopupLeave}>
          <TooltipPopup entry={entry} triggerRect={rect} />
        </span>
      )}
    </span>
  );
}
