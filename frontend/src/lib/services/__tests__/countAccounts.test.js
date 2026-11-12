import api from '../../api.js';
import { countAccounts } from '../accounts.js';
import {
  cachedRequest,
  invalidateCachedRequest,
  invalidateFullListCache,
  peekCachedRequest,
} from '../../requestCache.js';

const STICKY_KEY = 'sticky-account-module-rows';

function urlsCalled() {
  return api.get.mock.calls.map(([url, opts]) => ({ url, params: opts?.params }));
}

beforeEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
  invalidateCachedRequest(STICKY_KEY);
  invalidateFullListCache();
});

describe('peekCachedRequest', () => {
  it('returns a fresh cached value without loading anything', async () => {
    const loader = jest.fn().mockResolvedValue(['x']);
    await cachedRequest('peek-test', loader, 60_000);
    expect(peekCachedRequest('peek-test', 60_000)).toEqual(['x']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when nothing is cached or the value is stale', async () => {
    expect(peekCachedRequest('peek-missing')).toBeUndefined();
    await cachedRequest('peek-stale', async () => ['y'], 60_000);
    expect(peekCachedRequest('peek-stale', 0)).toBeUndefined();
    invalidateCachedRequest('peek-test');
    invalidateCachedRequest('peek-stale');
  });
});

describe('countAccounts', () => {
  it('uses the /accounts total with one small request and never downloads all companies', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({ data: { data: [{ id: 'a1' }], meta: { total: 42 } } });

    await expect(countAccounts()).resolves.toBe(42);

    const calls = urlsCalled();
    expect(calls).toEqual([{ url: '/accounts', params: { page: 1, page_size: 1 } }]);
    expect(calls.some((c) => c.url === '/companies')).toBe(false);
  });

  it('returns 0 when the API sends no total', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({ data: { data: [] } });
    await expect(countAccounts()).resolves.toBe(0);
  });

  it('falls back to the full merge when moved account rows are already cached', async () => {
    await cachedRequest(STICKY_KEY, async () => [{ id: 'moved-1', _crm_module: 'account' }], 30_000);
    jest.spyOn(api, 'get').mockResolvedValue({ data: { data: [], meta: { total: 0 } } });

    const total = await countAccounts();

    expect(typeof total).toBe('number');
    const calls = urlsCalled();
    // The full path pages through /accounts in bulk instead of the 1-row fast count.
    expect(calls.some((c) => c.url === '/accounts' && c.params?.page_size > 1)).toBe(true);
    expect(calls.some((c) => c.url === '/companies')).toBe(false);
  });
});
