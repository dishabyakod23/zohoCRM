/** Roles from GET /admin/users — matches API UserRole enum */
export const USER_ROLES = ['super_admin', 'sales_manager', 'sales_rep', 'viewer'];

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  sales_manager: 'Sales Manager',
  sales_rep: 'Business Rep',
  viewer: 'Viewer',
};

/** Human-readable access summary per role */
export const ROLE_ACCESS = {
  super_admin: 'Full access — manage users, company settings, all CRM data, and reports',
  sales_manager: 'Full access — manage users, company settings, all CRM data, and reports',
  sales_rep: 'Create and edit own records (leads, contacts, accounts, deals)',
  viewer: 'Read-only access to CRM modules — no create, edit, or delete',
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role?.replace(/_/g, ' ') || '—';
}

/** Super Admin and Sales Manager share full UI access (API still enforces auth). */
export function hasAdminAccess(role) {
  const normalized = normalizeRole(role);
  return normalized === 'super_admin' || normalized === 'sales_manager';
}

export function isSuperAdmin(role) {
  return hasAdminAccess(role);
}

/** Map legacy / display role names to API UserRole values */
export function normalizeRole(role) {
  if (!role) return role;
  const key = String(role).toLowerCase().trim().replace(/\s+/g, '_');
  if (key === 'admin' || key === 'superadmin' || key === 'super_admin') return 'super_admin';
  if (key === 'manager' || key === 'sales_manager') return 'sales_manager';
  if (key === 'rep' || key === 'sales_rep') return 'sales_rep';
  return role;
}

/** Super Admin and Sales Manager can reassign records to other users */
export function canAssignRecords(role) {
  return hasAdminAccess(role);
}

/** Permission flags used across the UI (API still enforces auth) */
export function getRolePermissions(role) {
  const normalized = normalizeRole(role);
  const admin = hasAdminAccess(normalized);
  const salesManager = normalized === 'sales_manager';
  const salesRep = normalized === 'sales_rep';
  const viewer = normalized === 'viewer';

  return {
    canEdit: !viewer,
    canDelete: !viewer,
    canDownload: admin,
    canManageUsers: admin,
    canManageSettings: admin,
    canManageWeeklyReports: admin,
    canManagePerformanceReports: admin,
    canAccessReports: !viewer,
    canBulkDelete: admin,
    canAssignLeads: admin,
    canQuickCreate: !viewer,
    isSuperAdmin: admin,
    isViewer: viewer,
    isSalesManager: salesManager,
    isSalesRep: salesRep,
  };
}
