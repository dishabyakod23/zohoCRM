import api from '../api.js';
import { assigneeName, formatEnumLabel, listResult, omitEmpty, toIsoDatetime } from '../activityHelpers.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';

export function normalizeCall(call) {
  const start = call.start_time ?? call.call_start_at;
  return {
    ...call,
    start_time: start ? String(start).slice(0, 16) : '',
    assigned_to: call.assigned_to ?? call.owner_id,
    assigned_name: assigneeName(call) || call.assigned_name,
    call_type_label: formatEnumLabel(call.call_type),
  };
}

function toCallPayload(form, { partial = false } = {}) {
  const payload = omitEmpty({
    subject: form.subject,
    call_type: (form.call_type || '').toLowerCase(),
    status: form.status,
    start_time: form.start_time || form.call_start_at ? toIsoDatetime(form.start_time || form.call_start_at) : undefined,
    duration: form.duration ?? (form.duration_minutes != null && form.duration_minutes !== ''
      ? Number(form.duration_minutes)
      : undefined),
    assigned_to: form.assigned_to || form.assigned_to_id || form.owner_id || null,
    description: form.description,
    related_type: form.related_type || (form.contact_id ? 'contact' : undefined),
    related_id: form.related_id || form.contact_id || null,
  });
  if (!partial && payload.duration == null) payload.duration = 15;
  return payload;
}

export async function listCalls(params = {}) {
  const { page_size, limit, ...rest } = params;
  const res = await api.get('/calls', { params: { ...rest, limit: limit ?? page_size ?? DEFAULT_PAGE_SIZE } });
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
