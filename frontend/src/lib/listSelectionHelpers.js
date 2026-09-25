import api from './api.js';
import { DEFAULT_PAGE_SIZE, BULK_FETCH_PAGE_SIZE } from './constants.js';

/** Run async tasks with a fixed concurrency limit. */
export async function mapPool(items, concurrency, fn) {
  if (!items?.length) return [];
  const limit = Math.max(1, Math.min(concurrency || 1, items.length));
  let next = 0;
  const results = new Array(items.length);
  async function worker() {
    while (next < items.length) {
      const idx = next;
      next += 1;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

/**
 * After the first page is loaded, fetch remaining pages in parallel (capped concurrency).
 * Faster than walking pages one-by-one for select-all / bulk ID collection.
 */
export async function fetchRemainingPagesParallel({
  total,
  pageSize,
  firstPageData = [],
  maxPages = 50,
  concurrency = 5,
  fetchPage,
}) {
  const first = Array.isArray(firstPageData) ? firstPageData : [];
  const serverTotal = Number(total) || first.length;
  if (!serverTotal || first.length >= serverTotal) return first;

  const totalPages = Math.min(maxPages, Math.max(1, Math.ceil(serverTotal / Math.max(1, pageSize))));
  if (totalPages <= 1) return first;

  const pageNumbers = [];
  for (let page = 2; page <= totalPages; page += 1) pageNumbers.push(page);

  const batches = await mapPool(pageNumbers, concurrency, async (page) => {
    const result = await fetchPage(page);
    return result?.data || result || [];
  });

  return first.concat(...batches.filter(Array.isArray));
}

export async function fetchAllIdsFromEndpoint(
  endpoint,
  params = {},
  { maxPages = 50, pageSize = DEFAULT_PAGE_SIZE, useLimit = false, concurrency = 5 } = {},
) {
  const pageParams = (page) => (useLimit
    ? { ...params, page, limit: pageSize }
    : { ...params, page, page_size: pageSize });

  const firstRes = await api.get(endpoint, { params: pageParams(1) });
  const firstBatch = firstRes.data.data || [];
  const serverTotal = firstRes.data.meta?.total ?? firstRes.data.total ?? firstBatch.length;

  const allRows = await fetchRemainingPagesParallel({
    total: serverTotal,
    pageSize,
    firstPageData: firstBatch,
    maxPages,
    concurrency,
    fetchPage: async (page) => {
      const res = await api.get(endpoint, { params: pageParams(page) });
      return { data: res.data.data || [] };
    },
  });

  return allRows.map((item) => item.id).filter(Boolean);
}

export async function listAllMatchingIdsFromListFn(
  listFn,
  params = {},
  { maxPages = 50, pageSize = BULK_FETCH_PAGE_SIZE, concurrency = 5 } = {},
) {
  const first = await listFn({ ...params, page: 1, page_size: pageSize });
  const firstBatch = first?.data || [];
  const total = first?.total ?? firstBatch.length;

  const all = await fetchRemainingPagesParallel({
    total,
    pageSize,
    firstPageData: firstBatch,
    maxPages,
    concurrency,
    fetchPage: async (page) => listFn({ ...params, page, page_size: pageSize }),
  });

  return all.map((item) => item.id).filter(Boolean);
}
