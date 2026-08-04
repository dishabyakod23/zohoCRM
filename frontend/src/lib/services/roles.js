import api from '../api.js';
import { applyPermissionDependencies, serializePermissionsForApi } from '../permissionModules.js';

const ROLES_BASE = '/admin/roles';

function normalizeRoleResponse(role) {
  if (!role) return null;
  return {
    ...role,
    permissions: applyPermissionDependencies(role.permissions || {}),
    is_system: false,
  };
}

/** GET /admin/roles — custom roles only (built-ins are handled in the frontend). */
export async function listCustomRoles() {
  const res = await api.get(ROLES_BASE);
  const rows = res.data?.data || [];
  return rows.map(normalizeRoleResponse);
}

/** GET /admin/roles/{role_id} */
export async function getCustomRole(roleId) {
  const res = await api.get(`${ROLES_BASE}/${roleId}`);
  return normalizeRoleResponse(res.data?.data);
}

/** POST /admin/roles */
export async function createCustomRole({ name, description = '', status = 'active', permissions }) {
  const res = await api.post(ROLES_BASE, {
    name: name?.trim(),
    description: description?.trim() || null,
    status,
    permissions: serializePermissionsForApi(permissions || {}),
  });
  return normalizeRoleResponse(res.data?.data);
}

/** PATCH /admin/roles/{role_id} */
export async function updateCustomRole(roleId, { name, description, status, permissions }) {
  const payload = {};
  if (name != null) payload.name = name.trim();
  if (description != null) payload.description = description.trim() || null;
  if (status != null) payload.status = status;
  if (permissions != null) payload.permissions = serializePermissionsForApi(permissions);
  const res = await api.patch(`${ROLES_BASE}/${roleId}`, payload);
  return normalizeRoleResponse(res.data?.data);
}

/** DELETE /admin/roles/{role_id} */
export async function deleteCustomRole(roleId) {
  await api.delete(`${ROLES_BASE}/${roleId}`);
}

/** Active custom roles suitable for user assignment dropdowns. */
export async function listActiveCustomRoles() {
  const roles = await listCustomRoles();
  return roles.filter((r) => r.status === 'active');
}
