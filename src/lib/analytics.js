const SESSION_KEY = 'bb_session_id';

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// Buffer events and flush in batches to reduce network calls
let buffer = [];
let flushTimer = null;
const FLUSH_INTERVAL = 5000; // 5 seconds
const FLUSH_SIZE = 10;       // or 10 events, whichever comes first

async function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0);
  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // Analytics should never break the app. Drop on failure.
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL);
}

/**
 * Track a user event.
 * @param {string} eventType - e.g. 'ticker_search', 'tab_change', 'csv_export'
 * @param {object} payload   - event-specific data
 * @param {string} userId    - user email from auth context
 */
export function track(eventType, payload = {}, userId = 'anonymous') {
  buffer.push({
    user_id: userId,
    event_type: eventType,
    payload,
    session_id: getSessionId(),
    timestamp: new Date().toISOString(),
  });

  if (buffer.length >= FLUSH_SIZE) {
    flush();
  } else {
    scheduleFlush();
  }
}

// Flush remaining events when the user leaves
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}
