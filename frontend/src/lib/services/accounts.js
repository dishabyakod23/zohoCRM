import api from '../api.js';
import { normalizeAccount, toAccountPayload } from '../accountHelpers.js';
import * as contactsApi from './contacts.js';
import * as projectsApi from './projects.js';

export async function listAccounts({ page = 1, page_size = 15, search, owner_id, sort_by, sort_order } = {}) {
  const params = { page, page_size };
  if (search) params.search = search;
  if (owner_id) params.owner_id = owner_id;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;

  const res = await api.get('/accounts', { params });
  return {
    data: (res.data.data || []).map(normalizeAccount),
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
