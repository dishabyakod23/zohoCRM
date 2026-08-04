import { DEFAULT_ROLE_MODULE_PERMISSIONS, emptyModulePermissions } from './permissionModules.js';
import { hasAnyModuleAction, hasAnyCrmModuleAction } from './permissionHelpers.js';

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

const CUSTOM_ROLE_LABELS_KEY = 'crm_custom_role_labels';

function readCustomRoleLabels() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_ROLE_LABELS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function cacheCustomRoleLabels(roles = []) {
  if (typeof window === 'undefined') return;
  const map = readCustomRoleLabels();
  for (const role of roles) {
    if (role?.key && role?.name && !role.is_system) map[role.key] = role.name;
  }
  localStorage.setItem(CUSTOM_ROLE_LABELS_KEY, JSON.stringify(map));
}

export function roleLabel(role) {
  const normalized = normalizeRole(role);
  if (ROLE_LABELS[normalized]) return ROLE_LABELS[normalized];
  const custom = readCustomRoleLabels()[normalized];
  if (custom) return custom;
  return normalized?.replace(/_/g, ' ') || '—';
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
 * `modulePermissions` should come from GET /auth/me when available.
 */
export function getRolePermissions(role, { modulePermissions } = {}) {
  const normalized = normalizeRole(role);
  const admin = hasAdminAccess(normalized);
  const salesManager = normalized === 'sales_manager';
  const salesRep = normalized === 'sales_rep';
  const matrix = modulePermissions
    ?? DEFAULT_ROLE_MODULE_PERMISSIONS[normalized]
    ?? emptyModulePermissions();

  const derivedFromMatrix = {
    canEdit: hasAnyCrmModuleAction(matrix, ['edit', 'create']),
    canDelete: hasAnyCrmModuleAction(matrix, ['delete']),
    canDownload: hasAnyModuleAction(matrix, ['export']),
    canManageUsers: Boolean(matrix.settings_users_roles?.view),
    canManageSettings: Boolean(matrix.settings_company_settings?.view),
    canManageWeeklyReports: admin,
    canManagePerformanceReports: admin,
    canAccessReports: Boolean(matrix.reports?.view),
    canBulkDelete: hasAnyCrmModuleAction(matrix, ['delete']),
    canAssignLeads: admin,
    canBulkUpload: hasAnyCrmModuleAction(matrix, ['import']),
    canQuickCreate: hasAnyCrmModuleAction(matrix, ['create']),
    isSuperAdmin: isStrictSuperAdmin(normalized),
    isViewer: normalized === 'viewer' || !hasAnyCrmModuleAction(matrix, ['create', 'edit', 'delete', 'import']),
    isSalesManager: salesManager,
    isSalesRep: salesRep,
  };

  return {
    ...derivedFromMatrix,
    modulePermissions: matrix,
    canManageRoles: isStrictSuperAdmin(normalized),
  };
}
