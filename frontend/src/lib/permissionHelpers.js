import {
  DEFAULT_ROLE_MODULE_PERMISSIONS,
  applyPermissionDependencies,
  normalizeApiPermissions,
  emptyModulePermissions,
  PERMISSION_MODULES,
  ALL_MODULE_ACTIONS,
} from './permissionModules.js';
import { normalizeRole } from './roles.js';

/** `can(module, action)` — primary permission check used across the app. */
export function canPermission(matrix, module, action) {
  return Boolean(matrix?.[module]?.[action]);
}

/** Normalize API/stored permission objects to a full matrix with dependency rules applied. */
export function normalizePermissionsMatrix(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return normalizeApiPermissions(raw);
}

/**
 * Resolve the effective permission matrix for a user.
 * Prefers `user.permissions` from GET /auth/me; falls back to built-in role defaults.
 */
export function resolveUserPermissions(user) {
  const fromApi = normalizePermissionsMatrix(user?.permissions);
  if (fromApi) return fromApi;

  const role = normalizeRole(user?.role);
  if (role && DEFAULT_ROLE_MODULE_PERMISSIONS[role]) {
    return DEFAULT_ROLE_MODULE_PERMISSIONS[role];
  }
  return emptyModulePermissions();
}

export function hasAnyModuleAction(matrix, actions) {
  if (!matrix) return false;
  return Object.values(matrix).some((row) => actions.some((a) => row?.[a]));
}

/** CRM modules only — excludes settings_* so profile edit does not imply record edit. */
export function hasAnyCrmModuleAction(matrix, actions) {
  if (!matrix) return false;
  return Object.entries(matrix).some(([key, row]) => {
    if (key.startsWith('settings_')) return false;
    return actions.some((a) => row?.[a]);
  });
}

/** Build a per-module permission object for a single module key. */
export function modulePermissionFlags(matrix, moduleKey) {
  const mod = PERMISSION_MODULES.find((m) => m.key === moduleKey);
  const row = matrix?.[moduleKey] || {};
  const flags = Object.fromEntries(ALL_MODULE_ACTIONS.map((a) => [a, false]));
  if (!mod) return flags;
  for (const action of mod.actions) {
    flags[action] = Boolean(row[action]);
  }
  return flags;
}
