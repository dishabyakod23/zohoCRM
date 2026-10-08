import { fetchAllPagesFast } from '../listSelectionHelpers.js';
import { cachedFullList, invalidateFullListCache } from '../requestCache.js';

function pagedSource(total, pageSize, { withTotal = true } = {}) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
  const calls = [];
  const fetchPage = jest.fn(async (page) => {
    calls.push(page);
    const data = rows.slice((page - 1) * pageSize, page * pageSize);
    return withTotal ? { data, total } : { data };
  });
  return { rows, fetchPage, calls };
}

describe('fetchAllPagesFast', () => {
  it('loads every page exactly once, in order', async () => {
    const { rows, fetchPage } = pagedSource(1100, 250);
    const all = await fetchAllPagesFast({ fetchPage, pageSize: 250 });
    expect(all).toEqual(rows);
    expect(fetchPage).toHaveBeenCalledTimes(5);
  });

  it('respects maxRecords', async () => {
    const { fetchPage } = pagedSource(1100, 250);
    const all = await fetchAllPagesFast({ fetchPage, pageSize: 250, maxRecords: 500 });
    expect(all).toHaveLength(500);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('falls back to sequential paging when the API gives no total', async () => {
    const { rows, fetchPage } = pagedSource(600, 250, { withTotal: false });
    const all = await fetchAllPagesFast({ fetchPage, pageSize: 250 });
    expect(all).toEqual(rows);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('returns only page 1 when everything fits', async () => {
    const { fetchPage } = pagedSource(40, 250);
    const all = await fetchAllPagesFast({ fetchPage, pageSize: 250 });
    expect(all).toHaveLength(40);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

describe('cachedFullList', () => {
  beforeEach(() => invalidateFullListCache());

  it('reuses the loaded list for the same params (param order/empty values ignored)', async () => {
    const loader = jest.fn().mockResolvedValue([{ id: 1 }]);
    await cachedFullList('contacts', { owner_id: 'u1', search: '' }, loader);
    const again = await cachedFullList('contacts', { search: undefined, owner_id: 'u1' }, loader);
    expect(again).toEqual([{ id: 1 }]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('loads separately for different params', async () => {
    const loader = jest.fn().mockResolvedValue([]);
    await cachedFullList('contacts', { owner_id: 'u1' }, loader);
    await cachedFullList('contacts', { owner_id: 'u2' }, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('reloads after a write invalidates the cache', async () => {
    const loader = jest.fn()
      .mockResolvedValueOnce([{ id: 1, status: 'old' }])
      .mockResolvedValueOnce([{ id: 1, status: 'new' }]);
    await cachedFullList('leads', {}, loader);
    invalidateFullListCache();
    const fresh = await cachedFullList('leads', {}, loader);
    expect(fresh).toEqual([{ id: 1, status: 'new' }]);
  });

  it('returns a new array each time so callers cannot mutate the cache', async () => {
    const loader = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const first = await cachedFullList('deals', {}, loader);
    first.pop();
    const second = await cachedFullList('deals', {}, loader);
    expect(second).toHaveLength(2);
  });
});
