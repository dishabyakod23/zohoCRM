import api from '../api.js';
import { assigneeName, listResult, omitEmpty } from '../activityHelpers.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import { sequenceStatusLabel, normalizeStepFromApi, normalizeSequenceTimezone, normalizeScheduledTime, buildScheduledAtIso } from '../sequenceHelpers.js';

export function normalizeSequence(row) {
  if (!row) return row;
  return {
    ...row,
    name: row.name,
    status_label: sequenceStatusLabel(row.status),
    owner_name: assigneeName(row) || row.owner_name,
    enrollment_count: row.enrollment_count ?? row.enrolled_count ?? 0,
    active_enrollment_count: row.active_enrollment_count ?? row.active_count ?? 0,
  };
}

export function normalizeEnrollment(row) {
  if (!row) return row;
  const next_action_at = row.next_action_at ?? row.nextActionAt ?? row.next_action ?? null;
  return {
    ...row,
    id: row.id ?? row.enrollment_id,
    member_name: row.member_name || row.name || '—',
    next_action_at,
  };
}

function toSequencePayload(form, { partial = false } = {}) {
  const payload = {
    name: form.name,
    description: form.description || null,
    sending_email: form.sending_email,
    timezone: form.timezone || 'UTC',
    send_window_start: form.send_window_start || null,
    send_window_end: form.send_window_end || null,
    send_days: form.send_days != null ? Number(form.send_days) : undefined,
    daily_send_limit: form.daily_send_limit != null ? Number(form.daily_send_limit) : undefined,
    hourly_send_limit: form.hourly_send_limit ? Number(form.hourly_send_limit) : null,
    stop_on_reply: form.stop_on_reply,
    stop_on_click: form.stop_on_click,
    stop_on_unsubscribe: form.stop_on_unsubscribe,
    stop_on_bounce: form.stop_on_bounce,
    use_contact_timezone: form.use_contact_timezone,
    allow_re_enrollment: form.allow_re_enrollment,
    owner_id: form.owner_id || null,
  };
  return partial ? omitEmpty(payload) : payload;
}

function toStepPayload(form, { partial = false, sequenceTimezone } = {}) {
  const timezone = normalizeSequenceTimezone(
    form.timezone || sequenceTimezone || 'UTC',
  );
  const scheduled_time = normalizeScheduledTime(form.scheduled_time);
  const scheduled_at = buildScheduledAtIso(form.scheduled_date, scheduled_time, timezone);

  const payload = {
    step_order: form.step_order != null ? Number(form.step_order) : undefined,
    type: form.type,
    scheduled_date: form.scheduled_date || null,
    scheduled_time,
    timezone,
    scheduled_at,
    template_id: form.template_id || null,
    subject: form.subject || null,
    html_body: form.html_body || null,
    text_body: form.text_body || null,
    task_title: form.task_title || null,
    task_description: form.task_description || null,
    active: form.active,
    variants: form.variants?.length ? form.variants.map((v) => ({
      variant_key: v.variant_key,
      template_id: v.template_id || null,
      subject: v.subject || null,
      html_body: v.html_body || null,
      text_body: v.text_body || null,
    })) : undefined,
  };
  return partial ? omitEmpty(payload) : payload;
}

export async function listSequences(params = {}) {
  const { page_size, limit, page, ...rest } = params;
  const res = await api.get('/sequences', {
    params: { ...rest, page, limit: limit ?? page_size ?? DEFAULT_PAGE_SIZE },
  });
  const result = listResult(res);
  return { ...result, data: (result.data || []).map(normalizeSequence) };
}

export async function getSequence(id) {
  const res = await api.get(`/sequences/${id}`);
  const data = res.data.data ?? res.data;
  return normalizeSequence(data);
}

export async function createSequence(form) {
  const res = await api.post('/sequences', toSequencePayload(form));
  return normalizeSequence(res.data.data ?? res.data);
}

export async function updateSequence(id, form) {
  const res = await api.patch(`/sequences/${id}`, toSequencePayload(form, { partial: true }));
  return normalizeSequence(res.data.data ?? res.data);
}

export async function deleteSequence(id) {
  await api.delete(`/sequences/${id}`);
}

export async function activateSequence(id) {
  const res = await api.post(`/sequences/${id}/activate`);
  return normalizeSequence(res.data.data ?? res.data);
}

export async function pauseSequence(id) {
  const res = await api.post(`/sequences/${id}/pause`);
  return normalizeSequence(res.data.data ?? res.data);
}

export async function listSequenceSteps(sequenceId) {
  const res = await api.get(`/sequences/${sequenceId}/steps`);
  const data = res.data.data ?? res.data;
  const rows = Array.isArray(data) ? data : data?.steps || [];
  return rows.map(normalizeStepFromApi);
}

export async function createSequenceStep(sequenceId, form, options = {}) {
  const res = await api.post(`/sequences/${sequenceId}/steps`, toStepPayload(form, options));
  return res.data.data ?? res.data;
}

export async function updateSequenceStep(sequenceId, stepId, form, options = {}) {
  const res = await api.patch(`/sequences/${sequenceId}/steps/${stepId}`, toStepPayload(form, { partial: true, ...options }));
  return res.data.data ?? res.data;
}

export async function deleteSequenceStep(sequenceId, stepId) {
  await api.delete(`/sequences/${sequenceId}/steps/${stepId}`);
}

export async function enrollMembers(sequenceId, members) {
  const res = await api.post(`/sequences/${sequenceId}/enroll`, { members });
  return res.data.data ?? res.data;
}

export async function listEnrollments(sequenceId, params = {}) {
  const res = await api.get(`/sequences/${sequenceId}/enrollments`, { params });
  const data = res.data.data ?? res.data;
  const rows = Array.isArray(data) ? data : data?.enrollments || [];
  return {
    data: rows.map(normalizeEnrollment),
    total: res.data.meta?.total ?? rows.length,
  };
}

export async function updateEnrollment(enrollmentId, payload) {
  const res = await api.patch(`/enrollments/${enrollmentId}`, payload);
  const raw = res.data?.data ?? res.data?.enrollment ?? res.data;
  const merged = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? { ...raw, id: raw.id ?? enrollmentId }
    : { id: enrollmentId };
  const fromApi = normalizeEnrollment(merged);
  if (payload.next_action_at == null) return fromApi;

  const serverAt = fromApi.next_action_at ?? null;
  return {
    ...fromApi,
    next_action_at: serverAt ?? payload.next_action_at,
    __patch: {
      next_action_at: payload.next_action_at,
      serverAt,
    },
  };
}

export async function listMemberEnrollments({ member_type, member_id }) {
  const res = await api.get('/sequences/enrollments/by-member', {
    params: { member_type, member_id },
  });
  const data = res.data.data ?? res.data;
  return (Array.isArray(data) ? data : data?.enrollments || []).map(normalizeEnrollment);
}

export async function previewSequenceStep(sequenceId, payload) {
  const res = await api.post(`/sequences/${sequenceId}/preview`, payload);
  return res.data.data ?? res.data;
}

export async function sendSequenceTest(sequenceId, payload) {
  const res = await api.post(`/sequences/${sequenceId}/send-test`, payload);
  return res.data.data ?? res.data;
}

export async function getSequenceStats(sequenceId) {
  const res = await api.get(`/sequences/${sequenceId}/stats`);
  return res.data.data ?? res.data;
}

export async function getStepStats(sequenceId, stepId) {
  const res = await api.get(`/sequences/${sequenceId}/steps/${stepId}/stats`);
  return res.data.data ?? res.data;
}
