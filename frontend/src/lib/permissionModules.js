/**
 * Data-driven module/action permission model — the foundation for Manage Roles.
 * A "module permission matrix" is { [moduleKey]: { view, create, edit, delete, import, export } }.
 * Built-in roles get a default matrix here; custom roles created via Manage Roles store
 * their own matrix (see services/manageRoles.js) using this exact same shape.
 */

export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'import', 'export'];

/** All action keys used across modules (includes backend-specific names). */
export const ALL_MODULE_ACTIONS = [
  ...PERMISSION_ACTIONS,
  'restore',
  'permanent_delete',
  'upload',
  'download',
];

export const ACTION_LABELS = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  import: 'Import',
  export: 'Export',
  restore: 'Restore',
  permanent_delete: 'Permanent Delete',
  upload: 'Upload',
  download: 'Download',
};

/** Screens/modules a role can be granted access to, and which actions apply to each. */
export const PERMISSION_MODULES = [
  { key: 'home', label: 'Home', actions: ['view'] },
  { key: 'work_items', label: 'Work Items', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { key: 'reports', label: 'Reports', actions: ['view', 'export'] },
  { key: 'recycle_bin', label: 'Recycle Bin', actions: ['view', 'restore', 'permanent_delete'] },
  { key: 'contacts', label: 'Contacts', actions: ['view', 'create', 'edit', 'delete', 'import', 'export'] },
  { key: 'raw_leads', label: 'Raw Leads', actions: ['view', 'create', 'edit', 'delete', 'import', 'export'] },
  { key: 'leads', label: 'Leads', actions: ['view', 'create', 'edit', 'delete', 'import', 'export'] },
  { key: 'qualified_leads', label: 'Qualified Leads', actions: ['view', 'create', 'edit', 'delete', 'import', 'export'] },
  { key: 'proposals', label: 'Proposals', actions: ['view', 'create', 'edit', 'delete', 'import', 'export'] },
  { key: 'companies', label: 'Companies', actions: ['view', 'create', 'edit', 'delete', 'import', 'export'] },
  { key: 'accounts', label: 'Accounts', actions: ['view', 'create', 'edit', 'delete', 'import', 'export'] },
  { key: 'deals', label: 'Deals', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { key: 'calendar', label: 'Calendar', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'campaigns', label: 'Campaigns', actions: ['view', 'create', 'edit', 'delete', 'import', 'export'] },
  { key: 'calls', label: 'Calls', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { key: 'tasks', label: 'Tasks', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'meetings', label: 'Meetings', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'documents', label: 'Documents', actions: ['view', 'upload', 'edit', 'delete', 'download'] },
  { key: 'projects', label: 'Projects', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'visits', label: 'Visits', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'settings_my_profile', label: 'Settings — My Profile', actions: ['view', 'edit'] },
  { key: 'settings_users_roles', label: 'Settings — Users & Roles', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'settings_manage_roles', label: 'Settings — Manage Roles', actions: ['view', 'create', 'edit', 'delete'], superAdminOnly: true },
  { key: 'settings_lead_statuses', label: 'Settings — Lead Statuses', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'settings_company_settings', label: 'Settings — Company Settings', actions: ['view', 'edit'] },
  { key: 'settings_sales_targets', label: 'Settings — Pipeline & Revenue Targets', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { key: 'settings_announcements', label: 'Settings — Announcements', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'audit_logs', label: 'Audit Logs', actions: ['view', 'export'] },
];

const MODULE_BY_KEY = new Map(PERMISSION_MODULES.map((m) => [m.key, m]));

/** All-false matrix, one entry per module. */
export function emptyModulePermissions() {
  const matrix = {};
  for (const mod of PERMISSION_MODULES) {
    matrix[mod.key] = Object.fromEntries(ALL_MODULE_ACTIONS.map((a) => [a, false]));
  }
  return matrix;
}

/** All-true (for every action a module actually supports) matrix — used by Super Admin. */
export function fullModulePermissions() {
  const matrix = emptyModulePermissions();
  for (const mod of PERMISSION_MODULES) {
    for (const action of mod.actions) matrix[mod.key][action] = true;
  }
  return matrix;
}

/**
 * Build a matrix from a sparse `{ moduleKey: ['view','edit',...] }` shorthand, useful for
 * defining default role templates concisely. Unlisted modules are left at all-false.
 */
function fromShorthand(shorthand) {
  const matrix = emptyModulePermissions();
  for (const [key, actions] of Object.entries(shorthand)) {
    const mod = getModuleDef(key);
    if (!matrix[key] || !mod) continue;
    for (const action of actions) {
      if (mod.actions.includes(action)) matrix[key][action] = true;
    }
  }
  return applyPermissionDependencies(matrix);
}

/**
 * Enforce dependency rules on a matrix and return a corrected copy:
 *  - Create/Edit/Delete/Import/Export on a module implies View on that module.
 *  - Import on a module implies Create on that module.
 */
export function applyPermissionDependencies(matrix) {
  const next = {};
  for (const mod of PERMISSION_MODULES) {
    const row = { ...emptyModulePermissions()[mod.key], ...(matrix[mod.key] || {}) };
    if (row.import) row.create = true;
    const impliesView = row.create || row.edit || row.delete || row.import || row.export
      || row.restore || row.permanent_delete || row.upload || row.download;
    if (impliesView) row.view = true;
    next[mod.key] = row;
  }
  return next;
}

/** Map legacy UI action keys from older matrices to backend API keys. */
export function normalizeApiPermissions(raw) {
  if (!raw || typeof raw !== 'object') return emptyModulePermissions();
  const matrix = { ...raw };

  if (matrix.recycle_bin) {
    const row = { ...matrix.recycle_bin };
    if (row.edit && !row.restore) row.restore = row.edit;
    if (row.delete && !row.permanent_delete) row.permanent_delete = row.delete;
    matrix.recycle_bin = row;
  }

  if (matrix.documents) {
    const row = { ...matrix.documents };
    if (row.create && !row.upload) row.upload = row.create;
    if (row.export && !row.download) row.download = row.export;
    matrix.documents = row;
  }

  return applyPermissionDependencies(matrix);
}

/** Keep only actions each module supports before POST/PATCH /admin/roles. */
export function serializePermissionsForApi(matrix) {
  const normalized = applyPermissionDependencies(matrix || {});
  const next = {};
  for (const mod of PERMISSION_MODULES) {
    const row = normalized[mod.key] || {};
    const apiRow = {};
    for (const action of mod.actions) {
      apiRow[action] = Boolean(row[action]);
    }
    next[mod.key] = apiRow;
  }
  return next;
}

/** Default matrices for the 4 built-in system roles — kept in sync with legacy getRolePermissions(). */
export const DEFAULT_ROLE_MODULE_PERMISSIONS = {
  super_admin: fullModulePermissions(),

  // Business Development Manager — broad operational access, no role management.
  sales_manager: fromShorthand({
    home: ['view'],
    work_items: ['view', 'create', 'edit', 'delete', 'export'],
    reports: ['view', 'export'],
    recycle_bin: ['view', 'restore', 'permanent_delete'],
    contacts: ['view', 'create', 'edit', 'delete', 'import', 'export'],
    raw_leads: ['view', 'create', 'edit', 'delete', 'import', 'export'],
    leads: ['view', 'create', 'edit', 'delete', 'import', 'export'],
    qualified_leads: ['view', 'create', 'edit', 'delete', 'import', 'export'],
    proposals: ['view', 'create', 'edit', 'delete', 'import', 'export'],
    companies: ['view', 'create', 'edit', 'delete', 'import', 'export'],
    accounts: ['view', 'create', 'edit', 'delete', 'import', 'export'],
    deals: ['view', 'create', 'edit', 'delete', 'export'],
    calendar: ['view', 'create', 'edit', 'delete'],
    campaigns: ['view', 'create', 'edit', 'delete', 'import', 'export'],
    calls: ['view', 'create', 'edit', 'delete', 'export'],
    tasks: ['view', 'create', 'edit', 'delete'],
    meetings: ['view', 'create', 'edit', 'delete'],
    documents: ['view', 'upload', 'edit', 'delete', 'download'],
    projects: ['view', 'create', 'edit', 'delete'],
    visits: ['view', 'create', 'edit', 'delete'],
    settings_my_profile: ['view', 'edit'],
    settings_users_roles: ['view', 'create', 'edit', 'delete'],
    settings_lead_statuses: ['view', 'create', 'edit', 'delete'],
    settings_company_settings: ['view', 'edit'],
    settings_sales_targets: ['view', 'create', 'edit', 'export'],
    settings_announcements: ['view', 'create', 'edit', 'delete'],
    audit_logs: ['view', 'export'],
  }),

  // Business Development Executive — day-to-day sales modules, limited create/edit, no delete/export.
  sales_rep: fromShorthand({
    home: ['view'],
    work_items: ['view', 'create', 'edit'],
    reports: ['view'],
    contacts: ['view', 'create', 'edit'],
    raw_leads: ['view', 'create', 'edit'],
    leads: ['view', 'create', 'edit'],
    qualified_leads: ['view', 'create', 'edit'],
    proposals: ['view', 'create', 'edit'],
    companies: ['view', 'create', 'edit'],
    accounts: ['view', 'create', 'edit'],
    deals: ['view', 'create', 'edit'],
    calendar: ['view', 'create', 'edit', 'delete'],
    campaigns: ['view'],
    calls: ['view', 'create', 'edit'],
    tasks: ['view', 'create', 'edit', 'delete'],
    meetings: ['view', 'create', 'edit', 'delete'],
    documents: ['view', 'upload'],
    projects: ['view'],
    visits: ['view', 'create', 'edit'],
    settings_my_profile: ['view', 'edit'],
    settings_sales_targets: ['view'],
  }),

  // Read-only across every permitted module — no create, edit, delete, import, or export.
  viewer: fromShorthand({
    home: ['view'],
    work_items: ['view'],
    reports: ['view'],
    contacts: ['view'],
    raw_leads: ['view'],
    leads: ['view'],
    qualified_leads: ['view'],
    proposals: ['view'],
    companies: ['view'],
    accounts: ['view'],
    deals: ['view'],
    calendar: ['view'],
    campaigns: ['view'],
    calls: ['view'],
    tasks: ['view'],
    meetings: ['view'],
    documents: ['view'],
    projects: ['view'],
    visits: ['view'],
    settings_my_profile: ['view', 'edit'],
  }),
};

/** System roles that can never be deleted and whose key can't be reused for a custom role. */
export const PROTECTED_ROLE_KEYS = ['super_admin', 'sales_manager', 'sales_rep', 'viewer'];

export function isProtectedRoleKey(key) {
  return PROTECTED_ROLE_KEYS.includes(key);
}

export function getModuleDef(key) {
  return MODULE_BY_KEY.get(key) || null;
}

/** How many of a module's applicable actions are granted — used for the "Permissions Summary" column. */
export function countGrantedModules(matrix) {
  if (!matrix) return 0;
  return PERMISSION_MODULES.filter((mod) => matrix[mod.key]?.view).length;
}
