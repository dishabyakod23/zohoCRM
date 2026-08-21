import axios from 'axios';
import { getStoredAccessToken, refreshAuthSession, shouldAttemptTokenRefresh } from './authSession.js';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://salescrm-api.duckdns.org/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 45000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getStoredAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
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
        if (!auth?.access_token) return Promise.reject(err);
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${auth.access_token}`;
        return api(original);
      } catch {
        return Promise.reject(err);
      }
    }
    return Promise.reject(err);
  }
);

/** Parse FastAPI validation errors */
export function getApiError(err) {
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
