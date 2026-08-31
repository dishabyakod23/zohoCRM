import { sortUsersNewestFirst, userInitials, enrichCreatedUser, mergeAdminUserLists, rememberUserCreatedAt } from '../userHelpers.js';

describe('sortUsersNewestFirst', () => {
  it('puts the most recently created user first', () => {
    const users = [
      { id: '1', created_at: '2026-01-01T00:00:00Z' },
      { id: '2', created_at: '2026-08-24T00:00:00Z' },
      { id: '3', created_at: '2026-03-01T00:00:00Z' },
    ];
    expect(sortUsersNewestFirst(users).map((u) => u.id)).toEqual(['2', '3', '1']);
  });

  it('falls back to numeric id when created_at is missing', () => {
    const users = [{ id: '10' }, { id: '2' }, { id: '99' }];
    expect(sortUsersNewestFirst(users).map((u) => u.id)).toEqual(['99', '10', '2']);
  });
});

describe('mergeAdminUserLists', () => {
  it('preserves local created_at after reload', () => {
    const previous = [{ id: 'new-1', created_at: '2026-08-31T12:00:00Z', email: 'a@test.com' }];
    const incoming = [{ id: 'new-1', email: 'a@test.com' }, { id: 'old-1', created_at: '2026-01-01T00:00:00Z' }];
    const merged = mergeAdminUserLists(previous, incoming);
    expect(merged[0].id).toBe('new-1');
    expect(merged[0].created_at).toBe('2026-08-31T12:00:00Z');
  });
});

describe('enrichCreatedUser', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('adds created_at when the API omits it', () => {
    const enriched = enrichCreatedUser({ id: '1', email: 'a@test.com' });
    expect(enriched.created_at).toBeTruthy();
  });

  it('persists created_at in localStorage for hard refresh', () => {
    enrichCreatedUser({ id: 'new-1', email: 'a@test.com' });
    const merged = mergeAdminUserLists([], [{ id: 'new-1', email: 'a@test.com' }, { id: 'old-1' }]);
    expect(merged[0].id).toBe('new-1');
    expect(merged[0].created_at).toBeTruthy();
  });
});

describe('rememberUserCreatedAt', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores API created_at without overwriting an earlier timestamp', () => {
    rememberUserCreatedAt({ id: '1', created_at: '2026-08-31T12:00:00Z' });
    rememberUserCreatedAt({ id: '1', created_at: '2026-01-01T00:00:00Z' });
    const merged = mergeAdminUserLists([], [{ id: '1', email: 'a@test.com' }]);
    expect(merged[0].created_at).toBe('2026-08-31T12:00:00Z');
  });
});

describe('userInitials', () => {
  it('returns fallback initials when the name is empty', () => {
    expect(userInitials('')).toBe('U');
    expect(userInitials({ first_name: 'Sudeep', last_name: 'GN' })).toBe('SG');
  });
});
