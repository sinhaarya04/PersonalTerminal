// In-memory cache with TTL

const store = new Map();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(key, value, ttl = DEFAULT_TTL) {
  store.set(key, { value, expiry: Date.now() + ttl });
}

export function cacheHas(key) {
  return cacheGet(key) !== null;
}

export function cacheClear() {
  store.clear();
}
