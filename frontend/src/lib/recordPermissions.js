import { normalizeRole } from './roles.js';

/** Resolve owner / assignee id from list or detail API shapes. */
export function recordOwnerId(record) {
  if (!record) return null;
  return (
    record.owner_id
    ?? record.owner?.id
    ?? record.owner?.user_id
    ?? record.owner_user_id
    ?? record.assigned_to
    ?? record.assigned_to_id
    ?? null
  );
}

function emailsMatch(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

export function isRecordOwner(user, record) {
  if (!user || !record) return false;
  const ownerId = recordOwnerId(record);
  if (user.id && ownerId && String(ownerId) === String(user.id)) return true;
  const ownerEmail = record.owner?.email || record.owner_email;
  if (emailsMatch(user.email, ownerEmail)) return true;
  return false;
}

/** Super Admin and Sales Manager share admin-tier record access. */
export function isAdminTier(permissions) {
  return Boolean(permissions?.isSuperAdmin || permissions?.isSalesManager);
}

/** Admins can change any record; others only their own. */
export function canEditRecord(user, record, permissions) {
  if (!permissions?.canEdit || !record) return false;
  if (isAdminTier(permissions)) return true;
  return isRecordOwner(user, record);
}

export function canDeleteRecord(user, record, permissions) {
  if (!permissions?.canDelete || !record) return false;
  if (isAdminTier(permissions)) return true;
  return isRecordOwner(user, record);
}

export function isBusinessRep(role) {
  return normalizeRole(role) === 'sales_rep';
}
