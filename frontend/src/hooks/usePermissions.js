'use client';
import { useAuth } from './useAuth.js';
import { getRolePermissions, roleLabel, ROLE_ACCESS, normalizeRole } from '../lib/roles.js';
import { canPermission, resolveUserPermissions, modulePermissionFlags } from '../lib/permissionHelpers.js';
import { canEditRecord, canDeleteRecord, isBusinessRep } from '../lib/recordPermissions.js';

export function usePermissions() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const modulePermissions = resolveUserPermissions(user);
  const permissions = getRolePermissions(role, { modulePermissions });

  const can = (module, action) => canPermission(modulePermissions, module, action);

  return {
    user,
    role,
    roleLabel: roleLabel(role),
    roleAccess: ROLE_ACCESS[role] || '',
    ...permissions,
    modulePermissions,
    can,
    module: (moduleKey) => modulePermissionFlags(modulePermissions, moduleKey),
    isBusinessRep: isBusinessRep(role),
    canEditRecord: (record) => canEditRecord(user, record, permissions),
    canDeleteRecord: (record) => canDeleteRecord(user, record, permissions),
    /** @deprecated use can(module, 'create'|'edit') */
    canEdit: permissions.canEdit,
    canDownload: permissions.canDownload,
  };
}
