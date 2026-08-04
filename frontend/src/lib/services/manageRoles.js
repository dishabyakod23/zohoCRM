import api from '../api.js';
import { readStoredAuthUser } from '../authHelpers.js';
import { cachedRequest, invalidateCachedRequest } from '../requestCache.js';
import * as adminApi from './admin.js';
import {
  USER_ROLES,
  ROLE_LABELS,
  ROLE_ACCESS,
  normalizeRole,
} from '../roles.js';
import {
  DEFAULT_ROLE_MODULE_PERMISSIONS,
  applyPermissionDependencies,
  isProtectedRoleKey,
} from '../permissionModules.js';
import { slugifyRoleKey, validateRoleName, validateRoleDescription } from '../manageRolesHelpers.js';

const ROLES_STORAGE_KEY = 'crm_custom_roles';
const ROLES_BASE = '/admin/roles';
const ROLES_CACHE_KEY = 'manage-roles:list';

/** No Manage Roles backend endpoint yet — treat these statuses as "use local storage instead". */
function shouldUseLocalFallback(err) {
  const status = err?.response?.status;
  return !status || status === 404 || status === 405 || status === 501;
}

function readStore() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ROLES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStore(roles) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(roles));
}

function currentActorName() {
  const user = readStoredAuthUser();
  if (!user) return 'Unknown';
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Unknown';
}

/** The 4 built-in roles, presented in the same shape as a custom role for the listing screen. */
export function systemRoles() {
  return USER_ROLES.map((key) => ({
    id: key,
    key,
    name: ROLE_LABELS[key],
    description: ROLE_ACCESS[key] || '',
    status: 'active',
    permissions: DEFAULT_ROLE_MODULE_PERMISSIONS[key],
    is_system: true,
    created_by: 'System',
    created_at: null,
    updated_at: null,
  }));
}

function normalizeStoredRole(role) {
  return {
    ...role,
    permissions: applyPermissionDependencies(role.permissions || {}),
    is_system: false,
  };
}

export async function listRoles() {
  try {
    const res = await api.get(ROLES_BASE);
    const remote = res.data?.data || [];
    return [...systemRoles(), ...remote.map(normalizeStoredRole)];
  } catch (err) {
    if (!shouldUseLocalFallback(err)) throw err;
  }
  return [...systemRoles(), ...readStore().map(normalizeStoredRole)];
}

export async function getRole(id) {
  const roles = await listRoles();
  return roles.find((r) => String(r.id) === String(id)) || null;
}

/** Roles a user can be assigned to — excludes inactive custom roles. */
export async function listAssignableRoles() {
  const roles = await listRoles();
  return roles.filter((r) => r.is_system || r.status === 'active');
}

/**
 * Cached lookup used by usePermissions() — called from many components on every render tree,
 * so it goes through the shared request cache rather than hitting the API/localStorage each time.
 */
export async function getCustomRoleModulePermissions(roleKey) {
  if (USER_ROLES.includes(roleKey)) return null;
  const roles = await cachedRequest(ROLES_CACHE_KEY, listRoles, 60 * 1000);
  return roles.find((r) => r.key === roleKey)?.permissions || null;
}

export function validateRolePayload({ name, description }, existingRoles, excludeRoleId) {
  const errors = {};
  const nameErr = validateRoleName(name, existingRoles, excludeRoleId);
  if (nameErr) errors.name = nameErr;
  const descErr = validateRoleDescription(description);
  if (descErr) errors.description = descErr;
  return errors;
}

function uniqueRoleKey(name, existingRoles) {
  const base = slugifyRoleKey(name) || 'role';
  const taken = new Set([...USER_ROLES, ...existingRoles.map((r) => r.key)]);
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

export async function createRole({ name, description = '', status = 'active', permissions }) {
  const existing = await listRoles();
  const errors = validateRolePayload({ name, description }, existing, null);
  if (Object.keys(errors).length) {
    const err = new Error(errors.name || errors.description);
    err.fieldErrors = errors;
    throw err;
  }

  const now = new Date().toISOString();
  const payload = {
    id: `role_${Date.now()}`,
    key: uniqueRoleKey(name, existing.filter((r) => !r.is_system)),
    name: name.trim(),
    description: description.trim(),
    status,
    permissions: applyPermissionDependencies(permissions || {}),
    is_system: false,
    created_by: currentActorName(),
    created_at: now,
    updated_at: now,
  };

  try {
    const res = await api.post(ROLES_BASE, payload);
    invalidateCachedRequest(ROLES_CACHE_KEY);
    return normalizeStoredRole(res.data?.data || payload);
  } catch (err) {
    if (!shouldUseLocalFallback(err)) throw err;
  }

  const store = readStore();
  store.push(payload);
  writeStore(store);
  invalidateCachedRequest(ROLES_CACHE_KEY);
  return payload;
}

export async function updateRole(id, { name, description, status, permissions }) {
  if (isProtectedRoleKey(id)) {
    throw new Error('Built-in roles cannot be edited.');
  }
  const existing = await listRoles();
  const current = existing.find((r) => String(r.id) === String(id));
  if (!current) throw new Error('Role not found.');

  const errors = validateRolePayload(
    { name: name ?? current.name, description: description ?? current.description },
    existing,
    id,
  );
  if (Object.keys(errors).length) {
    const err = new Error(errors.name || errors.description);
    err.fieldErrors = errors;
    throw err;
  }

  const patch = {
    ...current,
    name: (name ?? current.name).trim(),
    description: (description ?? current.description).trim(),
    status: status ?? current.status,
    permissions: applyPermissionDependencies(permissions ?? current.permissions),
    updated_at: new Date().toISOString(),
  };

  try {
    const res = await api.patch(`${ROLES_BASE}/${id}`, patch);
    invalidateCachedRequest(ROLES_CACHE_KEY);
    return normalizeStoredRole(res.data?.data || patch);
  } catch (err) {
    if (!shouldUseLocalFallback(err)) throw err;
  }

  const store = readStore();
  const idx = store.findIndex((r) => String(r.id) === String(id));
  if (idx === -1) throw new Error('Role not found.');
  store[idx] = patch;
  writeStore(store);
  invalidateCachedRequest(ROLES_CACHE_KEY);
  return patch;
}

/** Count of users currently assigned to a role (by its role key), for the delete-guard. */
export async function countUsersForRole(roleKey) {
  const users = await adminApi.listAdminUsers();
  return users.filter((u) => normalizeRole(u.role) === normalizeRole(roleKey)).length;
}

export async function deleteRole(id) {
  if (isProtectedRoleKey(id)) {
    throw new Error('Built-in roles cannot be deleted.');
  }
  const role = await getRole(id);
  if (!role) throw new Error('Role not found.');

  const assignedCount = await countUsersForRole(role.key);
  if (assignedCount > 0) {
    throw new Error(
      'This role cannot be deleted because users are assigned to it. Please reassign those users to another role before deleting.',
    );
  }

  try {
    await api.delete(`${ROLES_BASE}/${id}`);
    invalidateCachedRequest(ROLES_CACHE_KEY);
    return;
  } catch (err) {
    if (!shouldUseLocalFallback(err)) throw err;
  }

  const store = readStore();
  writeStore(store.filter((r) => String(r.id) !== String(id)));
  invalidateCachedRequest(ROLES_CACHE_KEY);
}
