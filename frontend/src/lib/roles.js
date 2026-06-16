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
  super_admin: 'Full access — manage users, company settings, all CRM data, reports & recycle bin',
  sales_manager: 'Create/edit/delete records, export reports, manage team pipeline',
  sales_rep: 'Create and edit own records (leads, contacts, accounts, deals)',
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
    canQuickCreate: !viewer,
    isSuperAdmin: superAdmin,
    isViewer: viewer,
    isSalesManager: salesManager,
    isSalesRep: salesRep,
  };
}
