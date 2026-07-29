import api, { API_BASE_URL } from '../api.js';
import { formatEnumLabel, userBriefName } from '../activityHelpers.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import {
  listCloudTalkCallsLastDays,
  scopeCloudTalkCalls,
} from './cloudTalkCalls.js';
import {
  enrichActivityLogsWithPhoneNames,
  getCrmPhoneLookup,
} from './phoneDirectory.js';

const AUDIT_LOGS_BASE = `${API_BASE_URL}/audit-logs`;
const HISTORY_BASE = `${API_BASE_URL}/history`;

export function normalizeAuditLog(log) {
  const resolvedUserName = log.user_name || userBriefName(log.user);
  const entityType = log.entity_type || log.record_type;
  return {
    ...log,
    entity_type: entityType,
    user_name: resolvedUserName,
    action_label: log.action_label || formatEnumLabel(log.action),
    entity_type_label: log.entity_type_label || formatEnumLabel(entityType),
    summary: log.summary || `${formatEnumLabel(log.action)} ${formatEnumLabel(entityType)}`,
  };
}

/** Auth/session/sign-in and low-level API noise — not useful in dashboard or activity feeds. */
export function isNoiseAuditLog(log) {
  const action = String(log.action || '').toLowerCase();
  const entityType = String(log.entity_type || log.record_type || '').toLowerCase();
  const summary = String(log.summary || '').toLowerCase();

  if (action.includes('refresh')) return true;
  if (action === 'login' || action === 'logout') return true;
  if (action.includes('sign_in') || action.includes('signin')) return true;
  if (entityType.includes('session')) return true;
  if (/^refreshed\b/.test(summary)) return true;
  if (/\bsigned\s*in\b/.test(summary)) return true;
  if (/\bsign[\s-]?in\b/.test(summary)) return true;
  if (action.includes('api_action') || action.includes('api action')) return true;
  if (/submitted\s+api\s+action/i.test(summary)) return true;
  if (entityType.includes('http_status') || entityType.includes('http status')) return true;
  if (/\bhttp\s+status\b/i.test(summary)) return true;
  if (/\bstatus\s+to\s+\d{3}\b/i.test(summary) && /\bhttp\b/i.test(summary)) return true;
  return false;
}

export function auditLogDateRange(days = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

export async function listAuditLogs(params = {}) {
  const res = await api.get(AUDIT_LOGS_BASE, { params });
  return (res.data.data || []).map(normalizeAuditLog);
}

/** Fetch all audit logs within the last N days (paginated). */
export async function listAuditLogsLastDays(days = 30, params = {}) {
  const { start_at, end_at } = auditLogDateRange(days);
  const pageSize = 100;
  let page = 1;
  let all = [];

  while (page <= 50) {
    const res = await api.get(AUDIT_LOGS_BASE, {
      params: { ...params, page, page_size: pageSize, start_at, end_at },
    });
    const batch = (res.data.data || []).map(normalizeAuditLog);
    const total = res.data.meta?.total ?? all.length + batch.length;
    all = all.concat(batch);
    if (batch.length === 0 || all.length >= total) break;
    page += 1;
  }

  return filterVisibleAuditLogs(all);
}

export function filterVisibleAuditLogs(logs, limit) {
  const filtered = (logs || []).filter((log) => !isNoiseAuditLog(log));
  return limit ? filtered.slice(0, limit) : filtered;
}

export function mergeActivityLogs(auditLogs = [], cloudTalkCalls = []) {
  const merged = [...auditLogs, ...cloudTalkCalls];
  merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return merged;
}

/** Audit logs plus CloudTalk call history for the last N days (full window). */
export async function listActivityLogsLastDays(
  days = 30,
  { user, canSeeAll = false, ...params } = {},
) {
  const scopedParams = canSeeAll ? params : { ...params, user_id: user?.id };
  const [auditLogs, cloudTalkCalls] = await Promise.all([
    listAuditLogsLastDays(days, scopedParams),
    listCloudTalkCallsLastDays(days, scopedParams, { limit: 200 }).catch(() => []),
  ]);

  const scopedCloudTalk = scopeCloudTalkCalls(cloudTalkCalls, { user, canSeeAll });
  const merged = mergeActivityLogs(auditLogs, scopedCloudTalk);

  try {
    const lookup = await getCrmPhoneLookup();
    return enrichActivityLogsWithPhoneNames(merged, lookup);
  } catch {
    return merged;
  }
}

/** Lightweight activity feed for widgets — one audit page, optional phone enrichment. */
export async function listRecentActivityLogs(
  days = 30,
  {
    user,
    canSeeAll = false,
    limit = DEFAULT_PAGE_SIZE,
    enrichPhones = true,
    includeCloudTalk = true,
    cloudTalkLimit = 100,
    ...params
  } = {},
) {
  const scopedParams = canSeeAll ? params : { ...params, user_id: user?.id };
  const { start_at, end_at } = auditLogDateRange(days);
  const auditPageSize = limit ? Math.min(Math.max(limit * 3, limit), 100) : 100;

  const [auditRes, cloudTalkCalls] = await Promise.all([
    api.get(AUDIT_LOGS_BASE, {
      params: {
        ...scopedParams,
        page: 1,
        page_size: auditPageSize,
        start_at,
        end_at,
      },
    }),
    includeCloudTalk
      ? listCloudTalkCallsLastDays(days, scopedParams, { limit: cloudTalkLimit }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const auditLogs = filterVisibleAuditLogs((auditRes.data.data || []).map(normalizeAuditLog));
  const scopedCloudTalk = scopeCloudTalkCalls(cloudTalkCalls, { user, canSeeAll });
  const merged = mergeActivityLogs(auditLogs, scopedCloudTalk);
  const sliced = limit ? merged.slice(0, limit) : merged;

  if (!enrichPhones) return sliced;

  try {
    const lookup = await getCrmPhoneLookup();
    return enrichActivityLogsWithPhoneNames(sliced, lookup);
  } catch {
    return sliced;
  }
}

export async function getEntityTimeline(entityType, entityId, params = {}) {
  const res = await api.get(`${AUDIT_LOGS_BASE}/timeline/${entityType}/${entityId}`, { params });
  return filterVisibleAuditLogs((res.data.data || []).map(normalizeAuditLog));
}

export async function getEntityHistory(entityType, entityId) {
  const res = await api.get(`${HISTORY_BASE}/${entityType}/${entityId}`);
  return filterVisibleAuditLogs((res.data.data || []).map(normalizeAuditLog));
}

export async function listHistory(params = {}) {
  const res = await api.get(HISTORY_BASE, { params });
  return filterVisibleAuditLogs((res.data.data || []).map(normalizeAuditLog));
}
