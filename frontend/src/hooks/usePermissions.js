'use client';
import { useCallback, useMemo } from 'react';
import { useAuth } from './useAuth.js';
import { getRolePermissions, roleLabel, ROLE_ACCESS, normalizeRole } from '../lib/roles.js';
import { canPermission, resolveUserPermissions, modulePermissionFlags } from '../lib/permissionHelpers.js';
import { canEditRecord, canDeleteRecord, isBusinessRep } from '../lib/recordPermissions.js';

function permissionsStableKey(user) {
  if (!user) return '';
  try {
    return `${user.id || ''}|${user.role || ''}|${JSON.stringify(user.permissions ?? null)}`;
  } catch {
    return `${user.id || ''}|${user.role || ''}`;
  }
}

export function usePermissions() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const permissionsKey = permissionsStableKey(user);

  const modulePermissions = useMemo(
    () => resolveUserPermissions(user),
    // permissionsKey captures id/role/permissions content; user is read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable key
    [permissionsKey],
  );

  const permissions = useMemo(
    () => getRolePermissions(role, { modulePermissions }),
    [role, modulePermissions],
  );

  const can = useCallback(
    (module, action) => canPermission(modulePermissions, module, action),
    [modulePermissions],
  );

  const module = useCallback(
    (moduleKey) => modulePermissionFlags(modulePermissions, moduleKey),
    [modulePermissions],
  );

  const canEditRecordFn = useCallback(
    (record) => canEditRecord(user, record, permissions),
    [user, permissions],
  );

  const canDeleteRecordFn = useCallback(
    (record) => canDeleteRecord(user, record, permissions),
    [user, permissions],
  );

  return {
    user,
    role,
    roleLabel: roleLabel(role),
    roleAccess: ROLE_ACCESS[role] || '',
    ...permissions,
    modulePermissions,
    can,
    module,
    isBusinessRep: isBusinessRep(role),
    canEditRecord: canEditRecordFn,
    canDeleteRecord: canDeleteRecordFn,
    /** @deprecated use can(module, 'create'|'edit') */
    canEdit: permissions.canEdit,
    canDownload: permissions.canDownload,
  };
}
