import api from '../api.js';
import { assigneeName, listResult, omitEmpty } from '../activityHelpers.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import { sequenceStatusLabel, normalizeStepFromApi, normalizeSequenceTimezone, normalizeScheduledTime, buildScheduledAtIso, ensureEmailHtmlBody, htmlToPlainText, isSequenceNameTaken, enrollmentNextActionFromStep, sameScheduleInstant } from '../sequenceHelpers.js';


export function normalizeSequence(row) {
  if (!row) return row;
  return {
    ...row,
    name: row.name,
    status_label: sequenceStatusLabel(row.status),
    owner_name: row.owner_name || assigneeName(row) || '—',
    enrollment_count: row.enrollment_count ?? row.enrolled_count ?? 0,
    active_enrollment_count: row.active_enrollment_count ?? row.active_count ?? 0,
    completed_count: row.completed_count ?? row.completed ?? 0,
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
    status: form.status || undefined,
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

export function toStepPayload(form, { partial = false, sequenceTimezone } = {}) {
  const timezone = normalizeSequenceTimezone(
    form.timezone || sequenceTimezone || 'UTC',
  );
  const scheduled_time = normalizeScheduledTime(form.scheduled_time);
  const scheduled_at = buildScheduledAtIso(form.scheduled_date, scheduled_time, timezone);
  const stepType = form.type;

  const htmlBody = form.html_body != null && form.html_body !== ''
    ? ensureEmailHtmlBody(form.html_body)
    : (partial ? undefined : null);
  const textBody = form.text_body != null && form.text_body !== ''
    ? form.text_body
    : (form.html_body ? htmlToPlainText(form.html_body) : (partial ? undefined : null));

  // Backend 500s (often without CORS → browser "Network Error") if variants are
  // sent on non–A/B steps. Only include variants for AB_EMAIL.
  const variants = stepType === 'AB_EMAIL' && form.variants?.length
    ? form.variants.map((v) => {
      const variantHtml = v.html_body != null && v.html_body !== ''
        ? ensureEmailHtmlBody(v.html_body)
        : null;
      return {
        variant_key: v.variant_key,
        template_id: v.template_id || null,
        subject: v.subject || null,
        html_body: variantHtml,
        text_body: v.text_body || (v.html_body ? htmlToPlainText(v.html_body) : null),
      };
    })
    : undefined;

  const payload = {
    step_order: form.step_order != null ? Number(form.step_order) : undefined,
    type: stepType,
    scheduled_date: form.scheduled_date || null,
    scheduled_time,
    timezone,
    scheduled_at,
    template_id: form.template_id || null,
    subject: form.subject || null,
    html_body: htmlBody,
    text_body: textBody,
    task_title: form.task_title || null,
    task_description: form.task_description || null,
    active: form.active,
    variants,
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

/** Returns an error message when the sequence name is already used, or null if available. */
export async function validateSequenceNameUnique(name, { excludeId } = {}) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  try {
    const result = await listSequences({
      search: trimmed,
      page: 1,
      page_size: Math.max(DEFAULT_PAGE_SIZE, 100),
    });
    if (isSequenceNameTaken(trimmed, result.data || [], { excludeId })) {
      return 'A sequence with this name already exists.';
    }
  } catch {
    // Don't block create/save if the uniqueness lookup fails — API may still reject duplicates.
  }
  return null;
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

/** Mass-update helper — ACTIVE/PAUSED use dedicated endpoints when available. */
export async function updateSequenceStatus(id, status) {
  const next = String(status || '').toUpperCase();
  if (next === 'ACTIVE') return activateSequence(id);
  if (next === 'PAUSED') return pauseSequence(id);
  return updateSequence(id, { status: next });
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

/**
 * After step schedule / send-window changes, push matching next_action_at onto
 * active/paused enrollments (backend does not auto-reschedule).
 */
export async function syncEnrollmentSchedulesFromSteps({
  sequenceId,
  steps = [],
  sequence = {},
  enrollments,
  stepOrders = null,
} = {}) {
  if (!sequenceId || !steps?.length) return { updated: 0, checked: 0 };

  const list = enrollments
    || (await listEnrollments(sequenceId, { page_size: 500 })).data
    || [];
  const stepByOrder = new Map(
    steps
      .filter((s) => s?.step_order != null)
      .map((s) => [Number(s.step_order), s]),
  );
  const allowedOrders = stepOrders?.length
    ? new Set(stepOrders.map(Number))
    : null;

  const targets = list.filter((row) => {
    const status = String(row.status || '').toUpperCase();
    if (status !== 'ACTIVE' && status !== 'PAUSED') return false;
    const order = Number(row.current_step_order);
    if (!Number.isFinite(order) || !stepByOrder.has(order)) return false;
    if (allowedOrders && !allowedOrders.has(order)) return false;
    return true;
  });

  let updated = 0;
  await Promise.all(targets.map(async (row) => {
    const step = stepByOrder.get(Number(row.current_step_order));
    const nextAt = enrollmentNextActionFromStep(step, sequence);
    if (!nextAt) return;
    if (sameScheduleInstant(row.next_action_at, nextAt)) return;
    try {
      await updateEnrollment(row.id, { next_action_at: nextAt });
      updated += 1;
    } catch {
      // best-effort; UI can still refresh and show server values
    }
  }));

  return { updated, checked: targets.length };
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

const STATS_CACHE_PREFIX = 'crm_seq_stats:';
const statsInflight = new Map();

function statsCacheKey(sequenceId) {
  return `${STATS_CACHE_PREFIX}${sequenceId}`;
}

export function readCachedSequenceStats(sequenceId) {
  if (typeof window === 'undefined' || !sequenceId) return null;
  try {
    const raw = sessionStorage.getItem(statsCacheKey(sequenceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.cached_at) return null;
    // Keep for 30 minutes — better to show slightly stale than wait 40s.
    if (Date.now() - parsed.cached_at > 30 * 60 * 1000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeCachedSequenceStats(sequenceId, data) {
  if (typeof window === 'undefined' || !sequenceId || !data) return;
  try {
    sessionStorage.setItem(statsCacheKey(sequenceId), JSON.stringify({
      cached_at: Date.now(),
      data,
    }));
  } catch {
    // ignore quota / private mode
  }
}

/** Build provisional stats from the sequence list/detail payload (instant). */
export function provisionalStatsFromSequence(sequence) {
  if (!sequence) return null;
  return {
    enrolled: sequence.enrollment_count ?? 0,
    enrollment_count: sequence.enrollment_count ?? 0,
    eligible: sequence.active_enrollment_count ?? 0,
    active: sequence.active_enrollment_count ?? 0,
    active_enrollment_count: sequence.active_enrollment_count ?? 0,
    pending: sequence.active_enrollment_count ?? 0,
    pending_count: sequence.active_enrollment_count ?? 0,
    completed: sequence.completed_count ?? 0,
    completed_count: sequence.completed_count ?? 0,
    _provisional: true,
  };
}

export async function getSequenceStats(sequenceId) {
  const res = await api.get(`/sequences/${sequenceId}/stats`);
  const data = res.data.data ?? res.data;
  writeCachedSequenceStats(sequenceId, data);
  return data;
}

/**
 * Deduped stats fetch. Concurrent callers share one in-flight request.
 * Prefetch from the sequence page so Analytics often opens with data ready.
 */
export function prefetchSequenceStats(sequenceId) {
  if (!sequenceId) return Promise.resolve(null);
  if (statsInflight.has(sequenceId)) return statsInflight.get(sequenceId);
  const promise = getSequenceStats(sequenceId)
    .catch((err) => {
      throw err;
    })
    .finally(() => {
      statsInflight.delete(sequenceId);
    });
  statsInflight.set(sequenceId, promise);
  return promise;
}

/**
 * Fast path for email funnel card counts via email-events totals
 * (usually much faster than /stats on large sequences).
 */
export async function getEmailEventCountMap(sequenceId) {
  const keys = ['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED', 'UNSUBSCRIBED'];
  const pairs = await Promise.all(keys.map(async (event_type) => {
    try {
      const result = await listSequenceEmailEvents(sequenceId, {
        event_type,
        page: 1,
        page_size: 1,
      });
      return [event_type, result.total ?? 0];
    } catch {
      return [event_type, null];
    }
  }));
  const counts = Object.fromEntries(pairs);
  return {
    sent: counts.SENT,
    emails_sent: counts.SENT,
    delivered: counts.DELIVERED,
    delivered_count: counts.DELIVERED,
    opened: counts.OPENED,
    open_count: counts.OPENED,
    clicked: counts.CLICKED,
    click_count: counts.CLICKED,
    replied: counts.REPLIED,
    reply_count: counts.REPLIED,
    bounced: counts.BOUNCED,
    bounce_count: counts.BOUNCED,
    unsubscribed: counts.UNSUBSCRIBED,
    unsubscribe_count: counts.UNSUBSCRIBED,
  };
}

export async function getStepStats(sequenceId, stepId) {
  const res = await api.get(`/sequences/${sequenceId}/steps/${stepId}/stats`);
  return res.data.data ?? res.data;
}

export function normalizeEmailEvent(row) {
  if (!row) return row;
  const event_metadata = row.event_metadata ?? row.metadata ?? null;
  const bounceBlob = (event_metadata && typeof event_metadata === 'object')
    ? (event_metadata.bounce || event_metadata.data?.bounce || event_metadata)
    : {};
  const bounce_reason = row.bounce_reason
    ?? bounceBlob.reason
    ?? bounceBlob.message
    ?? null;
  const bounce_type = row.bounce_type ?? bounceBlob.type ?? null;
  const bounce_subtype = row.bounce_subtype
    ?? bounceBlob.subType
    ?? bounceBlob.subtype
    ?? null;
  return {
    ...row,
    id: row.id ?? row.event_id,
    event_type: String(row.event_type || row.type || '').toUpperCase(),
    occurred_at: row.occurred_at ?? row.event_at ?? row.created_at ?? null,
    member_name: row.member_name || row.name || '—',
    member_email: row.member_email || row.email || row.to_email || '—',
    step_order: row.step_order ?? row.stepOrder ?? null,
    subject: row.subject || '—',
    bounce_reason: bounce_reason != null && String(bounce_reason).trim()
      ? String(bounce_reason).trim()
      : null,
    bounce_type: bounce_type != null && String(bounce_type).trim()
      ? String(bounce_type).trim()
      : null,
    bounce_subtype: bounce_subtype != null && String(bounce_subtype).trim()
      ? String(bounce_subtype).trim()
      : null,
    event_metadata,
  };
}

/** List email activity rows for a sequence, filtered by event_type (SENT, OPENED, …). */
export async function listSequenceEmailEvents(sequenceId, params = {}) {
  const { page = 1, page_size = 25, event_type, ...rest } = params;
  const res = await api.get(`/sequences/${sequenceId}/email-events`, {
    params: {
      ...rest,
      event_type,
      page,
      page_size,
    },
  });
  const payload = res.data?.data ?? res.data;
  const rows = Array.isArray(payload)
    ? payload
    : payload?.events || payload?.items || [];
  return {
    data: rows.map(normalizeEmailEvent),
    total: res.data?.meta?.total ?? payload?.total ?? rows.length,
    page: res.data?.meta?.page ?? page,
    page_size: res.data?.meta?.page_size ?? page_size,
  };
}
