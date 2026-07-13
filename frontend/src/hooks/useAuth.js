'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api.js';
import { setAuthSessionCookie, clearAuthSessionCookie } from '../lib/authCookie.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('crm_user');
    const token = localStorage.getItem('crm_token');
    if (stored && token) {
      setAuthSessionCookie();
      setUser(JSON.parse(stored));
      api.get('/auth/me').then(r => {
        setUser(r.data);
        localStorage.setItem('crm_user', JSON.stringify(r.data));
        setAuthSessionCookie();
      }).catch(() => {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_refresh_token');
        localStorage.removeItem('crm_user');
        clearAuthSessionCookie();
        setUser(null);
        router.replace('/login');
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [router]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('crm_token', res.data.access_token);
    localStorage.setItem('crm_refresh_token', res.data.refresh_token);
    localStorage.setItem('crm_user', JSON.stringify(res.data.user));
    setAuthSessionCookie();
    setUser(res.data.user);
    const next = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('next')
      : null;
    router.push(next?.startsWith('/') ? next : '/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_refresh_token');
    localStorage.removeItem('crm_user');
    clearAuthSessionCookie();
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
