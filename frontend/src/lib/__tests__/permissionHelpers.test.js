import { canPermission, resolveUserPermissions, normalizePermissionsMatrix } from '../permissionHelpers.js';
import { DEFAULT_ROLE_MODULE_PERMISSIONS } from '../permissionModules.js';

describe('permissionHelpers', () => {
  it('canPermission checks module action flags', () => {
    const matrix = DEFAULT_ROLE_MODULE_PERMISSIONS.sales_rep;
    expect(canPermission(matrix, 'contacts', 'view')).toBe(true);
    expect(canPermission(matrix, 'contacts', 'delete')).toBe(false);
  });

  it('resolveUserPermissions prefers user.permissions from /auth/me', () => {
    const matrix = { contacts: { view: true, create: false, edit: false, delete: false, import: false, export: false } };
    const user = { role: 'sales_rep', permissions: matrix };
    const resolved = resolveUserPermissions(user);
    expect(resolved.contacts.view).toBe(true);
  });

  it('resolveUserPermissions falls back to built-in role defaults', () => {
    const user = { role: 'viewer' };
    const resolved = resolveUserPermissions(user);
    expect(resolved.contacts.view).toBe(true);
    expect(resolved.contacts.create).toBe(false);
  });

  it('normalizePermissionsMatrix applies dependency rules', () => {
    const normalized = normalizePermissionsMatrix({
      leads: { view: false, create: true, edit: false, delete: false, import: false, export: false },
    });
    expect(normalized.leads.view).toBe(true);
    expect(normalized.leads.create).toBe(true);
  });
});
