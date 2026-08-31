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
  registerSessionExpiredHandler,
  resetSessionExpiredGuard,
  shouldProactivelyRefresh,
  isAuthFailureError,
  isInvalidSessionError,
  isTransientRequestError,
  ACCESS_TOKEN_REFRESH_BUFFER_MS,
  getAccessTokenExpiresAt,
  AUTH_TOKEN_KEY,
  AUTH_REFRESH_KEY,
  AUTH_EXPIRES_KEY,
} from '../lib/authSession.js';
import { useToast } from '../components/ui/Toast.js';

const FALLBACK_REFRESH_MS = 10 * 60 * 1000;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { showToast } = useToast();

  const applyUser = useCallback((nextUser) => {
    if (!nextUser?.id) return;
    setUser(nextUser);
    persistAuthSession({ user: nextUser });
  }, []);

  const logout = useCallback((options = {}) => {
    const { redirect = true, toastMessage = null } = options;
    markSkipLoginNext();
    clearAuthSession();
    setUser(null);
    if (toastMessage) showToast(toastMessage, 'error');
    if (redirect) router.push('/login');
  }, [router, showToast]);

  useEffect(() => {
    registerSessionExpiredHandler((message) => {
      logout({ toastMessage: message });
    });
    return () => registerSessionExpiredHandler(null);
  }, [logout]);

  const syncSession = useCallback(async () => {
    const refresh = hasStoredAuthSession();
    if (!refresh) return false;

    if (shouldProactivelyRefresh()) {
      try {
        const auth = await refreshAuthSession();
        if (auth?.user?.id) {
          applyUser(parseAuthUserResponse(auth.user) || auth.user);
        }
      } catch (err) {
        if (isAuthFailureError(err)) {
          logout({ toastMessage: 'Your session has expired. Please sign in again.' });
          return false;
        }
      }
    }

    try {
      const res = await api.get('/auth/me');
      const me = parseAuthUserResponse(res.data);
      if (me?.id) {
        applyUser(me);
        if (isInactiveUser(me)) {
          logout({ toastMessage: INACTIVE_ACCOUNT_MESSAGE });
          return false;
        }
        return true;
      }
    } catch (err) {
      if (isInvalidSessionError(err)) {
        logout({ toastMessage: 'Your session has expired. Please sign in again.' });
        return false;
      }
      if (isTransientRequestError(err)) {
        const cachedUser = readStoredAuthUser();
        if (cachedUser?.id) applyUser(cachedUser);
        return true;
      }
      const cachedUser = readStoredAuthUser();
      if (cachedUser?.id && hasStoredAuthSession()) {
        applyUser(cachedUser);
        return true;
      }
    }
    return Boolean(readStoredAuthUser()?.id);
  }, [applyUser, logout]);

  useEffect(() => {
    resetSessionExpiredGuard();
    if (hasStoredAuthSession()) {
      const cachedUser = readStoredAuthUser();
      if (cachedUser?.id) setUser(cachedUser);
      syncSession().finally(() => setLoading(false));
      return;
    }
    setLoading(false);
  }, [syncSession]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onStorage = (event) => {
      if (![AUTH_TOKEN_KEY, AUTH_REFRESH_KEY, AUTH_EXPIRES_KEY, 'crm_user'].includes(event.key)) return;
      resetSessionExpiredGuard();
      if (hasStoredAuthSession()) {
        const cachedUser = readStoredAuthUser();
        if (cachedUser?.id) setUser(cachedUser);
      } else {
        setUser(null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;

    let refreshTimer;

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      const expiresAt = getAccessTokenExpiresAt();
      const delay = expiresAt
        ? Math.max(60000, expiresAt - Date.now() - ACCESS_TOKEN_REFRESH_BUFFER_MS)
        : FALLBACK_REFRESH_MS;
      refreshTimer = window.setTimeout(() => {
        syncSession().finally(scheduleRefresh);
      }, delay);
    };

    scheduleRefresh();

    const onVisible = () => {
      if (document.visibilityState === 'visible' && shouldProactivelyRefresh()) {
        syncSession();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      window.clearTimeout(refreshTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [user?.id, syncSession]);

  const login = async (email, password) => {
    resetSessionExpiredGuard();
    const res = await postLogin(email, password);
    const auth = parseAuthTokenResponse(res.data);
    if (!auth?.access_token || !auth?.user) {
      throw new Error('Login failed. Please try again.');
    }
    persistAuthSession({
      access_token: auth.access_token,
      refresh_token: auth.refresh_token,
      user: auth.user,
      expires_in: auth.expires_in,
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
