import * as accountsApi from './accounts.js';
import {
  buildAccountKindContext,
  fetchContactCountByAccount,
  filterAccountsByKind,
} from '../companyHelpers.js';
import { applyAccountRecordFilters, hasAccountClientFilters } from '../listRecordFilters.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';

function attachContactCounts(companies, contactCounts) {
  return (companies || []).map((company) => ({
    ...company,
    contact_count: contactCounts.get(String(company.id)) || 0,
  }));
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
  const [context, contactCounts] = await Promise.all([
    buildAccountKindContext(),
    fetchContactCountByAccount(),
  ]);

  const mergedOwnerId = filters.owner_id || owner_id;
  const baseParams = {
    search,
    owner_id: mergedOwnerId,
    sort_by,
    sort_order,
  };

  if (hasAccountClientFilters(filters)) {
    const all = await accountsApi.listAllAccounts(baseParams);
    const companies = attachContactCounts(
      filterAccountsByKind(all.data, 'company', context),
      contactCounts,
    );
    const filtered = applyAccountRecordFilters(companies, filters, { campaignMemberIds });
    const start = (page - 1) * page_size;
    return {
      data: filtered.slice(start, start + page_size),
      total: filtered.length,
      meta: { total: filtered.length },
    };
  }

  const all = await accountsApi.listAllAccounts(baseParams);
  const companies = attachContactCounts(
    filterAccountsByKind(all.data, 'company', context),
    contactCounts,
  );
  const filtered = applyAccountRecordFilters(companies, filters, { campaignMemberIds });
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
  return accountsApi.getAccount(id);
}

export async function updateCompany(id, form) {
  return accountsApi.updateAccount(id, form);
}

export async function deleteCompany(id) {
  return accountsApi.deleteAccount(id);
}
