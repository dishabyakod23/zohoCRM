import api from '../api.js';
import { normalizeCompany, toCompanyPayload } from '../companyHelpers.js';
import { applyAccountRecordFilters, hasAccountClientFilters } from '../listRecordFilters.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import { listAllMatchingIdsFromListFn } from '../listSelectionHelpers.js';

async function fetchAllCompanyPages(params = {}) {
  const pageSize = DEFAULT_PAGE_SIZE;
  let page = 1;
  let all = [];
  let serverTotal = 0;

  while (page <= 50) {
    const res = await api.get('/companies', { params: { ...params, page, page_size: pageSize } });
    const batch = (res.data.data || []).map(normalizeCompany);
    serverTotal = res.data.meta?.total ?? all.length + batch.length;
    all = all.concat(batch);
    if (batch.length === 0 || all.length >= serverTotal) break;
    page += 1;
  }

  return all;
}

export async function listAllMatchingCompanyIds(params = {}) {
  return listAllMatchingIdsFromListFn(listCompanies, params);
}

export async function listCompanies({
  page = 1,
  page_size = DEFAULT_PAGE_SIZE,
  search,
  owner_id,
  sort_by,
  sort_order,
  filters = {},
  campaignMemberIds,
} = {}) {
  const mergedOwnerId = filters.owner_id || owner_id;
  const baseParams = {
    search,
    owner_id: mergedOwnerId,
    sort_by,
    sort_order,
  };

  if (hasAccountClientFilters(filters) || campaignMemberIds) {
    const all = await fetchAllCompanyPages(baseParams);
    const filtered = applyAccountRecordFilters(all, filters, { campaignMemberIds });
    const start = (page - 1) * page_size;
    return {
      data: filtered.slice(start, start + page_size),
      total: filtered.length,
      meta: { total: filtered.length },
    };
  }

  const params = { page, page_size, ...baseParams };
  const res = await api.get('/companies', { params });
  return {
    data: (res.data.data || []).map(normalizeCompany),
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

export async function countCompanies() {
  const result = await listCompanies({ page: 1, page_size: 1 });
  return result.total ?? result.meta?.total ?? 0;
}

export async function getCompany(id) {
  const res = await api.get(`/companies/${id}`);
  return normalizeCompany(res.data.data);
}

export async function createCompany(form) {
  const res = await api.post('/companies', toCompanyPayload(form));
  return normalizeCompany(res.data.data);
}

export async function updateCompany(id, form) {
  const res = await api.patch(`/companies/${id}`, toCompanyPayload(form, { partial: true }));
  return normalizeCompany(res.data.data);
}

export async function deleteCompany(id) {
  await api.delete(`/companies/${id}`);
}
