import axios from 'axios';
import { setAuthSessionCookie, clearAuthSessionCookie } from './authCookie.js';
import { loginHref } from './safeRedirect.js';
import { parseAuthTokenResponse } from './authHelpers.js';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://salescrm-api.duckdns.org/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('crm_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (
      err.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !original?._retry &&
      !original?.url?.includes('/auth/login')
    ) {
      const refresh = localStorage.getItem('crm_refresh_token');
      if (refresh) {
        original._retry = true;
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refresh });
          const auth = parseAuthTokenResponse(data);
          if (!auth?.access_token) throw new Error('Refresh failed');
          localStorage.setItem('crm_token', auth.access_token);
          localStorage.setItem('crm_refresh_token', auth.refresh_token);
          localStorage.setItem('crm_user', JSON.stringify(auth.user));
          setAuthSessionCookie();
          original.headers.Authorization = `Bearer ${auth.access_token}`;
          return api(original);
        } catch {
          localStorage.removeItem('crm_token');
          localStorage.removeItem('crm_refresh_token');
          localStorage.removeItem('crm_user');
          clearAuthSessionCookie();
          window.location.href = loginHref();
        }
      } else {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
        clearAuthSessionCookie();
        window.location.href = loginHref();
      }
    }
    return Promise.reject(err);
  }
);

/** Parse FastAPI validation errors */
export function getApiError(err) {
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return 'Request timed out. Check your connection and try again.';
  }
  const data = err.response?.data;
  if (!data) return err.message || 'Request failed';

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
