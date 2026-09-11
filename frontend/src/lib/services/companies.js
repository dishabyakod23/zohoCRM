import api from '../api.js';
import { normalizeCompany, toCompanyPayload, detectRecordModule } from '../companyHelpers.js';
import { applyAccountRecordFilters } from '../listRecordFilters.js';
import { DEFAULT_PAGE_SIZE, BULK_FETCH_PAGE_SIZE, CLIENT_FILTER_MAX_RECORDS } from '../constants.js';
import { listAllMatchingIdsFromListFn } from '../listSelectionHelpers.js';
import { invalidateCachedRequest } from '../requestCache.js';

async function fetchAllCompanyPages(params = {}, maxRecords = CLIENT_FILTER_MAX_RECORDS) {
  const pageSize = BULK_FETCH_PAGE_SIZE;
  let page = 1;
  let all = [];
  let serverTotal = 0;

  while (page <= 50 && all.length < maxRecords) {
    const res = await api.get('/companies', { params: { ...params, page, page_size: pageSize } });
    const raw = res.data.data || [];
    serverTotal = res.data.meta?.total ?? all.length + raw.length;
    const batch = raw
      .filter((row) => detectRecordModule(row) !== 'account')
      .map((row) => normalizeCompany(row, { defaultModule: 'company' }));
    all = all.concat(batch);
    if (raw.length === 0 || page * pageSize >= serverTotal) break;
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
  if (filters.industry) baseParams.industry = filters.industry;
  if (filters.city) baseParams.city = filters.city;
  if (filters.website) baseParams.website = filters.website;
  if (filters.campaign_id) baseParams.campaign_id = filters.campaign_id;

  // Always client-filter so account-module rows (moved by Status) stay out of Companies.
  const all = await fetchAllCompanyPages(baseParams);
  const filtered = applyAccountRecordFilters(all, filters, { campaignMemberIds });
  const start = (page - 1) * page_size;
  return {
    data: filtered.slice(start, start + page_size),
    total: filtered.length,
    meta: { total: filtered.length },
  };
}

export async function countCompanies() {
  const result = await listCompanies({ page: 1, page_size: 1 });
  return result.total ?? result.meta?.total ?? 0;
}

export async function getCompany(id) {
  const res = await api.get(`/companies/${id}`);
  return normalizeCompany(res.data.data, { defaultModule: 'company' });
}

export async function createCompany(form) {
  const res = await api.post('/companies', toCompanyPayload(form, { module: 'company' }));
  invalidateCachedRequest('sticky-account-module-rows');
  return normalizeCompany(res.data.data, { defaultModule: 'company' });
}

export async function updateCompany(id, form) {
  let next = { ...form };
  if (!Object.prototype.hasOwnProperty.call(form, 'description')) {
    try {
      const current = await getCompany(id);
      next = { ...next, description: current?.description || '' };
    } catch {
      next = { ...next, description: '' };
    }
  }
  const res = await api.patch(
    `/companies/${id}`,
    toCompanyPayload({ ...next, _stamp_module: true }, { partial: true, module: 'company' }),
  );
  invalidateCachedRequest('sticky-account-module-rows');
  return normalizeCompany(res.data.data, { defaultModule: 'company' });
}

export async function deleteCompany(id) {
  await api.delete(`/companies/${id}`);
  invalidateCachedRequest('sticky-account-module-rows');
}
