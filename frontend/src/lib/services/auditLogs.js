import api from '../api.js';
import { formatEnumLabel, listResult, userBriefName } from '../activityHelpers.js';

export function normalizeAuditLog(log) {
  return {
    ...log,
    user_name: userBriefName(log.user),
    action_label: formatEnumLabel(log.action),
    entity_type_label: formatEnumLabel(log.entity_type),
    summary: `${formatEnumLabel(log.action)} ${formatEnumLabel(log.entity_type)}`,
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
