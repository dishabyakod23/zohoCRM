'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api.js';
import { safeNextPath, loginHref, markSkipLoginNext, consumeSkipLoginNext } from '../lib/safeRedirect.js';
import {
  parseAuthTokenResponse,
  parseAuthUserResponse,
  readStoredAuthUser,
  isInactiveUser,
  INACTIVE_ACCOUNT_MESSAGE,
} from '../lib/authHelpers.js';
import { mergeStoredProfileImage } from '../lib/profileImageHelpers.js';
import { postLogin } from '../lib/authClient.js';
import {
  persistAuthSession,
  clearAuthSession,
  hasStoredAuthSession,
  refreshAuthSession,
} from '../lib/authSession.js';

const SESSION_REFRESH_MS = 10 * 60 * 1000;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const applyUser = useCallback((nextUser) => {
    if (!nextUser?.id) return;
    setUser(nextUser);
    persistAuthSession({ user: nextUser });
  }, []);

  const syncSession = useCallback(async () => {
    try {
      const auth = await refreshAuthSession();
      if (auth?.user?.id) applyUser(parseAuthUserResponse(auth.user) || auth.user);
    } catch {
      // Keep the existing session if refresh is unavailable.
    }

    try {
      const res = await api.get('/auth/me');
      const me = parseAuthUserResponse(res.data);
      if (me?.id) applyUser(me);
      if (isInactiveUser(me)) {
        clearAuthSession();
        setUser(null);
      }
    } catch {
      // Timeouts, 401s, and network errors must not force a logout.
    }
  }, [applyUser]);

  useEffect(() => {
    const cachedUser = readStoredAuthUser();
    if (hasStoredAuthSession() && cachedUser?.id) {
      persistAuthSession({});
      setUser(cachedUser);
      setLoading(false);
      syncSession();
      return;
    }

    if (hasStoredAuthSession()) {
      persistAuthSession({});
      syncSession().finally(() => setLoading(false));
      return;
    }

    setLoading(false);
  }, [syncSession]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const refreshQuietly = () => { syncSession(); };
    const timer = window.setInterval(refreshQuietly, SESSION_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshQuietly();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshQuietly);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshQuietly);
    };
  }, [user?.id, syncSession]);

  const login = async (email, password) => {
    const res = await postLogin(email, password);
    const auth = parseAuthTokenResponse(res.data);
    if (!auth?.access_token || !auth?.user) {
      throw new Error('Login failed. Please try again.');
    }
    persistAuthSession({
      access_token: auth.access_token,
      refresh_token: auth.refresh_token,
      user: auth.user,
    });
    if (isInactiveUser(auth.user)) {
      clearAuthSession();
      setUser(null);
      throw new Error(INACTIVE_ACCOUNT_MESSAGE);
    }
    setUser(auth.user);
    const skipNext = consumeSkipLoginNext();
    const next = skipNext || typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('next');
    router.replace(safeNextPath(next));
  };

  const logout = () => {
    markSkipLoginNext();
    clearAuthSession();
    setUser(null);
    router.push('/login');
  };

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      const next = mergeStoredProfileImage({ ...prev, ...patch });
      persistAuthSession({ user: next });
      return next;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      const me = parseAuthUserResponse(res.data);
      if (me?.id) {
        applyUser(me);
        return me;
      }
    } catch {
      // Keep the stored user if /auth/me cannot be reached.
    }
    return readStoredAuthUser();
  }, [applyUser]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
