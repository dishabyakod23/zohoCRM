const COOKIE_NAME = 'crm_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

export function setAuthSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;
}

export function clearAuthSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
