import axios from 'axios';
import { setAuthSessionCookie, clearAuthSessionCookie } from './authCookie.js';
import { parseAuthUserResponse, parseAuthTokenResponse } from './authHelpers.js';

export const AUTH_TOKEN_KEY = 'crm_token';
export const AUTH_REFRESH_KEY = 'crm_refresh_token';
export const AUTH_USER_KEY = 'crm_user';

const REFRESH_TIMEOUT_MS = 30000;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://salescrm-api.duckdns.org/api/v1';

let refreshInflight = null;

export function persistAuthSession({ access_token, refresh_token, user } = {}) {
  if (typeof window === 'undefined') return;
  if (access_token) localStorage.setItem(AUTH_TOKEN_KEY, access_token);
  if (refresh_token) localStorage.setItem(AUTH_REFRESH_KEY, refresh_token);
  if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  setAuthSessionCookie();
}

/** Only used for explicit Log Out (and password-change re-login). */
export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_REFRESH_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
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

/** Refresh the access token. Never clears the stored session on failure. */
export async function refreshAuthSession() {
  if (refreshInflight) return refreshInflight;

  refreshInflight = (async () => {
    const refresh = getStoredRefreshToken();
    if (!refresh) return null;
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
    });
    return auth;
  })().finally(() => {
    refreshInflight = null;
  });

  return refreshInflight;
}
