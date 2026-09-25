import { fetchRemainingPagesParallel, mapPool } from '../listSelectionHelpers.js';

describe('mapPool / fetchRemainingPagesParallel', () => {
  it('runs work with limited concurrency', async () => {
    let inflight = 0;
    let maxInflight = 0;
    const items = [1, 2, 3, 4, 5, 6];
    const results = await mapPool(items, 2, async (n) => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 5));
      inflight -= 1;
      return n * 2;
    });
    expect(results).toEqual([2, 4, 6, 8, 10, 12]);
    expect(maxInflight).toBeLessThanOrEqual(2);
  });

  it('fetches remaining pages in parallel after the first page', async () => {
    const calls = [];
    const rows = await fetchRemainingPagesParallel({
      total: 7,
      pageSize: 3,
      firstPageData: [{ id: '1' }, { id: '2' }, { id: '3' }],
      concurrency: 3,
      fetchPage: async (page) => {
        calls.push(page);
        if (page === 2) return { data: [{ id: '4' }, { id: '5' }, { id: '6' }] };
        if (page === 3) return { data: [{ id: '7' }] };
        return { data: [] };
      },
    });
    expect(calls.sort()).toEqual([2, 3]);
    expect(rows.map((r) => r.id)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });
});
