import api from '../api.js';
import { assigneeName, formatEnumLabel, listResult, omitEmpty, toIsoDatetime } from '../activityHelpers.js';

export function normalizeVisit(visit) {
  return {
    ...visit,
    title: visit.title ?? visit.visit_name,
    visit_name: visit.visit_name ?? visit.title,
    status_label: formatEnumLabel(visit.status),
    owner_name: assigneeName(visit) || visit.owner_name,
  };
}

function toVisitPayload(form) {
  const relatedType = form.related_type || (form.contact_id ? 'contact' : form.account_id ? 'account' : undefined);
  const relatedId = form.related_id || form.contact_id || form.account_id || null;
  return omitEmpty({
    title: form.title ?? form.visit_name,
    visit_date: form.visit_date ? toIsoDatetime(form.visit_date) : undefined,
    status: form.status,
    related_type: relatedType,
    related_id: relatedId,
    location: form.location,
    description: form.description,
  });
}

export async function listVisits(params = {}, accountMap = {}) {
  const { page_size, limit, ...rest } = params;
  const res = await api.get('/visits', { params: { ...rest, limit: limit ?? page_size ?? rest.limit } });
  const result = listResult(res);
  return { ...result, data: result.data.map((v) => normalizeVisit(v, accountMap)) };
}

export async function getVisit(id, accountMap = {}) {
  const res = await api.get(`/visits/${id}`);
  return normalizeVisit(res.data.data, accountMap);
}

export async function createVisit(form) {
  const res = await api.post('/visits', toVisitPayload(form));
  return normalizeVisit(res.data.data);
}

export async function updateVisit(id, form) {
  const res = await api.patch(`/visits/${id}`, toVisitPayload(form));
  return normalizeVisit(res.data.data);
}

export async function deleteVisit(id) {
  await api.delete(`/visits/${id}`);
}
