import { DEFAULT_ROLE_MODULE_PERMISSIONS, emptyModulePermissions } from './permissionModules.js';

/** Roles from GET /admin/users — matches API UserRole enum */
export const USER_ROLES = ['super_admin', 'sales_manager', 'sales_rep', 'viewer'];

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  sales_manager: 'Business Development Manager',
  sales_rep: 'Business Development Executive',
  viewer: 'Viewer',
};

/** Human-readable access summary per role */
export const ROLE_ACCESS = {
  super_admin: 'Full access — manage users, company settings, all CRM data, and reports',
  sales_manager: 'Full access — manage users, company settings, all CRM data, and reports',
  sales_rep: 'View all CRM records; create and edit only records you own',
  viewer: 'Read-only access to CRM modules — no create, edit, or delete',
};

export function roleLabel(role) {
  const normalized = normalizeRole(role);
  return ROLE_LABELS[normalized] || normalized?.replace(/_/g, ' ') || '—';
}

/** Super Admin and Sales Manager share full UI access (API still enforces auth). */
export function hasAdminAccess(role) {
  const normalized = normalizeRole(role);
  return normalized === 'super_admin' || normalized === 'sales_manager';
}

export function isSuperAdmin(role) {
  return hasAdminAccess(role);
}

/** True only for the super_admin role (not sales managers). */
export function isStrictSuperAdmin(role) {
  return normalizeRole(role) === 'super_admin';
}

/** Map legacy / display / API role names to canonical UserRole values */
export function normalizeRole(role) {
  if (!role) return role;
  const key = String(role).toLowerCase().trim().replace(/\s+/g, '_');
  if (key === 'admin' || key === 'superadmin' || key === 'super_admin') return 'super_admin';
  if (key === 'manager' || key === 'sales_manager' || key === 'business_development_manager') return 'sales_manager';
  if (key === 'business_rep' || key === 'rep' || key === 'sales_rep' || key === 'business_development_executive') return 'sales_rep';
  if (key === 'viewer') return 'viewer';
  return key;
}

/** Super Admin and Sales Manager can reassign records to other users */
export function canAssignRecords(role) {
  return hasAdminAccess(role);
}

/**
 * Permission flags used across the UI (API still enforces auth).
 *
 * `customModulePermissions` lets a role created via Manage Roles drive these flags from its
 * own stored matrix instead of the hardcoded defaults below — the 4 built-in roles keep
 * their exact historical behavior (nothing here changed for them) so this is purely additive.
 */
export function getRolePermissions(role, { customModulePermissions } = {}) {
  const normalized = normalizeRole(role);
  const admin = hasAdminAccess(normalized);
  const salesManager = normalized === 'sales_manager';
  const salesRep = normalized === 'sales_rep';
  const viewer = normalized === 'viewer';
  // Any role outside the 4 built-ins is "custom" and must be driven entirely by its stored
  // matrix — falling through to the built-in boolean logic below would treat an unrecognized
  // role like a non-viewer and grant it edit access by accident. Default to fully deny (empty
  // matrix) until the real matrix loads, never to the built-in defaults.
  const isCustomRole = !USER_ROLES.includes(normalized);

  const modulePermissions = isCustomRole
    ? (customModulePermissions || emptyModulePermissions())
    : (DEFAULT_ROLE_MODULE_PERMISSIONS[normalized] || emptyModulePermissions());

  const base = isCustomRole
    ? {
      canEdit: hasAnyModuleAction(modulePermissions, ['edit', 'create']),
      canDelete: hasAnyModuleAction(modulePermissions, ['delete']),
      canDownload: hasAnyModuleAction(modulePermissions, ['export']),
      canManageUsers: Boolean(modulePermissions.settings_users_roles?.view),
      canManageSettings: Boolean(modulePermissions.settings_company_settings?.view),
      canManageWeeklyReports: false,
      canManagePerformanceReports: false,
      canAccessReports: Boolean(modulePermissions.reports?.view),
      canBulkDelete: hasAnyModuleAction(modulePermissions, ['delete']),
      canAssignLeads: false,
      canBulkUpload: hasAnyModuleAction(modulePermissions, ['import']),
      canQuickCreate: hasAnyModuleAction(modulePermissions, ['create']),
      isSuperAdmin: false,
      isViewer: !hasAnyModuleAction(modulePermissions, ['create', 'edit', 'delete', 'import']),
      isSalesManager: false,
      isSalesRep: false,
    }
    : {
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
      canBulkUpload: !viewer,
      canQuickCreate: !viewer,
      isSuperAdmin: admin,
      isViewer: viewer,
      isSalesManager: salesManager,
      isSalesRep: salesRep,
    };

  return {
    ...base,
    modulePermissions,
    canManageRoles: isStrictSuperAdmin(normalized),
  };
}

function hasAnyModuleAction(matrix, actions) {
  if (!matrix) return false;
  return Object.values(matrix).some((row) => actions.some((a) => row?.[a]));
}
