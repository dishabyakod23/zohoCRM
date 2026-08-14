'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api.js';
import { setAuthSessionCookie, clearAuthSessionCookie } from '../lib/authCookie.js';
import { safeNextPath, loginHref } from '../lib/safeRedirect.js';
import {
  parseAuthTokenResponse,
  parseAuthUserResponse,
  readStoredAuthUser,
  isPublicAuthPath,
} from '../lib/authHelpers.js';
import { mergeStoredProfileImage } from '../lib/profileImageHelpers.js';
import { postLogin } from '../lib/authClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    const cachedUser = readStoredAuthUser();
    if (cachedUser && token) {
      setAuthSessionCookie();
      setUser(cachedUser);
      setLoading(false);
      api.get('/auth/me', { timeout: 15000 }).then((r) => {
        const me = parseAuthUserResponse(r.data);
        if (!me?.id) throw new Error('Invalid session');
        setUser(me);
        localStorage.setItem('crm_user', JSON.stringify(me));
        setAuthSessionCookie();
      }).catch(() => {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_refresh_token');
        localStorage.removeItem('crm_user');
        clearAuthSessionCookie();
        setUser(null);
        if (typeof window !== 'undefined' && !isPublicAuthPath(window.location.pathname)) {
          router.replace(loginHref());
        }
      });
    } else {
      setLoading(false);
    }
  }, [router]);

  const login = async (email, password) => {
    const res = await postLogin(email, password);
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

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      const next = mergeStoredProfileImage({ ...prev, ...patch });
      localStorage.setItem('crm_user', JSON.stringify(next));
      return next;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api.get('/auth/me');
    const me = parseAuthUserResponse(res.data);
    if (!me?.id) throw new Error('Invalid session');
    setUser(me);
    localStorage.setItem('crm_user', JSON.stringify(me));
    return me;
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
