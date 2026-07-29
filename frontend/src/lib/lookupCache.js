import { cachedRequest } from './requestCache.js';

const LOOKUP_TTL_MS = 5 * 60 * 1000;

export function cachedLookup(key, loader) {
  return cachedRequest(`lookup:${key}`, loader, LOOKUP_TTL_MS);
}
