import api from '../api.js';
import { CLOUDTALK_ENABLED } from '../cloudTalkHelpers.js';
import { getStoredCloudTalkCalls } from '../cloudTalkCallLog.js';

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function formatCloudTalkDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function cloudTalkDateRange(days = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { date_from: formatCloudTalkDate(start), date_to: formatCloudTalkDate(end) };
}

export function formatPhoneDisplay(number) {
  if (number == null || number === '') return '';
  const raw = String(number).trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  return `+${raw}`;
}

export function formatCallDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

/** "Name (+number)" when the number resolves to a CRM contact/lead/account; otherwise just the number. */
export function cloudTalkCallTarget(phone, contactName) {
  const phoneLabel = formatPhoneDisplay(phone);
  if (contactName) return phoneLabel ? `${contactName} (${phoneLabel})` : contactName;
  return phoneLabel || 'unknown number';
}

export function cloudTalkCallSummary({
  type,
  status,
  phone,
  contactName,
  duration,
}) {
  const direction = type === 'incoming'
    ? 'Incoming'
    : type === 'outgoing'
      ? 'Outgoing'
      : 'Internal';
  const target = cloudTalkCallTarget(phone, contactName);
  const durationLabel = duration ? ` (${formatCallDuration(duration)})` : '';
  const missedLabel = status === 'missed' ? ' (missed)' : '';
  return `${direction} CloudTalk call with ${target}${durationLabel}${missedLabel}`;
}

function resolveCallStatus(cdr) {
  const talkingTime = Number(cdr.talking_time ?? cdr.billsec) || 0;
  if (cdr.is_voicemail) return 'missed';
  if (talkingTime > 0 || cdr.answered_at) return 'answered';
  return 'missed';
}

export function normalizeCloudTalkCall(record = {}) {
  const cdr = record.Cdr || record.cdr || record;
  const contact = record.Contact || record.contact || {};
  const agent = record.Agent || record.agent || {};
  const callId = cdr.id || cdr.call_uuid || record.call_uuid;
  const type = String(cdr.type || record.direction || 'outgoing').toLowerCase();
  const status = record.status || resolveCallStatus(cdr);
  const phone = cdr.public_external ?? cdr.public_internal ?? record.external_number;
  const duration = Number(cdr.talking_time ?? cdr.billsec ?? record.duration) || 0;
  const createdAt = cdr.started_at || cdr.answered_at || cdr.ended_at || record.ended_at || record.started_at;

  return {
    id: `cloudtalk-${callId}`,
    source: 'cloudtalk',
    action: 'call',
    entity_type: 'cloudtalk_call',
    user_id: record.crm_user_id || null,
    user_name: agent.fullname || agent.name || record.agent_name || record.user_name || 'CloudTalk',
    agent_email: agent.email || record.agent_email || null,
    cloudtalk_user_id: cdr.user_id || agent.id || null,
    created_at: createdAt,
    summary: cloudTalkCallSummary({
      type,
      status,
      phone,
      contactName: contact.name || record.contact_name,
      duration,
    }),
    meta: { cdr, contact, agent },
  };
}

export function normalizeIframeCloudTalkCall({
  callUuid,
  direction,
  externalNumber,
  contactName,
  startedAt,
  endedAt,
  user,
}) {
  const started = startedAt ? new Date(startedAt) : new Date(endedAt || Date.now());
  const ended = endedAt ? new Date(endedAt) : started;
  const duration = Math.max(0, Math.round((ended.getTime() - started.getTime()) / 1000));
  const type = direction === 'incoming' ? 'incoming' : 'outgoing';
  const status = duration > 0 ? 'answered' : 'missed';
  const userName = user
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
    : 'CloudTalk';

  return {
    id: `cloudtalk-local-${callUuid}`,
    source: 'cloudtalk',
    source_kind: 'iframe',
    action: 'call',
    entity_type: 'cloudtalk_call',
    user_id: user?.id || null,
    user_name: userName,
    created_at: ended.toISOString(),
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    summary: cloudTalkCallSummary({
      type,
      status,
      phone: externalNumber,
      contactName,
      duration,
    }),
    meta: {
      call_uuid: callUuid,
      external_number: externalNumber,
      contact_name: contactName,
      duration,
    },
  };
}

function dedupeCloudTalkCalls(calls) {
  const byKey = new Map();

  for (const call of calls) {
    const uuid = call.meta?.call_uuid || call.meta?.cdr?.call_uuid;
    const cdrId = call.meta?.cdr?.id;
    const key = uuid || cdrId || call.id;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, call);
      continue;
    }
    if (existing.source_kind === 'iframe' && call.source_kind !== 'iframe') {
      byKey.set(key, call);
    }
  }

  return Array.from(byKey.values());
}

export function scopeCloudTalkCalls(calls, { user, canSeeAll }) {
  if (canSeeAll) return calls;
  const userId = user?.id;
  const email = String(user?.email || '').toLowerCase();
  return calls.filter((call) => {
    if (userId && call.user_id === userId) return true;
    const agentEmail = String(call.agent_email || '').toLowerCase();
    return email && agentEmail === email;
  });
}

function isSoftCloudTalkApiError(err) {
  const status = err?.response?.status;
  if (!status) return true;
  if (status === 404 || status === 405 || status === 501) return true;
  if (status >= 500) return true;
  return false;
}

function parseCloudTalkPayload(body) {
  const payload = body?.data ?? body?.responseData?.data ?? body?.responseData ?? body ?? [];
  return Array.isArray(payload) ? payload : [];
}

export async function listCloudTalkCallsLastDays(days = 30, params = {}, { limit = 200 } = {}) {
  if (!CLOUDTALK_ENABLED) return [];

  const { date_from, date_to } = cloudTalkDateRange(days);
  const stored = getStoredCloudTalkCalls({ userId: params.user_id, days });
  let remote = [];

  try {
    const res = await api.get('/integrations/cloudtalk/calls', {
      params: {
        ...params,
        date_from,
        date_to,
        limit,
        page: 1,
      },
    });
    remote = parseCloudTalkPayload(res.data).map((record) => normalizeCloudTalkCall(record));
  } catch (err) {
    if (!isSoftCloudTalkApiError(err)) throw err;
  }

  return dedupeCloudTalkCalls([...remote, ...stored.map((entry) => ({ ...entry }))]);
}
