import axios from 'axios';
import { setAuthSessionCookie, clearAuthSessionCookie } from './authCookie.js';
import { parseAuthUserResponse, parseAuthTokenResponse } from './authHelpers.js';

export const AUTH_TOKEN_KEY = 'crm_token';
export const AUTH_REFRESH_KEY = 'crm_refresh_token';
export const AUTH_USER_KEY = 'crm_user';
export const AUTH_EXPIRES_KEY = 'crm_token_expires_at';

const REFRESH_TIMEOUT_MS = 30000;
/** Refresh access token this long before it expires (backend access tokens are short-lived). */
export const ACCESS_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://salescrm-api.duckdns.org/api/v1';

let refreshInflight = null;
let sessionExpiredHandled = false;
let onSessionExpiredCallback = null;

export function registerSessionExpiredHandler(handler) {
  onSessionExpiredCallback = handler;
}

export function resetSessionExpiredGuard() {
  sessionExpiredHandled = false;
}

export function persistAuthSession({ access_token, refresh_token, user, expires_in } = {}) {
  if (typeof window === 'undefined') return;
  if (access_token) localStorage.setItem(AUTH_TOKEN_KEY, access_token);
  if (refresh_token) localStorage.setItem(AUTH_REFRESH_KEY, refresh_token);
  if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  if (access_token && expires_in != null && Number.isFinite(Number(expires_in))) {
    const expiresAt = Date.now() + Number(expires_in) * 1000;
    localStorage.setItem(AUTH_EXPIRES_KEY, String(expiresAt));
  }
  setAuthSessionCookie();
  resetSessionExpiredGuard();
}

/** Only used for explicit Log Out (and password-change re-login). */
export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_REFRESH_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_EXPIRES_KEY);
  clearAuthSessionCookie();
}

export function getStoredAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getStoredRefreshToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_REFRESH_KEY);
}

export function getAccessTokenExpiresAt() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(AUTH_EXPIRES_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function hasStoredAuthSession() {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return false;
  const user = parseAuthUserResponse(safeParseUser());
  return Boolean(user?.id || localStorage.getItem(AUTH_REFRESH_KEY));
}

function safeParseUser() {
  try {
    const stored = localStorage.getItem(AUTH_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/** Timeouts, offline, and 5xx should never end the session. */
export function isTransientRequestError(err) {
  if (!err) return true;
  if (err.code === 'ECONNABORTED' || String(err.message || '').includes('timeout')) return true;
  if (!err.response) return true;
  const status = err.response.status;
  return status >= 500 || status === 408 || status === 429;
}

export function isAuthFailureStatus(status) {
  return status === 401 || status === 403;
}

export function isAuthFailureError(err) {
  return isAuthFailureStatus(err?.response?.status);
}

function isAuthUrl(url = '') {
  const path = String(url);
  return path.includes('/auth/login') || path.includes('/auth/refresh');
}

export function shouldAttemptTokenRefresh(config, status) {
  if (status !== 401 || typeof window === 'undefined') return false;
  if (config?._retry) return false;
  if (isAuthUrl(config?.url)) return false;
  return Boolean(getStoredRefreshToken());
}

/** True when the stored access token is missing or near expiry. */
export function shouldProactivelyRefresh() {
  if (typeof window === 'undefined') return false;
  if (!getStoredRefreshToken()) return false;
  const expiresAt = getAccessTokenExpiresAt();
  if (!expiresAt) return true;
  return Date.now() >= expiresAt - ACCESS_TOKEN_REFRESH_BUFFER_MS;
}

/** End session once when refresh is no longer valid. Returns true the first time. */
export function handleSessionExpired(message = 'Your session has expired. Please sign in again.') {
  if (sessionExpiredHandled || typeof window === 'undefined') return false;
  sessionExpiredHandled = true;
  clearAuthSession();
  onSessionExpiredCallback?.(message);
  return true;
}

/** Refresh the access token. Never clears the stored session on transient failure. */
export async function refreshAuthSession() {
  if (refreshInflight) return refreshInflight;

  refreshInflight = (async () => {
    const refresh = getStoredRefreshToken();
    if (!refresh) return null;
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refresh },
        {
          timeout: REFRESH_TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const auth = parseAuthTokenResponse(data);
      if (!auth?.access_token) return null;
      persistAuthSession({
        access_token: auth.access_token,
        refresh_token: auth.refresh_token || refresh,
        user: auth.user,
        expires_in: auth.expires_in,
      });
      return auth;
    } catch (err) {
      if (isAuthFailureError(err)) throw err;
      return null;
    }
  })().finally(() => {
    refreshInflight = null;
  });

  return refreshInflight;
}

/** Ensure a valid access token before authenticated requests (e.g. after days idle). */
export async function ensureFreshAccessToken() {
  if (typeof window === 'undefined') return null;
  if (!getStoredRefreshToken()) return getStoredAccessToken();
  if (!shouldProactivelyRefresh()) return getStoredAccessToken();
  try {
    const auth = await refreshAuthSession();
    return auth?.access_token || getStoredAccessToken();
  } catch (err) {
    if (isAuthFailureError(err)) throw err;
    return getStoredAccessToken();
  }
}
