import { clearAllCachedRequests } from './requestCache.js';
import { clearStoredLookups } from './lookupCache.js';

/**
 * Browser copies of server data that must not outlive a login (the next user on this
 * browser would otherwise see them). User preferences and local-only data are kept.
 */
const LOCAL_PREFIXES = ['crm-dashboard-cache-v1', 'crm_recent'];
const SESSION_PREFIXES = ['crm_seq_stats:'];

export function clearDataCaches() {
  clearAllCachedRequests();
  clearStoredLookups();
  if (typeof window === 'undefined') return;
  try {
    Object.keys(window.localStorage)
      .filter((key) => LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .forEach((key) => window.localStorage.removeItem(key));
    Object.keys(window.sessionStorage)
      .filter((key) => SESSION_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    /* storage blocked: nothing persisted to clear */
  }
}
