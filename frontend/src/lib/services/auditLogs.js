import api, { API_BASE_URL } from '../api.js';
import { formatEnumLabel, userBriefName } from '../activityHelpers.js';

const AUDIT_LOGS_BASE = `${API_BASE_URL}/audit-logs`;

export function normalizeAuditLog(log) {
  const resolvedUserName = log.user_name || userBriefName(log.user);
  const entityType = log.entity_type || log.record_type;
  return {
    ...log,
    entity_type: entityType,
    user_name: resolvedUserName,
    action_label: formatEnumLabel(log.action),
    entity_type_label: formatEnumLabel(entityType),
    summary: `${formatEnumLabel(log.action)} ${formatEnumLabel(entityType)}`,
  };
}

export async function getEntityTimeline(entityType, entityId, params = {}) {
  const res = await api.get(`${AUDIT_LOGS_BASE}/timeline/${entityType}/${entityId}`, { params });
  return (res.data.data || []).map(normalizeAuditLog);
}

export async function listAuditLogs(params = {}) {
  const res = await api.get(AUDIT_LOGS_BASE, { params });
  return (res.data.data || []).map(normalizeAuditLog);
}
