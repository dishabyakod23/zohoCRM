import api from '../api.js';
import { normalizeAccount, toAccountPayload, setAccountCurrency } from '../accountHelpers.js';
import {
  COMPANY_ACCOUNT_TYPE,
  CONFIRMED_ACCOUNT_TYPE,
  detectRecordModule,
  isAccountModuleRecord,
} from '../companyHelpers.js';
import * as contactsApi from './contacts.js';
import * as projectsApi from './projects.js';
import {
  applyAccountRecordFilters,
  hasAccountClientFilters,
  usesCampaignMembershipFilter,
} from '../listRecordFilters.js';
import { DEFAULT_PAGE_SIZE, BULK_FETCH_PAGE_SIZE, CLIENT_FILTER_MAX_RECORDS } from '../constants.js';
import { cachedRequest, invalidateCachedRequest } from '../requestCache.js';
import { listAllMatchingIdsFromListFn } from '../listSelectionHelpers.js';

const EMAIL_MAP_CACHE_MS = 5 * 60 * 1000;
const STICKY_ACCOUNTS_CACHE_MS = 30 * 1000;

async function fetchAccountContactEmailMap() {
  return cachedRequest('account-contact-emails', async () => {
    const pageSize = BULK_FETCH_PAGE_SIZE;
    let page = 1;
    const map = new Map();

    while (page <= 50) {
      const res = await api.get('/contacts', { params: { page, page_size: pageSize } });
      const batch = res.data.data || [];
      for (const contact of batch) {
        const accountId = contact.account_id;
        const email = String(contact.email || '').trim();
        if (accountId && email && !map.has(accountId)) map.set(accountId, email);
      }
      const total = res.data.meta?.total ?? batch.length;
      if (batch.length === 0 || page * pageSize >= total) break;
      page += 1;
    }

    return map;
  }, EMAIL_MAP_CACHE_MS);
}

function attachContactEmails(accounts, emailMap) {
  return (accounts || []).map((account) => ({
    ...account,
    email: account.email || emailMap.get(account.id) || null,
  }));
}

async function fetchAllAccountPages(params, maxRecords = CLIENT_FILTER_MAX_RECORDS) {
  const pageSize = BULK_FETCH_PAGE_SIZE;
  let page = 1;
  let all = [];
  let serverTotal = 0;

  while (page <= 50 && all.length < maxRecords) {
    const res = await api.get('/accounts', { params: { ...params, page, page_size: pageSize } });
    const batch = (res.data.data || []).map((row) => normalizeAccount(row, { defaultModule: 'account' }));
    serverTotal = res.data.meta?.total ?? all.length + batch.length;
    all = all.concat(batch);
    if (batch.length === 0 || all.length >= serverTotal) break;
    page += 1;
  }

  return all;
}

/** Accounts that API moved to /companies after account_type change but still belong in Accounts. */
async function fetchStickyAccountRowsFromCompanies() {
  return cachedRequest('sticky-account-module-rows', async () => {
    const pageSize = BULK_FETCH_PAGE_SIZE;
    let page = 1;
    let all = [];
    let serverTotal = 0;

    while (page <= 50 && all.length < CLIENT_FILTER_MAX_RECORDS) {
      const res = await api.get('/companies', { params: { page, page_size: pageSize } });
      const batch = res.data.data || [];
      serverTotal = res.data.meta?.total ?? all.length + batch.length;
      for (const row of batch) {
        if (detectRecordModule(row) === 'account') {
          all.push(normalizeAccount(row, { defaultModule: 'account' }));
        }
      }
      if (batch.length === 0 || page * pageSize >= serverTotal) break;
      page += 1;
    }

    return all;
  }, STICKY_ACCOUNTS_CACHE_MS);
}

function mergeAccountRows(primary = [], sticky = []) {
  const byId = new Map();
  for (const row of sticky) {
    if (row?.id) byId.set(String(row.id), row);
  }
  for (const row of primary) {
    if (row?.id) byId.set(String(row.id), row);
  }
  return Array.from(byId.values());
}

async function withStampedModuleDescription(id, form, module) {
  const next = { ...form, _stamp_module: true };
  if (Object.prototype.hasOwnProperty.call(form, 'description')) return next;
  try {
    const current = await getAccount(id);
    next.description = current?.description || '';
  } catch {
    next.description = '';
  }
  return next;
}

export async function listAllAccounts(params = {}) {
  const [accounts, sticky] = await Promise.all([
    fetchAllAccountPages(params),
    fetchStickyAccountRowsFromCompanies(),
  ]);
  const data = mergeAccountRows(accounts, sticky);
  return { data, total: data.length };
}

export async function listAllMatchingAccountIds(params = {}) {
  return listAllMatchingIdsFromListFn(listAccounts, params);
}

export async function listAccounts({
  page = 1,
  page_size = DEFAULT_PAGE_SIZE,
  search,
  owner_id,
  sort_by,
  sort_order,
  filters = {},
  campaignMemberIds,
  includeContactEmails = false,
} = {}) {
  const params = { page, page_size };
  if (search) params.search = search;
  const mergedOwnerId = filters.owner_id || owner_id;
  if (mergedOwnerId) params.owner_id = mergedOwnerId;
  const useMembership = usesCampaignMembershipFilter(filters, campaignMemberIds);
  if (!useMembership && filters.campaign_id) params.campaign_id = filters.campaign_id;
  if (filters.industry) params.industry = filters.industry;
  if (filters.city) params.city = filters.city;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;

  const needsEmailMap = includeContactEmails || !!String(filters.email || '').trim();
  const emailMap = needsEmailMap ? await fetchAccountContactEmailMap() : null;
  const withEmails = (rows) => (
    emailMap
      ? attachContactEmails(rows, emailMap)
      : (rows || []).map((row) => (row?._crm_module ? row : normalizeAccount(row, { defaultModule: 'account' })))
  );

  // Always merge sticky account-module rows so Status/account_type changes do not drop them.
  const sticky = await fetchStickyAccountRowsFromCompanies();
  const needsClientMerge = sticky.length > 0
    || hasAccountClientFilters(filters)
    || useMembership;

  if (needsClientMerge) {
    const allAccounts = withEmails(mergeAccountRows(
      await fetchAllAccountPages({
        search,
        owner_id: mergedOwnerId,
        ...(useMembership ? {} : { campaign_id: filters.campaign_id || undefined }),
        sort_by,
        sort_order,
      }),
      sticky,
    ));
    const filtered = applyAccountRecordFilters(allAccounts, filters, { campaignMemberIds })
      .filter((row) => isAccountModuleRecord(row));
    const start = (page - 1) * page_size;
    return {
      data: filtered.slice(start, start + page_size),
      total: filtered.length,
      meta: { total: filtered.length },
    };
  }

  const res = await api.get('/accounts', { params });
  return {
    data: withEmails(res.data.data || []),
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

export async function countAccounts() {
  const result = await listAccounts({ page: 1, page_size: 1 });
  return result.total ?? result.meta?.total ?? 0;
}

export async function getAccount(id) {
  try {
    const res = await api.get(`/accounts/${id}`);
    return normalizeAccount(res.data.data, { defaultModule: 'account' });
  } catch {
    // Status changes can move the row into /companies while it remains an Account.
    const res = await api.get(`/companies/${id}`);
    return normalizeAccount(res.data.data, { defaultModule: 'account' });
  }
}

function withSavedCurrency(account, form, id) {
  const currency = form.currency || account.currency;
  if (currency) setAccountCurrency(id || account.id, currency);
  if (!account.currency && currency) return { ...account, currency };
  return account;
}

export async function createAccount(form) {
  const res = await api.post('/accounts', toAccountPayload(form, { module: 'account' }));
  const account = normalizeAccount(res.data.data, { defaultModule: 'account' });
  return withSavedCurrency(account, form, account.id);
}

export async function createAccountWithRelations(form) {
  const contactIds = form.contact_ids || [];
  const projectRows = form.projects || [];
  const created = await createAccount(form);

  const today = new Date().toISOString().slice(0, 10);
  await Promise.all([
    ...contactIds.map((contactId) =>
      contactsApi.updateContact(contactId, { account_id: created.id })
    ),
    ...projectRows
      .filter((p) => String(p.name || p.project_name || '').trim())
      .map((p) => projectsApi.createProject({
        name: p.name || p.project_name,
        account_id: created.id,
        start_date: p.start_date || today,
        budget: p.deal_size || p.budget || null,
        status: p.status || 'planning',
      })),
  ]);

  return created;
}

export async function updateAccount(id, form, { module = 'account' } = {}) {
  const stamped = await withStampedModuleDescription(id, form, module);
  try {
    const res = await api.patch(`/accounts/${id}`, toAccountPayload(stamped, { partial: true, module }));
    const account = normalizeAccount(res.data.data, { defaultModule: module });
    invalidateCachedRequest('sticky-account-module-rows');
    return withSavedCurrency(account, form, id);
  } catch (err) {
    // After API re-scopes the row to companies, type/module stamps may still need /accounts.
    throw err;
  }
}

/** Explicit Convert only — moves an Account into the Companies module. */
export async function convertAccountToCompany(id) {
  return updateAccount(id, { account_type: COMPANY_ACCOUNT_TYPE }, { module: 'company' });
}

/** Explicit Convert only — moves a Company into the Accounts module. */
export async function convertCompanyToAccount(id) {
  return updateAccount(id, { account_type: CONFIRMED_ACCOUNT_TYPE }, { module: 'account' });
}

export async function deleteAccount(id) {
  await api.delete(`/accounts/${id}`);
}
