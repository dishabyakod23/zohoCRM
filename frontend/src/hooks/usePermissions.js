'use client';
import { useEffect, useState } from 'react';
import { useAuth } from './useAuth.js';
import { getRolePermissions, roleLabel, ROLE_ACCESS, normalizeRole, USER_ROLES } from '../lib/roles.js';
import { canEditRecord, canDeleteRecord, isBusinessRep } from '../lib/recordPermissions.js';
import { getCustomRoleModulePermissions } from '../lib/services/manageRoles.js';

export function usePermissions() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const isCustomRole = Boolean(role) && !USER_ROLES.includes(role);
  const [customModulePermissions, setCustomModulePermissions] = useState(null);

  // Roles created via Manage Roles aren't in the hardcoded USER_ROLES list, so their module
  // permission matrix has to be resolved from the roles store before they mean anything here.
  useEffect(() => {
    if (!isCustomRole) {
      setCustomModulePermissions(null);
      return;
    }
    let active = true;
    getCustomRoleModulePermissions(role).then((matrix) => {
      if (active) setCustomModulePermissions(matrix);
    }).catch(() => {
      if (active) setCustomModulePermissions(null);
    });
    return () => { active = false; };
  }, [isCustomRole, role]);

  const permissions = getRolePermissions(role, {
    customModulePermissions: isCustomRole ? customModulePermissions : null,
  });

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
