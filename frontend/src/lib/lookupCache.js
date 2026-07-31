import { cachedRequest, invalidateCachedRequest } from './requestCache.js';

const LOOKUP_TTL_MS = 5 * 60 * 1000;

export function cachedLookup(key, loader) {
  return cachedRequest(`lookup:${key}`, loader, LOOKUP_TTL_MS);
}

export function invalidateLookup(key) {
  invalidateCachedRequest(`lookup:${key}`);
}
