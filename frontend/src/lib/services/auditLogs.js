import api, { API_BASE_URL } from '../api.js';
import { formatEnumLabel, userBriefName } from '../activityHelpers.js';

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

/** Auth/session/sign-in noise — not useful in dashboard or activity feeds. */
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
