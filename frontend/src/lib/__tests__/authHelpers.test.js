import {
  normalizeLoginEmail,
  normalizeLoginPassword,
  parseAuthTokenResponse,
  parseAuthUserResponse,
  isPublicAuthPath,
} from '../authHelpers.js';

describe('normalizeLoginEmail', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalizeLoginEmail('  Ada@Example.COM  ')).toBe('ada@example.com');
  });

  it('handles empty/undefined input without throwing', () => {
    expect(normalizeLoginEmail(undefined)).toBe('');
    expect(normalizeLoginEmail(null)).toBe('');
    expect(normalizeLoginEmail('')).toBe('');
  });
});

describe('normalizeLoginPassword', () => {
  it('trims only leading/trailing whitespace, preserving internal spaces', () => {
    expect(normalizeLoginPassword('  s3cret pass  ')).toBe('s3cret pass');
  });

  it('handles empty/undefined input without throwing', () => {
    expect(normalizeLoginPassword(undefined)).toBe('');
  });
});

describe('parseAuthTokenResponse', () => {
  it('returns null for falsy input', () => {
    expect(parseAuthTokenResponse(null)).toBeNull();
    expect(parseAuthTokenResponse(undefined)).toBeNull();
  });

  it('returns the body as-is when access_token is at the top level', () => {
    const body = { access_token: 'a', refresh_token: 'b', user: { id: 'u1' } };
    expect(parseAuthTokenResponse(body)).toBe(body);
  });

  it('unwraps a { data } envelope', () => {
    const inner = { access_token: 'a', refresh_token: 'b', user: { id: 'u1' } };
    expect(parseAuthTokenResponse({ data: inner })).toBe(inner);
  });

  it('returns null when neither shape matches', () => {
    expect(parseAuthTokenResponse({ message: 'nope' })).toBeNull();
    expect(parseAuthTokenResponse({ data: { message: 'nope' } })).toBeNull();
  });
});

describe('parseAuthUserResponse', () => {
  it('returns null for falsy input', () => {
    expect(parseAuthUserResponse(null)).toBeNull();
  });

  it('returns the body as-is when id is at the top level', () => {
    const body = { id: 'u1', role: 'business_rep' };
    expect(parseAuthUserResponse(body)).toBe(body);
  });

  it('unwraps a single-level { data } envelope', () => {
    expect(parseAuthUserResponse({ data: { id: 'u1' } }).id).toBe('u1');
  });

  it('returns null when no id is found at any known depth', () => {
    expect(parseAuthUserResponse({ data: { message: 'nope' } })).toBeNull();
    expect(parseAuthUserResponse({})).toBeNull();
  });
});

describe('isPublicAuthPath', () => {
  it('recognizes login, forgot-password, and reset-password with or without a trailing slash', () => {
    expect(isPublicAuthPath('/login')).toBe(true);
    expect(isPublicAuthPath('/login/')).toBe(true);
    expect(isPublicAuthPath('/forgot-password')).toBe(true);
    expect(isPublicAuthPath('/reset-password')).toBe(true);
  });

  it('treats every other path as protected', () => {
    expect(isPublicAuthPath('/dashboard')).toBe(false);
    expect(isPublicAuthPath('/leads/123')).toBe(false);
    expect(isPublicAuthPath('')).toBe(false);
    expect(isPublicAuthPath(undefined)).toBe(false);
  });
});
