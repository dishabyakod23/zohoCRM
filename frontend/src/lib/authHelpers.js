/** Normalize email before login / user creation (trim, lowercase). */
export function normalizeLoginEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Trim accidental whitespace from pasted passwords. */
export function normalizeLoginPassword(password) {
  return String(password || '').trim();
}

/** Login + refresh responses may be flat or wrapped in `{ data }`. */
export function parseAuthTokenResponse(body) {
  if (!body) return null;
  let raw = null;
  if (body.access_token) raw = body;
  else if (body.data?.access_token) raw = body.data;
  if (!raw) return null;

  if (raw.expires_in == null) {
    const alt = raw.expiresIn ?? raw.access_token_expires_in;
    if (alt != null) raw.expires_in = Number(alt);
  }
  if (!raw.refresh_token && raw.refreshToken) raw.refresh_token = raw.refreshToken;
  return raw;
}

import { mergeStoredProfileImage } from './profileImageHelpers.js';
import { normalizePermissionsMatrix } from './permissionHelpers.js';

function normalizeAuthUser(user) {
  if (!user) return null;
  const next = mergeStoredProfileImage(user);
  if (next.permissions) {
    next.permissions = normalizePermissionsMatrix(next.permissions) || next.permissions;
  }
  return next;
}

/** `/auth/me` may return the user flat or wrapped in `{ data }`. */
export function parseAuthUserResponse(body) {
  if (!body) return null;
  let user = null;
  if (body.id) user = body;
  else if (body.data?.id) user = body.data;
  else {
    const nested = body?.data;
    user = nested?.id ? nested : null;
  }
  return normalizeAuthUser(user);
}

/** Sync-read cached session user for instant filter defaults on list pages. */
export function readStoredAuthUser() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('crm_user');
    if (!stored) return null;
    return parseAuthUserResponse(JSON.parse(stored));
  } catch {
    return null;
  }
}

/** True when the browser is on an unauthenticated route. */
export function isPublicAuthPath(pathname = '') {
  const path = String(pathname || '').replace(/\/$/, '') || '/';
  return path === '/login' || path === '/forgot-password' || path === '/reset-password';
}

export const INACTIVE_ACCOUNT_MESSAGE = 'This account is inactive. Contact your administrator to restore access.';

/** True when the user record is marked inactive/disabled. */
export function isInactiveUser(user) {
  if (!user) return false;
  if (user.is_active === false || user.active === false || user.is_inactive === true) return true;
  const status = String(user.status || '').toLowerCase();
  return status === 'inactive' || status === 'disabled' || status === 'deactivated';
}

export function isInactiveUserError(message) {
  return /inactive|not found or inactive/i.test(String(message || ''));
}

/** Toasts leftover from a previous session that should not appear on the login screen. */
export function isStaleAuthToast(message) {
  return /authentication required|not authenticated|unauthorized|lead not found|invalid token|invalid or expired token|token expired|please log in|session expired|sign in again/i.test(String(message || ''));
}
