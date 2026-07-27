'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api.js';
import { setAuthSessionCookie, clearAuthSessionCookie } from '../lib/authCookie.js';
import { safeNextPath, loginHref } from '../lib/safeRedirect.js';
import {
  normalizeLoginEmail,
  normalizeLoginPassword,
  parseAuthTokenResponse,
  parseAuthUserResponse,
  isPublicAuthPath,
} from '../lib/authHelpers.js';

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
      api.get('/auth/me').then((r) => {
        const me = parseAuthUserResponse(r.data);
        if (!me?.id) throw new Error('Invalid session');
        setUser(me);
        localStorage.setItem('crm_user', JSON.stringify(me));
        setAuthSessionCookie();
        setLoading(false);
      }).catch(() => {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_refresh_token');
        localStorage.removeItem('crm_user');
        clearAuthSessionCookie();
        setUser(null);
        setLoading(false);
        if (typeof window !== 'undefined' && !isPublicAuthPath(window.location.pathname)) {
          router.replace(loginHref());
        }
      });
    } else {
      setLoading(false);
    }
  }, [router]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', {
      email: normalizeLoginEmail(email),
      password: normalizeLoginPassword(password),
    });
    const auth = parseAuthTokenResponse(res.data);
    if (!auth?.access_token || !auth?.user) {
      throw new Error('Login failed. Please try again.');
    }
    localStorage.setItem('crm_token', auth.access_token);
    localStorage.setItem('crm_refresh_token', auth.refresh_token);
    localStorage.setItem('crm_user', JSON.stringify(auth.user));
    setAuthSessionCookie();
    setUser(auth.user);
    const next = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('next')
      : null;
    router.replace(safeNextPath(next));
  };

  const logout = () => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_refresh_token');
    localStorage.removeItem('crm_user');
    clearAuthSessionCookie();
    setUser(null);
    router.push(loginHref());
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
