// Client-side rate limiter — 5 requests/minute (free tier)
// Queues overflow with 12-second spacing

const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 1000;
const QUEUE_SPACING_MS = 12 * 1000;

let timestamps = [];
let queue = [];
let processing = false;
let rateLimitedCallback = null;

export function setRateLimitCallback(cb) {
  rateLimitedCallback = cb;
}

function canRequest() {
  const now = Date.now();
  timestamps = timestamps.filter(t => now - t < WINDOW_MS);
  return timestamps.length < RATE_LIMIT;
}

function recordRequest() {
  timestamps.push(Date.now());
}

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    if (canRequest()) {
      const { fn, resolve, reject } = queue.shift();
      recordRequest();
      if (rateLimitedCallback) rateLimitedCallback(false);
      try {
        const result = await fn();
        resolve(result);
      } catch (e) {
        reject(e);
      }
    } else {
      if (rateLimitedCallback) rateLimitedCallback(true);
      await new Promise(r => setTimeout(r, QUEUE_SPACING_MS));
    }
  }

  if (rateLimitedCallback) rateLimitedCallback(false);
  processing = false;
}

export function rateLimitedFetch(fn) {
  return new Promise((resolve, reject) => {
    if (canRequest()) {
      recordRequest();
      fn().then(resolve).catch(reject);
    } else {
      queue.push({ fn, resolve, reject });
      processQueue();
    }
  });
}
