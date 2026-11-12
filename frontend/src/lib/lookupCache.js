import { cachedRequest, invalidateCachedRequest, peekCachedRequest } from './requestCache.js';

const LOOKUP_TTL_MS = 5 * 60 * 1000;
/** Lookups also live in sessionStorage so they survive full page loads between pages. */
export const LOOKUP_STORAGE_PREFIX = 'crm_lookup:';

function storage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function readStored(key) {
  try {
    const raw = storage()?.getItem(`${LOOKUP_STORAGE_PREFIX}${key}`);
    if (!raw) return undefined;
    const { at, value } = JSON.parse(raw);
    return Date.now() - at < LOOKUP_TTL_MS ? value : undefined;
  } catch {
    return undefined;
  }
}

function writeStored(key, value) {
  try {
    storage()?.setItem(`${LOOKUP_STORAGE_PREFIX}${key}`, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* storage full or blocked: memory cache still works */
  }
}

export function cachedLookup(key, loader) {
  const cacheKey = `lookup:${key}`;
  if (peekCachedRequest(cacheKey, LOOKUP_TTL_MS) === undefined) {
    const stored = readStored(key);
    if (stored !== undefined) return cachedRequest(cacheKey, async () => stored, LOOKUP_TTL_MS);
  }
  return cachedRequest(cacheKey, async () => {
    const value = await loader();
    writeStored(key, value);
    return value;
  }, LOOKUP_TTL_MS);
}

export function invalidateLookup(key) {
  invalidateCachedRequest(`lookup:${key}`);
  try {
    storage()?.removeItem(`${LOOKUP_STORAGE_PREFIX}${key}`);
  } catch {
    /* ignore */
  }
}

/** Remove every saved lookup (used on logout). */
export function clearStoredLookups() {
  const store = storage();
  if (!store) return;
  try {
    Object.keys(store).filter((k) => k.startsWith(LOOKUP_STORAGE_PREFIX)).forEach((k) => store.removeItem(k));
  } catch {
    /* ignore */
  }
}
