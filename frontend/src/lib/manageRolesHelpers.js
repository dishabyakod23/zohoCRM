import { isProtectedRoleKey } from './permissionModules.js';

export const ROLE_NAME_MAX_LENGTH = 50;

/** Strip angle brackets so a role name/description can never carry markup/script content. */
export function sanitizeRoleText(text) {
  return String(text || '').replace(/[<>]/g, '').trim();
}

export function slugifyRoleKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Validate a role name against an existing role list.
 * @param {string} name
 * @param {Array<{ id: string, name: string }>} existingRoles
 * @param {string} [excludeRoleId] - the role being edited, excluded from the uniqueness check
 */
export function validateRoleName(name, existingRoles = [], excludeRoleId = null) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'Role name is required.';
  if (trimmed.length > ROLE_NAME_MAX_LENGTH) {
    return `Role name must be ${ROLE_NAME_MAX_LENGTH} characters or fewer.`;
  }
  if (sanitizeRoleText(trimmed) !== trimmed) {
    return 'Role name cannot contain "<" or ">" characters.';
  }
  const duplicate = existingRoles.some((r) =>
    String(r.id) !== String(excludeRoleId) && r.name?.trim().toLowerCase() === trimmed.toLowerCase());
  if (duplicate) return 'This role name already exists.';
  return null;
}

export function validateRoleDescription(description) {
  const trimmed = String(description || '');
  if (sanitizeRoleText(trimmed) !== trimmed.trim()) {
    return 'Description cannot contain "<" or ">" characters.';
  }
  return null;
}

export { isProtectedRoleKey };

/** Delete is only allowed for non-system roles with zero assigned users. */
export function canDeleteRole(role, assignedUserCount) {
  if (!role) return false;
  if (role.is_system || isProtectedRoleKey(role.key)) return false;
  return (assignedUserCount || 0) === 0;
}
