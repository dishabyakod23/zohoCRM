import api from '../api.js';
import { normalizeContact, toContactPayload } from '../contactHelpers.js';

export async function listContacts({ page = 1, page_size = 15, search, account_id, owner_id, sort_by, sort_order } = {}, accountMap = {}) {
  const params = { page, page_size };
  if (search) params.search = search;
  if (account_id) params.account_id = account_id;
  if (owner_id) params.owner_id = owner_id;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;

  const res = await api.get('/contacts', { params });
  return {
    data: (res.data.data || []).map(c => normalizeContact(c, accountMap)),
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

export async function getContact(id, accountMap = {}) {
  const res = await api.get(`/contacts/${id}`);
  return normalizeContact(res.data.data, accountMap);
}

export async function createContact(form) {
  const res = await api.post('/contacts', toContactPayload(form));
  return normalizeContact(res.data.data);
}

export async function updateContact(id, form) {
  const res = await api.patch(`/contacts/${id}`, toContactPayload(form, { partial: true }));
  return normalizeContact(res.data.data);
}

export async function deleteContact(id) {
  await api.delete(`/contacts/${id}`);
}
