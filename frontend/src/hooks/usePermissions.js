'use client';
import { useAuth } from './useAuth.js';
import { getRolePermissions, roleLabel, ROLE_ACCESS, normalizeRole } from '../lib/roles.js';
import { canEditRecord, canDeleteRecord, isBusinessRep } from '../lib/recordPermissions.js';

export function usePermissions() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const permissions = getRolePermissions(role);

  return {
    user,
    role,
    roleLabel: roleLabel(role),
    roleAccess: ROLE_ACCESS[role] || '',
    ...permissions,
    isBusinessRep: isBusinessRep(role),
    canEditRecord: (record) => canEditRecord(user, record, permissions),
    canDeleteRecord: (record) => canDeleteRecord(user, record, permissions),
    /** @deprecated use canDownload from permissions */
    canEdit: permissions.canEdit,
    canDownload: permissions.canDownload,
  };
}
