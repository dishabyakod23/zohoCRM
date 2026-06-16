import api from '../api.js';
import { assigneeName, formatEnumLabel, listResult, omitEmpty, toIsoDatetime } from '../activityHelpers.js';

export function normalizeVisit(visit, accountMap = {}) {
  const account = accountMap[visit.account_id];
  return {
    ...visit,
    title: visit.visit_name,
    account_name: account?.label || account?.name,
    status_label: formatEnumLabel(visit.status),
    owner_name: assigneeName(visit),
  };
}

function toVisitPayload(form) {
  return omitEmpty({
    visit_name: form.title ?? form.visit_name,
    visit_date: form.visit_date ? toIsoDatetime(form.visit_date) : undefined,
    status: form.status,
    account_id: form.account_id || null,
    contact_id: form.contact_id || null,
    location: form.location,
    description: form.description,
    owner_id: form.owner_id || null,
  });
}

export async function listVisits(params = {}, accountMap = {}) {
  const res = await api.get('/visits', { params });
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
