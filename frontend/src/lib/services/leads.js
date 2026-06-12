import api from '../api.js';
import { normalizeLead, toLeadPayload } from '../leadHelpers.js';
import { toConvertPayload } from '../dealHelpers.js';

export async function listLeads({ page = 1, page_size = 15, search, lead_status, owner_id, sort_by, sort_order } = {}) {
  const params = { page, page_size };
  if (search) params.search = search;
  if (lead_status) params.lead_status = lead_status;
  if (owner_id) params.owner_id = owner_id;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;

  const res = await api.get('/leads', { params });
  return {
    data: (res.data.data || []).map(normalizeLead),
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

export async function getLead(id) {
  const res = await api.get(`/leads/${id}`);
  return normalizeLead(res.data.data);
}

export async function createLead(form) {
  const res = await api.post('/leads', toLeadPayload(form));
  return normalizeLead(res.data.data);
}

export async function updateLead(id, form) {
  const res = await api.patch(`/leads/${id}`, toLeadPayload(form, { partial: true }));
  return normalizeLead(res.data.data);
}

export async function deleteLead(id) {
  await api.delete(`/leads/${id}`);
}

export async function bulkDeleteLeads(ids) {
  const res = await api.post('/leads/bulk-delete', { ids });
  return res.data.data;
}

export async function convertLead(id, form) {
  const res = await api.post(`/leads/${id}/convert`, toConvertPayload(form));
  return res.data.data;
}

export async function listLeadNotes(id) {
  const res = await api.get(`/leads/${id}/notes`);
  return res.data.data || [];
}

export async function createLeadNote(id, body) {
  const res = await api.post(`/leads/${id}/notes`, { body });
  return res.data.data;
}

export async function deleteLeadNote(leadId, noteId) {
  await api.delete(`/leads/${leadId}/notes/${noteId}`);
}

export async function listLeadAttachments(id) {
  const res = await api.get(`/leads/${id}/attachments`);
  return res.data.data || [];
}
