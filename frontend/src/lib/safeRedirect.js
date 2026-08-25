/** Safe in-app path for post-login redirects (blocks open redirects). */
export function safeNextPath(next, fallback = '/dashboard') {
  if (!next || typeof next !== 'string') return fallback;
  const path = next.trim();
  if (!path.startsWith('/') || path.includes('//') || path.includes('://')) return fallback;
  return path;
}

export const SKIP_LOGIN_NEXT_KEY = 'crm_skip_login_next';

/** Explicit Sign Out should not send the next user to the previous page. */
export function markSkipLoginNext() {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(SKIP_LOGIN_NEXT_KEY, '1'); } catch { /* ignore quota / private mode */ }
}

export function shouldSkipLoginNext() {
  if (typeof window === 'undefined') return false;
  try { return sessionStorage.getItem(SKIP_LOGIN_NEXT_KEY) === '1'; } catch { return false; }
}

export function consumeSkipLoginNext() {
  const skip = shouldSkipLoginNext();
  if (skip && typeof window !== 'undefined') {
    try { sessionStorage.removeItem(SKIP_LOGIN_NEXT_KEY); } catch { /* ignore */ }
  }
  return skip;
}

/** Login URL preserving the page the user was trying to reach. */
export function loginHref(nextPath) {
  if (typeof window === 'undefined') return '/login';
  if (shouldSkipLoginNext()) return '/login';
  let next = nextPath ?? `${window.location.pathname}${window.location.search}`;
  const pathOnly = (next.split('?')[0] || '').replace(/\/$/, '') || '/';
  if (pathOnly === '/login') next = '/dashboard';
  const safe = safeNextPath(next, '');
  return safe ? `/login?next=${encodeURIComponent(safe)}` : '/login';
}
