import api from '../../api.js';
import * as adminApi from '../admin.js';
import { readStoredAuthUser } from '../../authHelpers.js';
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  countUsersForRole,
  getCustomRoleModulePermissions,
  systemRoles,
} from '../manageRoles.js';
import { invalidateCachedRequest } from '../../requestCache.js';

jest.mock('../../authHelpers.js', () => ({
  ...jest.requireActual('../../authHelpers.js'),
  readStoredAuthUser: jest.fn(),
}));

jest.mock('../admin.js', () => ({
  listAdminUsers: jest.fn(),
}));

function notFound() {
  const err = new Error('Not Found');
  err.response = { status: 404 };
  return err;
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  invalidateCachedRequest('manage-roles:list');
  readStoredAuthUser.mockReturnValue({ id: 'admin-1', first_name: 'Super', last_name: 'Admin', email: 'admin@example.com' });
  jest.spyOn(api, 'get').mockRejectedValue(notFound());
  jest.spyOn(api, 'post').mockRejectedValue(notFound());
  jest.spyOn(api, 'patch').mockRejectedValue(notFound());
  jest.spyOn(api, 'delete').mockRejectedValue(notFound());
});

describe('systemRoles', () => {
  it('exposes exactly the 4 built-in roles, all non-deletable', () => {
    const roles = systemRoles();
    expect(roles).toHaveLength(4);
    expect(roles.every((r) => r.is_system)).toBe(true);
    expect(roles.map((r) => r.key).sort()).toEqual(['sales_manager', 'sales_rep', 'super_admin', 'viewer']);
  });
});

describe('listRoles (backend not built yet → local fallback)', () => {
  it('always includes the 4 system roles even with no custom roles stored', async () => {
    const roles = await listRoles();
    expect(roles).toHaveLength(4);
  });

  it('includes locally-created custom roles alongside the system roles', async () => {
    await createRole({ name: 'Junior Sales', description: 'Entry-level rep', permissions: {} });
    const roles = await listRoles();
    expect(roles).toHaveLength(5);
    expect(roles.find((r) => r.name === 'Junior Sales')).toBeTruthy();
  });
});

describe('createRole', () => {
  it('creates a role with a slugified, unique key and persists it locally', async () => {
    const role = await createRole({ name: 'Junior Sales Rep', description: '', permissions: {} });
    expect(role.key).toBe('junior_sales_rep');
    expect(role.is_system).toBe(false);
    expect(role.created_by).toBe('Super Admin');
    const stored = JSON.parse(localStorage.getItem('crm_custom_roles'));
    expect(stored).toHaveLength(1);
  });

  it('rejects a duplicate name (case-insensitive) against an existing custom role', async () => {
    await createRole({ name: 'Junior Sales', permissions: {} });
    await expect(createRole({ name: 'junior sales', permissions: {} })).rejects.toThrow(/already exists/);
  });

  it('rejects a duplicate name against a built-in role name', async () => {
    await expect(createRole({ name: 'Viewer', permissions: {} })).rejects.toThrow(/already exists/);
  });

  it('rejects an empty name', async () => {
    await expect(createRole({ name: '   ', permissions: {} })).rejects.toThrow(/required/);
  });

  it('applies permission dependency rules to the stored matrix', async () => {
    const role = await createRole({
      name: 'Data Importer',
      permissions: { leads: { view: false, create: false, edit: false, delete: false, import: true, export: false } },
    });
    expect(role.permissions.leads.import).toBe(true);
    expect(role.permissions.leads.create).toBe(true);
    expect(role.permissions.leads.view).toBe(true);
  });

  it('tries the real API first and uses it when available', async () => {
    api.post.mockResolvedValueOnce({ data: { data: { id: 'server-role-1', key: 'server_role', name: 'Server Role', permissions: {}, is_system: false } } });
    const role = await createRole({ name: 'Server Role', permissions: {} });
    expect(role.id).toBe('server-role-1');
    expect(JSON.parse(localStorage.getItem('crm_custom_roles') || '[]')).toHaveLength(0);
  });
});

describe('updateRole', () => {
  it('updates a custom role in local storage', async () => {
    const created = await createRole({ name: 'Junior Sales', description: 'v1', permissions: {} });
    const updated = await updateRole(created.id, { description: 'v2' });
    expect(updated.description).toBe('v2');
    expect(updated.name).toBe('Junior Sales');
  });

  it('refuses to update a built-in role', async () => {
    await expect(updateRole('super_admin', { name: 'Nope' })).rejects.toThrow(/cannot be edited/);
  });

  it('rejects renaming to a name that collides with another existing role', async () => {
    await createRole({ name: 'Role A', permissions: {} });
    const roleB = await createRole({ name: 'Role B', permissions: {} });
    await expect(updateRole(roleB.id, { name: 'Role A' })).rejects.toThrow(/already exists/);
  });

  it('allows a role to keep its own name unchanged', async () => {
    const created = await createRole({ name: 'Role A', permissions: {} });
    const updated = await updateRole(created.id, { name: 'Role A', status: 'inactive' });
    expect(updated.status).toBe('inactive');
  });
});

describe('countUsersForRole', () => {
  it('counts users whose normalized role matches the given key', async () => {
    adminApi.listAdminUsers.mockResolvedValue([
      { id: 'u1', role: 'sales_rep' },
      { id: 'u2', role: 'Business Development Executive' },
      { id: 'u3', role: 'viewer' },
    ]);
    expect(await countUsersForRole('sales_rep')).toBe(2);
    expect(await countUsersForRole('viewer')).toBe(1);
  });
});

describe('deleteRole', () => {
  it('refuses to delete a built-in role', async () => {
    adminApi.listAdminUsers.mockResolvedValue([]);
    await expect(deleteRole('viewer')).rejects.toThrow(/cannot be deleted/);
  });

  it('refuses to delete a custom role with assigned users', async () => {
    const role = await createRole({ name: 'Has Users', permissions: {} });
    adminApi.listAdminUsers.mockResolvedValue([{ id: 'u1', role: role.key }]);
    await expect(deleteRole(role.id)).rejects.toThrow(/reassign those users/);
  });

  it('deletes a custom role with zero assigned users', async () => {
    const role = await createRole({ name: 'No Users', permissions: {} });
    adminApi.listAdminUsers.mockResolvedValue([]);
    await deleteRole(role.id);
    const stored = JSON.parse(localStorage.getItem('crm_custom_roles') || '[]');
    expect(stored.find((r) => r.id === role.id)).toBeUndefined();
  });
});

describe('getCustomRoleModulePermissions', () => {
  it('returns null for a built-in role key (handled by the default matrices instead)', async () => {
    expect(await getCustomRoleModulePermissions('sales_rep')).toBeNull();
  });

  it('resolves the stored matrix for a custom role', async () => {
    const role = await createRole({
      name: 'Custom Viewer',
      permissions: { leads: { view: true, create: false, edit: false, delete: false, import: false, export: false } },
    });
    invalidateCachedRequest('manage-roles:list');
    const matrix = await getCustomRoleModulePermissions(role.key);
    expect(matrix.leads.view).toBe(true);
  });

  it('returns null for a role key that does not exist', async () => {
    expect(await getCustomRoleModulePermissions('does_not_exist')).toBeNull();
  });
});
