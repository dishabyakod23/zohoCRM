import {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  ALL_MODULE_ACTIONS,
  emptyModulePermissions,
  fullModulePermissions,
  applyPermissionDependencies,
  serializePermissionsForApi,
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
    expect(twice.contacts).toEqual(Object.fromEntries(
      ALL_MODULE_ACTIONS.map((a) => [a, false]),
    ));
  });
});

describe('serializePermissionsForApi', () => {
  it('omits unsupported actions for modules with limited permissions', () => {
    const matrix = fullModulePermissions();
    const api = serializePermissionsForApi(matrix);

    expect(api.home).toEqual({ view: true });
    expect(api.reports).toEqual({ view: true, export: true });
    expect(api.recycle_bin).toEqual({ view: true, restore: true, permanent_delete: true });
    expect(api.documents).toEqual({
      view: true,
      upload: true,
      edit: true,
      delete: true,
      download: true,
    });
    expect(api.home.create).toBeUndefined();
    expect(api.recycle_bin.edit).toBeUndefined();
    expect(api.documents.create).toBeUndefined();
  });

  it('still applies dependency rules before serializing', () => {
    const api = serializePermissionsForApi({ contacts: { import: true } });
    expect(api.contacts).toEqual({
      view: true,
      create: true,
      edit: false,
      delete: false,
      import: true,
      export: false,
    });
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

  it('gives Viewer no create/edit/delete/import/export on standard CRM modules', () => {
    const matrix = DEFAULT_ROLE_MODULE_PERMISSIONS.viewer;
    const standardActions = ['create', 'edit', 'delete', 'import', 'export'];
    for (const mod of PERMISSION_MODULES) {
      if (mod.key === 'settings_my_profile') continue;
      if (mod.key === 'recycle_bin' || mod.key === 'documents') continue;
      for (const action of standardActions) {
        expect(matrix[mod.key][action]).toBe(false);
      }
    }
    expect(matrix.recycle_bin.restore).toBe(false);
    expect(matrix.documents.upload).toBe(false);
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
