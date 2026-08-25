import { safeNextPath, loginHref, markSkipLoginNext, SKIP_LOGIN_NEXT_KEY } from '../safeRedirect.js';

describe('safeNextPath', () => {
  it('allows a plain in-app path', () => {
    expect(safeNextPath('/contacts/abc')).toBe('/contacts/abc');
  });

  it('falls back for non-string/empty input', () => {
    expect(safeNextPath(null)).toBe('/dashboard');
    expect(safeNextPath(undefined)).toBe('/dashboard');
    expect(safeNextPath('')).toBe('/dashboard');
    expect(safeNextPath(42)).toBe('/dashboard');
  });

  it('blocks protocol-relative open-redirect payloads', () => {
    expect(safeNextPath('//evil.com')).toBe('/dashboard');
  });

  it('blocks absolute URLs to other origins', () => {
    expect(safeNextPath('https://evil.com')).toBe('/dashboard');
    expect(safeNextPath('http://evil.com/leads')).toBe('/dashboard');
  });

  it('blocks paths that do not start with a slash', () => {
    expect(safeNextPath('evil.com')).toBe('/dashboard');
  });

  it('blocks embedded double slashes anywhere in the path', () => {
    expect(safeNextPath('/dashboard//evil')).toBe('/dashboard');
  });

  it('respects a custom fallback', () => {
    expect(safeNextPath(null, '/leads')).toBe('/leads');
  });

  it('trims surrounding whitespace on an otherwise-safe path', () => {
    expect(safeNextPath('  /accounts  ')).toBe('/accounts');
  });
});

describe('loginHref', () => {
  // jsdom's window.location is a non-configurable browser-navigation object and can't be
  // reassigned in tests, so these exercise the explicit `nextPath` argument instead of
  // stubbing window.location — it's the same code path `loginHref()` falls through to.

  it('redirects to /dashboard (not back to /login itself) when already on /login', () => {
    expect(loginHref('/login')).toBe('/login?next=%2Fdashboard');
  });

  it('preserves the current path as ?next= for a protected page', () => {
    expect(loginHref('/leads/123')).toBe('/login?next=%2Fleads%2F123');
  });

  it('preserves query params on the current path', () => {
    expect(loginHref('/leads?filter=mine')).toBe(`/login?next=${encodeURIComponent('/leads?filter=mine')}`);
  });

  it('falls back to a bare /login when the resolved next path is unsafe', () => {
    expect(loginHref('https://evil.com')).toBe('/login');
  });

  it('defaults to reading window.location when no argument is given', () => {
    // jsdom's default test URL is http://localhost/
    expect(loginHref()).toBe('/login?next=%2F');
  });

  it('omits ?next= after an explicit logout', () => {
    markSkipLoginNext();
    expect(loginHref('/calendar')).toBe('/login');
    sessionStorage.removeItem(SKIP_LOGIN_NEXT_KEY);
  });
});
