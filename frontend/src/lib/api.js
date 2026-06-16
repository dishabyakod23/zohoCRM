import axios from 'axios';
import { setAuthSessionCookie, clearAuthSessionCookie } from './authCookie.js';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://api-salescrm.duckdns.org/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
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
          localStorage.setItem('crm_token', data.access_token);
          localStorage.setItem('crm_refresh_token', data.refresh_token);
          localStorage.setItem('crm_user', JSON.stringify(data.user));
          setAuthSessionCookie();
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          localStorage.removeItem('crm_token');
          localStorage.removeItem('crm_refresh_token');
          localStorage.removeItem('crm_user');
          clearAuthSessionCookie();
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
        clearAuthSessionCookie();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

/** Parse FastAPI validation errors */
export function getApiError(err) {
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg).join(', ');
  return err.response?.data?.message || err.response?.data?.error || err.message || 'Request failed';
}

export default api;
