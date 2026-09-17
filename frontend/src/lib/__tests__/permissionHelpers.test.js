import { canPermission, resolveUserPermissions, normalizePermissionsMatrix } from '../permissionHelpers.js';
import { DEFAULT_ROLE_MODULE_PERMISSIONS } from '../permissionModules.js';

describe('permissionHelpers', () => {
  it('canPermission checks module action flags', () => {
    const matrix = DEFAULT_ROLE_MODULE_PERMISSIONS.sales_rep;
    expect(canPermission(matrix, 'contacts', 'view')).toBe(true);
    expect(canPermission(matrix, 'contacts', 'delete')).toBe(false);
  });

  it('resolveUserPermissions prefers explicit /auth/me flags', () => {
    const matrix = { contacts: { view: true, create: false, edit: false, delete: false, import: false, export: false } };
    const user = { role: 'sales_rep', permissions: matrix };
    const resolved = resolveUserPermissions(user);
    expect(resolved.contacts.view).toBe(true);
    expect(resolved.contacts.create).toBe(false);
  });

  it('resolveUserPermissions fills omitted documents.upload from role defaults', () => {
    const user = {
      role: 'sales_rep',
      permissions: {
        contacts: { view: true, create: true, edit: true },
        // documents module omitted — should keep role default upload
      },
    };
    const resolved = resolveUserPermissions(user);
    expect(resolved.documents.upload).toBe(true);
    expect(resolved.documents.view).toBe(true);
  });

  it('resolveUserPermissions treats omitted settings modules as deny when API matrix exists', () => {
    const user = {
      role: 'sales_manager',
      permissions: {
        contacts: { view: true, create: true, edit: true },
        settings_my_profile: { view: true, edit: true },
        // settings_users_roles / announcements omitted → deny (not role defaults)
      },
    };
    const resolved = resolveUserPermissions(user);
    expect(resolved.settings_my_profile.view).toBe(true);
    expect(resolved.settings_users_roles.view).toBe(false);
    expect(resolved.settings_announcements.view).toBe(false);
    expect(resolved.settings_company_settings.view).toBe(false);
  });

  it('resolveUserPermissions maps legacy documents.create to upload when upload is omitted', () => {
    const user = {
      role: 'viewer',
      permissions: {
        documents: { view: true, create: true },
      },
    };
    const resolved = resolveUserPermissions(user);
    expect(resolved.documents.upload).toBe(true);
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
