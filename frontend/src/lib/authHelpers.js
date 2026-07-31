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
  if (body.access_token) return body;
  if (body.data?.access_token) return body.data;
  return null;
}

import { mergeStoredProfileImage } from './profileImageHelpers.js';

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
  return user ? mergeStoredProfileImage(user) : null;
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
