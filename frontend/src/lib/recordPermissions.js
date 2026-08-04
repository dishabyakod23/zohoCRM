import { normalizeRole } from './roles.js';

/** Resolve owner / assignee id from list or detail API shapes. */
export function recordOwnerId(record) {
  if (!record) return null;
  return (
    record.owner_id
    ?? record.owner?.id
    ?? record.assigned_to
    ?? record.assigned_to_id
    ?? null
  );
}

export function isRecordOwner(user, record) {
  if (!user?.id || !record) return false;
  const ownerId = recordOwnerId(record);
  if (!ownerId) return false;
  return String(ownerId) === String(user.id);
}

/** Admins can change any record; others only their own. */
export function canEditRecord(user, record, permissions) {
  if (!permissions?.canEdit || !record) return false;
  if (permissions.isSuperAdmin) return true;
  return isRecordOwner(user, record);
}

export function canDeleteRecord(user, record, permissions) {
  if (!permissions?.canDelete || !record) return false;
  if (permissions.isSuperAdmin) return true;
  return isRecordOwner(user, record);
}

export function isBusinessRep(role) {
  return normalizeRole(role) === 'sales_rep';
}
