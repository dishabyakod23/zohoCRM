import { getRolePermissions, normalizeRole, isStrictSuperAdmin } from '../roles.js';
import { emptyModulePermissions, applyPermissionDependencies } from '../permissionModules.js';

describe('getRolePermissions — built-in roles (backward compatibility)', () => {
  it('matches historical super_admin behavior', () => {
    const p = getRolePermissions('super_admin');
    expect(p).toMatchObject({
      canEdit: true, canDelete: true, canDownload: true, canManageUsers: true,
      canManageSettings: true, canBulkDelete: true, canAssignLeads: true,
      isSuperAdmin: true, isViewer: false, isSalesManager: false, isSalesRep: false,
    });
  });

  it('matches historical sales_manager (admin-tier) behavior', () => {
    const p = getRolePermissions('sales_manager');
    expect(p).toMatchObject({
      canEdit: true, canDelete: true, canDownload: true, canManageUsers: true,
      isSuperAdmin: true, isSalesManager: true, isSalesRep: false,
    });
  });

  it('matches historical sales_rep behavior', () => {
    const p = getRolePermissions('sales_rep');
    expect(p).toMatchObject({
      canEdit: true, canDelete: true, canDownload: false, canManageUsers: false,
      canAssignLeads: false, canAccessReports: true, isSalesRep: true, isSuperAdmin: false,
    });
  });

  it('matches historical viewer behavior', () => {
    const p = getRolePermissions('viewer');
    expect(p).toMatchObject({
      canEdit: false, canDelete: false, canDownload: false, canAccessReports: false,
      canBulkUpload: false, canQuickCreate: false, isViewer: true,
    });
  });

  it('grants canManageRoles only to super_admin, not sales_manager', () => {
    expect(getRolePermissions('super_admin').canManageRoles).toBe(true);
    expect(getRolePermissions('sales_manager').canManageRoles).toBe(false);
    expect(getRolePermissions('sales_rep').canManageRoles).toBe(false);
    expect(getRolePermissions('viewer').canManageRoles).toBe(false);
  });

  it('attaches a module permission matrix for every built-in role', () => {
    const p = getRolePermissions('sales_rep');
    expect(p.modulePermissions.leads.view).toBe(true);
    expect(p.modulePermissions.settings_manage_roles.view).toBe(false);
  });
});

describe('getRolePermissions — custom roles', () => {
  it('derives flags from the provided module matrix, ignoring the built-in defaults', () => {
    const matrix = applyPermissionDependencies({
      ...emptyModulePermissions(),
      leads: { view: true, create: true, edit: true, delete: false, import: false, export: false },
    });
    const p = getRolePermissions('junior_sales', { customModulePermissions: matrix });
    expect(p.canEdit).toBe(true);
    expect(p.canDelete).toBe(false);
    expect(p.isSuperAdmin).toBe(false);
    expect(p.canManageRoles).toBe(false);
    expect(p.modulePermissions).toBe(matrix);
  });

  it('treats a custom role with no module access as effectively a viewer', () => {
    const matrix = emptyModulePermissions();
    matrix.leads.view = true;
    const p = getRolePermissions('read_only_role', { customModulePermissions: matrix });
    expect(p.isViewer).toBe(true);
    expect(p.canEdit).toBe(false);
  });

  it('falls back to an all-false matrix (fail-closed) when no custom matrix is supplied for an unknown role', () => {
    const p = getRolePermissions('mystery_role');
    expect(p.canEdit).toBe(false);
    expect(p.canDelete).toBe(false);
    expect(p.isSuperAdmin).toBe(false);
  });
});

describe('isStrictSuperAdmin', () => {
  it('is true only for super_admin, not sales_manager', () => {
    expect(isStrictSuperAdmin('super_admin')).toBe(true);
    expect(isStrictSuperAdmin('sales_manager')).toBe(false);
    expect(isStrictSuperAdmin('admin')).toBe(true); // legacy alias normalizes to super_admin
  });
});

describe('normalizeRole — new label aliases', () => {
  it('normalizes the renamed labels back to their canonical keys', () => {
    expect(normalizeRole('Business Development Manager')).toBe('sales_manager');
    expect(normalizeRole('Business Development Executive')).toBe('sales_rep');
  });

  it('still normalizes the legacy labels for old stored data', () => {
    expect(normalizeRole('Sales Manager')).toBe('sales_manager');
    expect(normalizeRole('Business Rep')).toBe('sales_rep');
  });
});
