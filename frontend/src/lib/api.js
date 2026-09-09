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

  // Let the browser set multipart boundary; default JSON Content-Type breaks FormData uploads.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }

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

/** Humanize API field keys for user-facing messages. */
const API_FIELD_LABELS = {
  phone: 'Phone',
  mobile: 'Mobile',
  other_phone: 'Other Phone',
  home_phone: 'Home Phone',
  asst_phone: 'Asst Phone',
  fax: 'Fax',
  email: 'Email',
  secondary_email: 'Secondary Email',
  first_name: 'First Name',
  last_name: 'Last Name',
  skype_id: 'LinkedIn',
};

export function formatApiFieldError(field, message) {
  const label = API_FIELD_LABELS[field]
    || String(field || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    || 'Field';
  const msg = String(message || '').trim();
  if (!msg || /invalid format/i.test(msg) || /^invalid$/i.test(msg)) {
    return `${label} is invalid.`;
  }
  if (new RegExp(`^${label}\\b`, 'i').test(msg)) return msg;
  return `${label}: ${msg}`;
}

/** Map backend VALIDATION_ERROR.errors[] onto { fieldName: message }. */
export function getApiFieldErrors(err) {
  const data = err?.response?.data;
  const list = Array.isArray(data?.errors) ? data.errors : null;
  if (!list?.length) return {};
  const out = {};
  for (const entry of list) {
    const field = entry?.field
      || (Array.isArray(entry?.loc)
        ? entry.loc.filter((x) => typeof x === 'string' && x !== 'body').pop()
        : null);
    if (!field) continue;
    out[field] = formatApiFieldError(field, entry.message || entry.msg);
  }
  return out;
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

  // Prefer concrete field messages over generic "Please correct the invalid fields."
  const fieldErrors = getApiFieldErrors(err);
  const fieldMsgs = Object.values(fieldErrors).filter(Boolean);
  if (fieldMsgs.length) return fieldMsgs.join('; ');

  const detail = data.detail;
  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    return detail.map((d) => {
      const field = Array.isArray(d.loc)
        ? d.loc.filter((x) => typeof x === 'string').join('.')
        : '';
      return field ? formatApiFieldError(field.split('.').pop(), d.msg) : d.msg;
    }).join('; ');
  }

  if (data.data?.errors?.length) {
    return data.data.errors.map((e) => String(e)).join('; ');
  }

  return data.message || data.error || err.message || 'Request failed';
}

export default api;
