import api from '../api.js';
import { readStoredAuthUser } from '../authHelpers.js';
import { invalidateCachedRequest } from '../requestCache.js';
import * as adminApi from './admin.js';
import * as rolesApi from './roles.js';
import {
  USER_ROLES,
  ROLE_LABELS,
  ROLE_ACCESS,
  normalizeRole,
  cacheCustomRoleLabels,
} from '../roles.js';
import {
  DEFAULT_ROLE_MODULE_PERMISSIONS,
  applyPermissionDependencies,
  isProtectedRoleKey,
} from '../permissionModules.js';
import { slugifyRoleKey, validateRoleName, validateRoleDescription } from '../manageRolesHelpers.js';

const ROLES_STORAGE_KEY = 'crm_custom_roles';
const ROLES_CACHE_KEY = 'manage-roles:list';

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

/** The 4 built-in roles — not returned by GET /admin/roles; shown read-only in the UI. */
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

async function fetchCustomRoles() {
  try {
    const remote = await rolesApi.listCustomRoles();
    cacheCustomRoleLabels(remote);
    return remote;
  } catch (err) {
    if (!shouldUseLocalFallback(err)) throw err;
    const local = readStore().map(normalizeStoredRole);
    cacheCustomRoleLabels(local);
    return local;
  }
}

/** Built-in system roles + custom roles from GET /admin/roles. */
export async function listRoles() {
  const custom = await fetchCustomRoles();
  return [...systemRoles(), ...custom];
}

export async function getRole(id) {
  const system = systemRoles().find((r) => String(r.id) === String(id));
  if (system) return system;

  try {
    return await rolesApi.getCustomRole(id);
  } catch (err) {
    if (!shouldUseLocalFallback(err)) throw err;
    const local = readStore().find((r) => String(r.id) === String(id));
    return local ? normalizeStoredRole(local) : null;
  }
}

/** Roles a user can be assigned to — built-ins + active custom roles. */
export async function listAssignableRoles() {
  const roles = await listRoles();
  return roles.filter((r) => r.is_system || r.status === 'active');
}

export async function getCustomRoleModulePermissions(roleKey) {
  if (USER_ROLES.includes(roleKey)) return null;
  const roles = await listRoles();
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

  const payload = {
    name: name.trim(),
    description: description.trim(),
    status,
    permissions: applyPermissionDependencies(permissions || {}),
  };

  try {
    const created = await rolesApi.createCustomRole(payload);
    invalidateCachedRequest(ROLES_CACHE_KEY);
    cacheCustomRoleLabels([created]);
    return created;
  } catch (err) {
    if (!shouldUseLocalFallback(err)) throw err;
  }

  const now = new Date().toISOString();
  const local = normalizeStoredRole({
    id: `role_${Date.now()}`,
    key: uniqueRoleKey(name, existing.filter((r) => !r.is_system)),
    ...payload,
    created_by: currentActorName(),
    created_at: now,
    updated_at: now,
  });
  const store = readStore();
  store.push(local);
  writeStore(store);
  cacheCustomRoleLabels([local]);
  invalidateCachedRequest(ROLES_CACHE_KEY);
  return local;
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
    name: (name ?? current.name).trim(),
    description: (description ?? current.description).trim(),
    status: status ?? current.status,
    permissions: applyPermissionDependencies(permissions ?? current.permissions),
  };

  try {
    const updated = await rolesApi.updateCustomRole(id, patch);
    invalidateCachedRequest(ROLES_CACHE_KEY);
    cacheCustomRoleLabels([updated]);
    return updated;
  } catch (err) {
    if (!shouldUseLocalFallback(err)) throw err;
  }

  const localPatch = { ...current, ...patch, updated_at: new Date().toISOString() };
  const store = readStore();
  const idx = store.findIndex((r) => String(r.id) === String(id));
  if (idx === -1) throw new Error('Role not found.');
  store[idx] = localPatch;
  writeStore(store);
  cacheCustomRoleLabels([localPatch]);
  invalidateCachedRequest(ROLES_CACHE_KEY);
  return localPatch;
}

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
    await rolesApi.deleteCustomRole(id);
    invalidateCachedRequest(ROLES_CACHE_KEY);
    return;
  } catch (err) {
    if (err?.response?.status === 409) {
      throw new Error(
        err.response?.data?.detail
        || 'This role cannot be deleted because users are assigned to it. Please reassign those users to another role before deleting.',
      );
    }
    if (!shouldUseLocalFallback(err)) throw err;
  }

  const store = readStore();
  writeStore(store.filter((r) => String(r.id) !== String(id)));
  invalidateCachedRequest(ROLES_CACHE_KEY);
}
