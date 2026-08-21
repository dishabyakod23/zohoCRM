import api, { API_BASE_URL } from '../api.js';
import { formatEnumLabel, userBriefName } from '../activityHelpers.js';
import { isGenericRoleName, personDisplayName } from '../recordHelpers.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import {
  listCloudTalkCallsLastDays,
  listCloudTalkCallsInRange,
  scopeCloudTalkCalls,
} from './cloudTalkCalls.js';
import {
  enrichActivityLogsWithPhoneNames,
  getCrmPhoneLookup,
} from './phoneDirectory.js';

const AUDIT_LOGS_BASE = `${API_BASE_URL}/audit-logs`;
const HISTORY_BASE = `${API_BASE_URL}/history`;

/**
 * Some audit-log entries return a role label ("Super Admin") instead of the actor's real
 * name in `user_name`. Prefer the nested `user` object (which carries first/last name and
 * email) whenever the flat name is just a role placeholder.
 */
function resolveAuditLogUserName(log) {
  const flatName = log.user_name;
  if (flatName && !isGenericRoleName(flatName)) return flatName;
  const nested = log.user
    ? personDisplayName({
      name: `${log.user.first_name || ''} ${log.user.last_name || ''}`.trim(),
      email: log.user.email,
    })
    : null;
  return nested || flatName || userBriefName(log.user);
}

export function normalizeAuditLog(log) {
  const resolvedUserName = resolveAuditLogUserName(log);
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

export function activityDateRange({ activity_from, activity_to } = {}) {
  if (!activity_from && !activity_to) return auditLogDateRange(30);
  const start = activity_from ? new Date(activity_from) : new Date(0);
  const end = activity_to ? new Date(activity_to) : new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

export function daysBetween(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

export async function listAuditLogs(params = {}) {
  const res = await api.get(AUDIT_LOGS_BASE, { params });
  return (res.data.data || []).map(normalizeAuditLog);
}

/** Fetch all audit logs within the last N days (paginated). */
export async function listAuditLogsLastDays(days = 30, params = {}) {
  return listAuditLogsInRange(auditLogDateRange(days), params);
}

export async function listAuditLogsInRange(
  { start_at, end_at },
  params = {},
  { maxPages = 10, pageSize = 100 } = {},
) {
  const firstRes = await api.get(AUDIT_LOGS_BASE, {
    params: { ...params, page: 1, page_size: pageSize, start_at, end_at },
  });
  const firstBatch = (firstRes.data.data || []).map(normalizeAuditLog);
  const total = firstRes.data.meta?.total ?? firstBatch.length;
  if (!firstBatch.length || firstBatch.length >= total || maxPages <= 1) {
    return filterVisibleAuditLogs(firstBatch);
  }

  const totalPages = Math.min(maxPages, Math.ceil(total / pageSize));
  const pageNumbers = [];
  for (let page = 2; page <= totalPages; page += 1) pageNumbers.push(page);

  // Fetch remaining pages in parallel batches to avoid long sequential waits.
  const PARALLEL = 4;
  const rest = [];
  for (let i = 0; i < pageNumbers.length; i += PARALLEL) {
    const chunk = pageNumbers.slice(i, i + PARALLEL);
    const batches = await Promise.all(chunk.map(async (page) => {
      const res = await api.get(AUDIT_LOGS_BASE, {
        params: { ...params, page, page_size: pageSize, start_at, end_at },
      });
      return (res.data.data || []).map(normalizeAuditLog);
    }));
    rest.push(...batches.flat());
    if (firstBatch.length + rest.length >= total) break;
  }

  return filterVisibleAuditLogs([...firstBatch, ...rest]);
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

/** Audit logs plus CloudTalk call history for a date window (full window). */
export async function listActivityLogsLastDays(
  days = 30,
  {
    user,
    canSeeAll = false,
    activity_from,
    activity_to,
    enrichPhones = true,
    cloudTalkLimit = 100,
    maxAuditPages = 8,
    ...params
  } = {},
) {
  const scopedParams = canSeeAll ? params : { ...params, user_id: user?.id };
  const range = activity_from || activity_to
    ? activityDateRange({ activity_from, activity_to })
    : auditLogDateRange(days);
  const windowDays = daysBetween(range.start_at, range.end_at);

  // Kick off phone lookup in parallel with log fetches (was sequential before).
  const phoneLookupPromise = enrichPhones
    ? getCrmPhoneLookup().catch(() => null)
    : Promise.resolve(null);

  const [auditLogs, cloudTalkCalls, lookup] = await Promise.all([
    listAuditLogsInRange(range, scopedParams, { maxPages: maxAuditPages }).catch(() => []),
    listCloudTalkCallsInRange(range, scopedParams, { limit: cloudTalkLimit, days: windowDays }).catch(() => []),
    phoneLookupPromise,
  ]);

  const scopedCloudTalk = scopeCloudTalkCalls(cloudTalkCalls, { user, canSeeAll });
  const merged = mergeActivityLogs(auditLogs, scopedCloudTalk);
  if (!lookup) return merged;
  return enrichActivityLogsWithPhoneNames(merged, lookup);
}

/** Enrich already-loaded activity rows with CRM phone names (background pass). */
export async function enrichLoadedActivityLogs(logs) {
  if (!logs?.length) return logs || [];
  try {
    // Contacts + leads are enough for call name resolution; skip accounts for speed.
    const lookup = await getCrmPhoneLookup({ includeAccounts: false });
    return enrichActivityLogsWithPhoneNames(logs, lookup);
  } catch {
    return logs;
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

  const [auditRes, cloudTalkCalls, lookup] = await Promise.all([
    api.get(AUDIT_LOGS_BASE, {
      params: {
        ...scopedParams,
        page: 1,
        page_size: auditPageSize,
        start_at,
        end_at,
      },
    }).catch(() => ({ data: { data: [] } })),
    includeCloudTalk
      ? listCloudTalkCallsLastDays(days, scopedParams, { limit: cloudTalkLimit }).catch(() => [])
      : Promise.resolve([]),
    enrichPhones ? getCrmPhoneLookup().catch(() => null) : Promise.resolve(null),
  ]);

  const auditLogs = filterVisibleAuditLogs((auditRes.data.data || []).map(normalizeAuditLog));
  const scopedCloudTalk = scopeCloudTalkCalls(cloudTalkCalls, { user, canSeeAll });
  const merged = mergeActivityLogs(auditLogs, scopedCloudTalk);
  const sliced = limit ? merged.slice(0, limit) : merged;

  if (!lookup) return sliced;
  return enrichActivityLogsWithPhoneNames(sliced, lookup);
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
