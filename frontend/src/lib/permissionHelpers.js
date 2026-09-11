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
 * Prefers explicit flags from GET /auth/me, but fills omitted modules/actions
 * from the built-in role defaults so system roles don't lose documents.upload
 * (and similar) when the API matrix is partial.
 */
export function resolveUserPermissions(user) {
  const role = normalizeRole(user?.role);
  const defaults = (role && DEFAULT_ROLE_MODULE_PERMISSIONS[role])
    || emptyModulePermissions();
  const raw = user?.permissions;
  if (!raw || typeof raw !== 'object') return defaults;

  const merged = {};
  for (const mod of PERMISSION_MODULES) {
    const key = mod.key;
    const defRow = defaults[key] || emptyModulePermissions()[key];
    const apiRow = raw[key];
    if (!apiRow || typeof apiRow !== 'object') {
      merged[key] = { ...defRow };
      continue;
    }
    const row = { ...defRow };
    for (const action of ALL_MODULE_ACTIONS) {
      if (Object.prototype.hasOwnProperty.call(apiRow, action)) {
        row[action] = Boolean(apiRow[action]);
      }
    }
    // Legacy documents keys from older role matrices.
    if (key === 'documents') {
      if (Object.prototype.hasOwnProperty.call(apiRow, 'create')
        && !Object.prototype.hasOwnProperty.call(apiRow, 'upload')) {
        row.upload = Boolean(apiRow.create);
      }
      if (Object.prototype.hasOwnProperty.call(apiRow, 'export')
        && !Object.prototype.hasOwnProperty.call(apiRow, 'download')) {
        row.download = Boolean(apiRow.export);
      }
    }
    if (key === 'recycle_bin') {
      if (Object.prototype.hasOwnProperty.call(apiRow, 'edit')
        && !Object.prototype.hasOwnProperty.call(apiRow, 'restore')) {
        row.restore = Boolean(apiRow.edit);
      }
      if (Object.prototype.hasOwnProperty.call(apiRow, 'delete')
        && !Object.prototype.hasOwnProperty.call(apiRow, 'permanent_delete')) {
        row.permanent_delete = Boolean(apiRow.delete);
      }
    }
    merged[key] = row;
  }

  // Keep any unknown modules from the API payload.
  for (const [key, apiRow] of Object.entries(raw)) {
    if (merged[key] || !apiRow || typeof apiRow !== 'object') continue;
    merged[key] = { ...apiRow };
  }

  return applyPermissionDependencies(merged);
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
