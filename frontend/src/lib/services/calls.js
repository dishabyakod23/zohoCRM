import api from '../api.js';
import { assigneeName, formatEnumLabel, listResult, omitEmpty, toIsoDatetime } from '../activityHelpers.js';

export function normalizeCall(call) {
  return {
    ...call,
    start_time: call.call_start_at,
    assigned_to: call.owner_id,
    assigned_name: assigneeName(call),
    call_type_label: formatEnumLabel(call.call_type),
  };
}

function toCallPayload(form, { partial = false } = {}) {
  const payload = omitEmpty({
    subject: form.subject,
    call_type: (form.call_type || '').toLowerCase(),
    call_start_at: form.start_time || form.call_start_at ? toIsoDatetime(form.start_time || form.call_start_at) : undefined,
    duration_minutes: form.duration_minutes != null && form.duration_minutes !== ''
      ? Number(form.duration_minutes)
      : undefined,
    owner_id: form.assigned_to || form.owner_id || null,
    description: form.description,
    contact_id: form.contact_id || null,
  });
  if (!partial && payload.duration_minutes == null) payload.duration_minutes = 15;
  return payload;
}

export async function listCalls(params = {}) {
  const res = await api.get('/calls', { params });
  const result = listResult(res);
  return { ...result, data: result.data.map(normalizeCall) };
}

export async function getCall(id) {
  const res = await api.get(`/calls/${id}`);
  return normalizeCall(res.data.data);
}

export async function createCall(form) {
  const res = await api.post('/calls', toCallPayload(form));
  return normalizeCall(res.data.data);
}

export async function updateCall(id, form) {
  const res = await api.patch(`/calls/${id}`, toCallPayload(form, { partial: true }));
  return normalizeCall(res.data.data);
}

export async function deleteCall(id) {
  await api.delete(`/calls/${id}`);
}
