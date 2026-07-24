'use client';
import { useAuth } from './useAuth.js';
import { getRolePermissions, roleLabel, ROLE_ACCESS, normalizeRole } from '../lib/roles.js';

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
    /** @deprecated use canDownload from permissions */
    canEdit: permissions.canEdit,
    canDownload: permissions.canDownload,
  };
}
