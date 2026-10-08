const store = new Map();
const inflight = new Map();

/**
 * Cache async fetch results with TTL and in-flight deduplication.
 * @param {string} key
 * @param {() => Promise<T>} loader
 * @param {number} ttlMs
 * @returns {Promise<T>}
 */
export async function cachedRequest(key, loader, ttlMs = 5 * 60 * 1000) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value;

  if (inflight.has(key)) return inflight.get(key);

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      store.set(key, { value, at: Date.now() });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** Full "fetch every page" list results used for client-side filtering and paging. */
const FULL_LIST_PREFIX = 'full-list:';
export const FULL_LIST_TTL_MS = 60 * 1000;
let fullListGeneration = 0;

function stableKey(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  return `{${Object.keys(value)
    .filter((k) => value[k] !== undefined && value[k] !== '' && value[k] !== null)
    .sort()
    .map((k) => `${k}:${stableKey(value[k])}`)
    .join(',')}}`;
}

/**
 * Cache a full list (all pages) for a short time so paging / tweaking client-side
 * filters doesn't re-download every page. Any write clears it (see api.js).
 * Returns a fresh array each call so callers can sort/filter without sharing state.
 */
export async function cachedFullList(name, params, loader, ttlMs = FULL_LIST_TTL_MS) {
  const key = `${FULL_LIST_PREFIX}${name}:${stableKey(params)}`;
  const generation = fullListGeneration;
  const rows = await cachedRequest(key, async () => {
    const value = await loader();
    // A write happened while loading: don't keep possibly-stale rows.
    if (generation !== fullListGeneration) queueMicrotask(() => invalidateCachedRequest(key));
    return value;
  }, ttlMs);
  return Array.isArray(rows) ? [...rows] : rows;
}

export function invalidateFullListCache() {
  fullListGeneration += 1;
  invalidateCachedRequestPrefix(FULL_LIST_PREFIX);
}

export function invalidateCachedRequest(key) {
  store.delete(key);
  inflight.delete(key);
}

export function invalidateCachedRequestPrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}
