import api from '../api.js';
import { formatEnumLabel, listResult, userBriefName } from '../activityHelpers.js';

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

export async function listAuditLogs(params = {}) {
  const res = await api.get('/audit-logs', { params });
  const result = listResult(res);
  return { ...result, data: result.data.map(normalizeAuditLog) };
}

export async function getEntityTimeline(entityType, entityId, params = {}) {
  const res = await api.get(`/audit-logs/timeline/${entityType}/${entityId}`, { params });
  return (res.data.data || []).map(normalizeAuditLog);
}
