/** Roles from GET /admin/users — matches API UserRole enum */
export const USER_ROLES = ['super_admin', 'sales_manager', 'sales_rep', 'viewer'];

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  sales_manager: 'Sales Manager',
  sales_rep: 'Sales Rep',
  viewer: 'Viewer',
};

/** Human-readable access summary per role */
export const ROLE_ACCESS = {
  super_admin: 'Full access — manage users, settings, and reports; delete/restore only your own records',
  sales_manager: 'Create/edit team records — delete and restore only your own',
  sales_rep: 'View all CRM data — edit and convert only records you created',
  viewer: 'Read-only access to CRM modules — no create, edit, or delete',
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role?.replace(/_/g, ' ') || '—';
}

export function isSuperAdmin(role) {
  return role === 'super_admin';
}

/** Permission flags used across the UI (backend still enforces API auth) */
export function getRolePermissions(role) {
  const superAdmin = role === 'super_admin';
  const salesManager = role === 'sales_manager';
  const salesRep = role === 'sales_rep';
  const viewer = role === 'viewer';

  return {
    canEdit: !viewer,
    canDelete: !viewer,
    canDownload: superAdmin || salesManager,
    canManageUsers: superAdmin,
    canManageSettings: superAdmin,
    canManageWeeklyReports: superAdmin,
    canAccessReports: !viewer,
    canBulkDelete: superAdmin || salesManager,
    canAssignLeads: superAdmin || salesManager,
    canQuickCreate: !viewer,
    isSuperAdmin: superAdmin,
    isViewer: viewer,
    isSalesManager: salesManager,
    isSalesRep: salesRep,
  };
}

/** Sales reps may view all records but only modify ones they created. */
export function canModifyCreatedRecord(record, user, role) {
  const permissions = getRolePermissions(role);
  if (!permissions.canEdit) return false;
  if (permissions.isSuperAdmin || permissions.isSalesManager) return true;
  if (permissions.isSalesRep) {
    if (!record?.created_by || !user?.id) return false;
    return String(record.created_by) === String(user.id);
  }
  return permissions.canEdit;
}

/** Only the creator may delete a record. */
export function canDeleteCreatedRecord(record, user, role) {
  const permissions = getRolePermissions(role);
  if (!permissions.canDelete) return false;
  if (!record?.created_by || !user?.id) return false;
  return String(record.created_by) === String(user.id);
}

/** Only the user who deleted a record may restore or permanently remove it. */
export function canManageRecycleItem(item, user, role) {
  const permissions = getRolePermissions(role);
  if (!permissions.canDelete) return false;
  if (!item?.deleted_by || !user?.id) return false;
  return String(item.deleted_by) === String(user.id);
}
