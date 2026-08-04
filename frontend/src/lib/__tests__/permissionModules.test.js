import {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  emptyModulePermissions,
  fullModulePermissions,
  applyPermissionDependencies,
  DEFAULT_ROLE_MODULE_PERMISSIONS,
  isProtectedRoleKey,
  countGrantedModules,
} from '../permissionModules.js';

describe('emptyModulePermissions / fullModulePermissions', () => {
  it('produces one row per module, all false, for the empty matrix', () => {
    const matrix = emptyModulePermissions();
    expect(Object.keys(matrix)).toHaveLength(PERMISSION_MODULES.length);
    for (const mod of PERMISSION_MODULES) {
      for (const action of PERMISSION_ACTIONS) {
        expect(matrix[mod.key][action]).toBe(false);
      }
    }
  });

  it('grants only the actions each module actually supports in the full matrix', () => {
    const matrix = fullModulePermissions();
    const home = matrix.home;
    expect(home.view).toBe(true);
    expect(home.create).toBe(false); // Home only supports "view"
    const contacts = matrix.contacts;
    expect(contacts.view && contacts.create && contacts.edit && contacts.delete && contacts.import && contacts.export).toBe(true);
  });
});

describe('applyPermissionDependencies', () => {
  it('grants View when Create is granted', () => {
    const matrix = emptyModulePermissions();
    matrix.leads.create = true;
    const fixed = applyPermissionDependencies(matrix);
    expect(fixed.leads.view).toBe(true);
  });

  it('grants View when Edit, Delete, or Export is granted', () => {
    for (const action of ['edit', 'delete', 'export']) {
      const matrix = emptyModulePermissions();
      matrix.leads[action] = true;
      expect(applyPermissionDependencies(matrix).leads.view).toBe(true);
    }
  });

  it('grants both Create and View when Import is granted', () => {
    const matrix = emptyModulePermissions();
    matrix.contacts.import = true;
    const fixed = applyPermissionDependencies(matrix);
    expect(fixed.contacts.create).toBe(true);
    expect(fixed.contacts.view).toBe(true);
  });

  it('does not grant anything extra when only View is set', () => {
    const matrix = emptyModulePermissions();
    matrix.leads.view = true;
    const fixed = applyPermissionDependencies(matrix);
    expect(fixed.leads.create).toBe(false);
    expect(fixed.leads.edit).toBe(false);
  });

  it('is idempotent and fills in missing modules as all-false', () => {
    const once = applyPermissionDependencies({ leads: { create: true } });
    const twice = applyPermissionDependencies(once);
    expect(twice).toEqual(once);
    expect(twice.contacts).toEqual({ view: false, create: false, edit: false, delete: false, import: false, export: false });
  });
});

describe('DEFAULT_ROLE_MODULE_PERMISSIONS', () => {
  it('gives Super Admin every action on every module', () => {
    const matrix = DEFAULT_ROLE_MODULE_PERMISSIONS.super_admin;
    for (const mod of PERMISSION_MODULES) {
      for (const action of mod.actions) {
        expect(matrix[mod.key][action]).toBe(true);
      }
    }
  });

  it('gives Viewer no create/edit/delete/import/export on business/CRM modules', () => {
    const matrix = DEFAULT_ROLE_MODULE_PERMISSIONS.viewer;
    for (const mod of PERMISSION_MODULES) {
      if (mod.key === 'settings_my_profile') continue; // every role can manage their own profile
      expect(matrix[mod.key].create).toBe(false);
      expect(matrix[mod.key].edit).toBe(false);
      expect(matrix[mod.key].delete).toBe(false);
      expect(matrix[mod.key].import).toBe(false);
      expect(matrix[mod.key].export).toBe(false);
    }
  });

  it('lets Viewer edit their own profile even though every other module is read-only', () => {
    expect(DEFAULT_ROLE_MODULE_PERMISSIONS.viewer.settings_my_profile.edit).toBe(true);
  });

  it('never grants Business Development Executive export access, or delete beyond their own scheduling tools', () => {
    const matrix = DEFAULT_ROLE_MODULE_PERMISSIONS.sales_rep;
    const ownScopeDeleteAllowed = new Set(['calendar', 'tasks', 'meetings']);
    for (const mod of PERMISSION_MODULES) {
      expect(matrix[mod.key].export).toBe(false);
      if (!ownScopeDeleteAllowed.has(mod.key)) {
        expect(matrix[mod.key].delete).toBe(false);
      }
    }
  });

  it('every default matrix already satisfies the dependency rules', () => {
    for (const [role, matrix] of Object.entries(DEFAULT_ROLE_MODULE_PERMISSIONS)) {
      expect(applyPermissionDependencies(matrix)).toEqual(matrix);
    }
  });
});

describe('isProtectedRoleKey', () => {
  it('protects all 4 built-in roles', () => {
    expect(isProtectedRoleKey('super_admin')).toBe(true);
    expect(isProtectedRoleKey('sales_manager')).toBe(true);
    expect(isProtectedRoleKey('sales_rep')).toBe(true);
    expect(isProtectedRoleKey('viewer')).toBe(true);
  });

  it('does not protect a custom role key', () => {
    expect(isProtectedRoleKey('junior_sales')).toBe(false);
  });
});

describe('countGrantedModules', () => {
  it('counts modules with view access', () => {
    const matrix = emptyModulePermissions();
    matrix.leads.view = true;
    matrix.contacts.view = true;
    expect(countGrantedModules(matrix)).toBe(2);
  });

  it('returns 0 for a null/empty matrix', () => {
    expect(countGrantedModules(null)).toBe(0);
    expect(countGrantedModules(emptyModulePermissions())).toBe(0);
  });
});
