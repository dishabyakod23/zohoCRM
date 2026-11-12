import { cachedLookup, invalidateLookup } from '../lookupCache.js';
import { clearAllCachedRequests } from '../requestCache.js';
import { clearDataCaches } from '../clearDataCaches.js';

describe('lookup cache across page loads', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    clearAllCachedRequests();
  });

  it('reuses a saved lookup after the in-memory cache is gone (a full page load)', async () => {
    const loader = jest.fn().mockResolvedValue([{ id: 'u1' }]);
    await cachedLookup('users', loader);
    clearAllCachedRequests(); // what a full page navigation does to module memory
    const again = await cachedLookup('users', loader);
    expect(again).toEqual([{ id: 'u1' }]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('fetches again once the saved copy is invalidated', async () => {
    const loader = jest.fn().mockResolvedValue(['a']);
    await cachedLookup('sources', loader);
    invalidateLookup('sources');
    await cachedLookup('sources', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('logout clears saved lookups and cached server data but keeps preferences', async () => {
    const loader = jest.fn().mockResolvedValue(['x']);
    await cachedLookup('statuses', loader);
    window.localStorage.setItem('crm-dashboard-cache-v1', '{}');
    window.localStorage.setItem('crm_recent', '[]');
    window.localStorage.setItem('crm_a11y', '{}');
    window.sessionStorage.setItem('crm_seq_stats:s1', '{}');

    clearDataCaches();

    expect(Object.keys(window.sessionStorage)).toEqual([]);
    expect(window.localStorage.getItem('crm-dashboard-cache-v1')).toBeNull();
    expect(window.localStorage.getItem('crm_recent')).toBeNull();
    expect(window.localStorage.getItem('crm_a11y')).toBe('{}');
    await cachedLookup('statuses', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
