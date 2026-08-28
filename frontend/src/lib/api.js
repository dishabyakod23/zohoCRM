import axios from 'axios';
import {
  getStoredAccessToken,
  getStoredRefreshToken,
  refreshAuthSession,
  ensureFreshAccessToken,
  shouldAttemptTokenRefresh,
  handleSessionExpired,
  isAuthFailureError,
} from './authSession.js';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://salescrm-api.duckdns.org/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 45000,
});

api.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') return config;
  const path = String(config.url || '');
  if (path.includes('/auth/login') || path.includes('/auth/refresh')) return config;
  try {
    await ensureFreshAccessToken();
  } catch (err) {
    if (isAuthFailureError(err)) {
      handleSessionExpired();
    }
  }
  const token = getStoredAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (shouldAttemptTokenRefresh(original, err.response?.status)) {
      original._retry = true;
      try {
        const auth = await refreshAuthSession();
        if (!auth?.access_token) {
          handleSessionExpired();
          return Promise.reject(err);
        }
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${auth.access_token}`;
        return api(original);
      } catch (refreshErr) {
        if (isAuthFailureError(refreshErr)) {
          handleSessionExpired();
        }
        return Promise.reject(err);
      }
    }

    if (err.response?.status === 401 && original && !isAuthUrl(original.url)) {
      if (!getStoredRefreshToken() || original._retry) {
        handleSessionExpired();
      }
    }

    return Promise.reject(err);
  },
);

function isAuthUrl(url = '') {
  const path = String(url);
  return path.includes('/auth/login') || path.includes('/auth/refresh');
}

/** True when callers should skip error toasts (session redirect handles UX). */
export function isSessionExpiredError(err) {
  if (!err) return false;
  if (err.__sessionExpired) return true;
  if (err.response?.status !== 401) return false;
  const detail = err.response?.data?.detail;
  const message = typeof detail === 'string' ? detail : err.response?.data?.message;
  return /invalid or expired token|authentication required|not authenticated|unauthorized|session expired/i.test(String(message || ''));
}

/** Parse FastAPI validation errors */
export function getApiError(err) {
  if (isSessionExpiredError(err)) {
    return 'Your session has expired. Please sign in again.';
  }
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return 'The server is taking too long to respond. Wait a moment and try again — this can happen when the API wakes from idle.';
  }
  const data = err.response?.data;
  if (!data) return err.message || 'Request failed';

  if (typeof data === 'string') {
    const text = data.trim();
    if (err.response?.status >= 500) {
      return 'The server failed while processing this import. Large files are sent in smaller batches — try again, or split the CSV if it keeps failing.';
    }
    return text || err.message || 'Request failed';
  }

  if (err.response?.status === 403) {
    return typeof data.detail === 'string'
      ? data.detail
      : 'You do not have permission to perform this action.';
  }

  const detail = data.detail;
  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    return detail.map((d) => {
      const field = Array.isArray(d.loc)
        ? d.loc.filter((x) => typeof x === 'string').join('.')
        : '';
      return field ? `${field}: ${d.msg}` : d.msg;
    }).join('; ');
  }

  if (Array.isArray(data.errors) && data.errors.length) {
    return data.errors.map((e) => e.message || e.msg || String(e)).join('; ');
  }

  if (data.data?.errors?.length) {
    return data.data.errors.map((e) => String(e)).join('; ');
  }

  return data.message || data.error || err.message || 'Request failed';
}

export default api;
