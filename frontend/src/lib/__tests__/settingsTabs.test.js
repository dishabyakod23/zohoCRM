import { getVisibleSettingsTabs, SETTINGS_TABS } from '../settingsTabs.js';
import { resolveUserPermissions, canPermission } from '../permissionHelpers.js';

function canFor(user) {
  const matrix = resolveUserPermissions(user);
  return (module, action) => canPermission(matrix, module, action);
}

describe('getVisibleSettingsTabs', () => {
  it('omits Users & Roles when the user lacks settings_users_roles.view', () => {
    const can = canFor({
      role: 'sales_manager',
      permissions: {
        settings_my_profile: { view: true, edit: true },
        settings_announcements: { view: true },
        settings_users_roles: { view: false },
      },
    });
    const labels = getVisibleSettingsTabs(can, { canManageRoles: false }).map((t) => t.label);
    expect(labels).toContain('My Profile');
    expect(labels).toContain('Announcements');
    expect(labels).not.toContain('Users & Roles');
    expect(labels).not.toContain('Company Settings');
  });

  it('shows only My Profile + Pipeline for sales_rep defaults', () => {
    const labels = getVisibleSettingsTabs(canFor({ role: 'sales_rep' }), { canManageRoles: false })
      .map((t) => t.label);
    expect(labels).toEqual(['My Profile', 'Pipeline & Revenue Targets']);
  });

  it('never includes Manage Roles unless canManageRoles', () => {
    const can = canFor({ role: 'super_admin' });
    expect(getVisibleSettingsTabs(can, { canManageRoles: false }).some((t) => t.id === 'roles')).toBe(false);
    expect(getVisibleSettingsTabs(can, { canManageRoles: true }).some((t) => t.id === 'roles')).toBe(true);
  });

  it('accepts a permission matrix object as well as a can() function', () => {
    const matrix = resolveUserPermissions({
      role: 'sales_rep',
      permissions: { settings_my_profile: { view: true, edit: true } },
    });
    const labels = getVisibleSettingsTabs(matrix, { canManageRoles: false }).map((t) => t.label);
    expect(labels).toEqual(['My Profile']);
  });
});
