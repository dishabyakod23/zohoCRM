import api from '../api.js';
import { normalizeAccount, toAccountPayload } from '../accountHelpers.js';
import * as contactsApi from './contacts.js';
import * as projectsApi from './projects.js';
import {
  applyAccountRecordFilters,
  hasAccountClientFilters,
} from '../listRecordFilters.js';

async function fetchAccountContactEmailMap() {
  const pageSize = 100;
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
}

function attachContactEmails(accounts, emailMap) {
  return (accounts || []).map((account) => ({
    ...account,
    email: account.email || emailMap.get(account.id) || null,
  }));
}

async function fetchAllAccountPages(params) {
  const pageSize = 100;
  let page = 1;
  let all = [];
  let serverTotal = 0;

  while (page <= 50) {
    const res = await api.get('/accounts', { params: { ...params, page, page_size: pageSize } });
    const batch = (res.data.data || []).map(normalizeAccount);
    serverTotal = res.data.meta?.total ?? all.length + batch.length;
    all = all.concat(batch);
    if (batch.length === 0 || all.length >= serverTotal) break;
    page += 1;
  }

  return all;
}

export async function listAccounts({
  page = 1,
  page_size = 15,
  search,
  owner_id,
  sort_by,
  sort_order,
  filters = {},
} = {}) {
  const params = { page, page_size };
  if (search) params.search = search;
  const mergedOwnerId = filters.owner_id || owner_id;
  if (mergedOwnerId) params.owner_id = mergedOwnerId;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;

  const emailMap = await fetchAccountContactEmailMap();

  if (hasAccountClientFilters(filters)) {
    const allAccounts = attachContactEmails(await fetchAllAccountPages({
      search,
      owner_id: mergedOwnerId,
      sort_by,
      sort_order,
    }), emailMap);
    const filtered = applyAccountRecordFilters(allAccounts, filters);
    const start = (page - 1) * page_size;
    return {
      data: filtered.slice(start, start + page_size),
      total: filtered.length,
      meta: { total: filtered.length },
    };
  }

  const res = await api.get('/accounts', { params });
  return {
    data: attachContactEmails((res.data.data || []).map(normalizeAccount), emailMap),
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

export async function getAccount(id) {
  const res = await api.get(`/accounts/${id}`);
  return normalizeAccount(res.data.data);
}

export async function createAccount(form) {
  const res = await api.post('/accounts', toAccountPayload(form));
  return normalizeAccount(res.data.data);
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

export async function updateAccount(id, form) {
  const res = await api.patch(`/accounts/${id}`, toAccountPayload(form, { partial: true }));
  return normalizeAccount(res.data.data);
}

export async function deleteAccount(id) {
  await api.delete(`/accounts/${id}`);
}
