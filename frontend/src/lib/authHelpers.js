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

/** `/auth/me` may return the user flat or wrapped in `{ data }`. */
export function parseAuthUserResponse(body) {
  if (!body) return null;
  if (body.id) return body;
  if (body.data?.id) return body.data;
  const nested = body?.data;
  return nested?.id ? nested : null;
}

/** True when the browser is on an unauthenticated route. */
export function isPublicAuthPath(pathname = '') {
  const path = String(pathname || '').replace(/\/$/, '') || '/';
  return path === '/login' || path === '/forgot-password' || path === '/reset-password';
}
