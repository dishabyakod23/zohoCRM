/** Settings page tabs — only include a tab when the user has view access. */

export const SETTINGS_TABS = [
  { id: 'profile', label: 'My Profile', module: 'settings_my_profile' },
  { id: 'users', label: 'Users & Roles', module: 'settings_users_roles' },
  { id: 'roles', label: 'Manage Roles', superAdminOnly: true, module: 'settings_manage_roles' },
  { id: 'statuses', label: 'Lead Statuses', module: 'settings_lead_statuses' },
  { id: 'company', label: 'Company Settings', module: 'settings_company_settings' },
  { id: 'sales_targets', label: 'Pipeline & Revenue Targets', module: 'settings_sales_targets' },
  { id: 'announcements', label: 'Announcements', module: 'settings_announcements' },
];

/**
 * Build the settings tab list for the current user.
 * Tabs the user cannot view are omitted entirely (label is not rendered).
 *
 * `can` may be a function `(module, action) => boolean`, or a permission
 * matrix object checked via canPermission semantics (matrix[module].view).
 */
export function getVisibleSettingsTabs(can, { canManageRoles = false } = {}) {
  const canView = typeof can === 'function'
    ? (module) => Boolean(can(module, 'view'))
    : (module) => Boolean(can?.[module]?.view);

  return SETTINGS_TABS.filter((tab) => {
    if (tab.superAdminOnly) return Boolean(canManageRoles);
    if (!tab.module) return false;
    return canView(tab.module);
  });
}
