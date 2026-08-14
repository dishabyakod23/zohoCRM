import api from './api.js';
import { DEFAULT_PAGE_SIZE, BULK_FETCH_PAGE_SIZE } from './constants.js';

export async function fetchAllIdsFromEndpoint(
  endpoint,
  params = {},
  { maxPages = 50, pageSize = DEFAULT_PAGE_SIZE, useLimit = false } = {},
) {
  let page = 1;
  const ids = [];
  let serverTotal = 0;

  while (page <= maxPages) {
    const pageParams = useLimit
      ? { ...params, page, limit: pageSize }
      : { ...params, page, page_size: pageSize };
    const res = await api.get(endpoint, { params: pageParams });
    const batch = res.data.data || [];
    serverTotal = res.data.meta?.total ?? res.data.total ?? ids.length + batch.length;
    ids.push(...batch.map((item) => item.id).filter(Boolean));
    if (batch.length === 0 || ids.length >= serverTotal) break;
    page += 1;
  }

  return ids;
}

export async function listAllMatchingIdsFromListFn(
  listFn,
  params = {},
  { maxPages = 50, pageSize = BULK_FETCH_PAGE_SIZE } = {},
) {
  const all = [];
  let page = 1;

  while (page <= maxPages) {
    const result = await listFn({ ...params, page, page_size: pageSize });
    const batch = result?.data || [];
    all.push(...batch);
    const total = result?.total ?? all.length;
    if (!batch.length || all.length >= total) break;
    page += 1;
  }

  return all.map((item) => item.id).filter(Boolean);
}
