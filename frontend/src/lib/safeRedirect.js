/** Safe in-app path for post-login redirects (blocks open redirects). */
export function safeNextPath(next, fallback = '/dashboard') {
  if (!next || typeof next !== 'string') return fallback;
  const path = next.trim();
  if (!path.startsWith('/') || path.includes('//') || path.includes('://')) return fallback;
  return path;
}

/** Login URL preserving the page the user was trying to reach. */
export function loginHref(nextPath) {
  if (typeof window === 'undefined') return '/login';
  let next = nextPath ?? `${window.location.pathname}${window.location.search}`;
  const pathOnly = (next.split('?')[0] || '').replace(/\/$/, '') || '/';
  if (pathOnly === '/login') next = '/dashboard';
  const safe = safeNextPath(next, '');
  return safe ? `/login?next=${encodeURIComponent(safe)}` : '/login';
}
