import {
  persistAuthSession,
  clearAuthSession,
  hasStoredAuthSession,
  isTransientRequestError,
  shouldAttemptTokenRefresh,
  shouldProactivelyRefresh,
  getAccessTokenExpiresAt,
  AUTH_TOKEN_KEY,
  AUTH_REFRESH_KEY,
  AUTH_USER_KEY,
  AUTH_EXPIRES_KEY,
} from '../authSession.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('isTransientRequestError', () => {
  it('treats timeouts and missing responses as transient', () => {
    expect(isTransientRequestError({ code: 'ECONNABORTED' })).toBe(true);
    expect(isTransientRequestError({ message: 'timeout of 15000ms exceeded' })).toBe(true);
    expect(isTransientRequestError({ message: 'Network Error' })).toBe(true);
    expect(isTransientRequestError({ response: { status: 503 } })).toBe(true);
  });

  it('does not treat 401 as transient', () => {
    expect(isTransientRequestError({ response: { status: 401 } })).toBe(false);
  });
});

describe('shouldAttemptTokenRefresh', () => {
  it('refreshes one 401 when a refresh token is stored', () => {
    localStorage.setItem(AUTH_REFRESH_KEY, 'refresh');
    expect(shouldAttemptTokenRefresh({ url: '/leads' }, 401)).toBe(true);
  });

  it('does not refresh login or already-retried requests', () => {
    localStorage.setItem(AUTH_REFRESH_KEY, 'refresh');
    expect(shouldAttemptTokenRefresh({ url: '/auth/login' }, 401)).toBe(false);
    expect(shouldAttemptTokenRefresh({ url: '/leads', _retry: true }, 401)).toBe(false);
  });
});

describe('shouldProactivelyRefresh', () => {
  it('returns true when access token is near expiry', () => {
    localStorage.setItem(AUTH_REFRESH_KEY, 'refresh');
    localStorage.setItem(AUTH_TOKEN_KEY, 'access');
    localStorage.setItem(AUTH_EXPIRES_KEY, String(Date.now() + 60_000));
    expect(shouldProactivelyRefresh()).toBe(true);
  });

  it('returns false when access token is still fresh', () => {
    localStorage.setItem(AUTH_REFRESH_KEY, 'refresh');
    localStorage.setItem(AUTH_TOKEN_KEY, 'access');
    localStorage.setItem(AUTH_EXPIRES_KEY, String(Date.now() + 60 * 60 * 1000));
    expect(shouldProactivelyRefresh()).toBe(false);
  });
});

describe('auth session storage', () => {
  it('keeps a stored session after persist', () => {
    persistAuthSession({
      access_token: 'a',
      refresh_token: 'b',
      user: { id: 'u1' },
      expires_in: 3600,
    });
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('a');
    expect(localStorage.getItem(AUTH_EXPIRES_KEY)).toBeTruthy();
    expect(hasStoredAuthSession()).toBe(true);
    expect(getAccessTokenExpiresAt()).toBeGreaterThan(Date.now());
  });

  it('clears only when logout is explicit', () => {
    persistAuthSession({
      access_token: 'a',
      refresh_token: 'b',
      user: { id: 'u1' },
      expires_in: 3600,
    });
    clearAuthSession();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_EXPIRES_KEY)).toBeNull();
    expect(hasStoredAuthSession()).toBe(false);
  });
});
