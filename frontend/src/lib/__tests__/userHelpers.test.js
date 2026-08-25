import { sortUsersNewestFirst, userInitials } from '../userHelpers.js';

describe('sortUsersNewestFirst', () => {
  it('puts the most recently created user first', () => {
    const users = [
      { id: '1', created_at: '2026-01-01T00:00:00Z' },
      { id: '2', created_at: '2026-08-24T00:00:00Z' },
      { id: '3', created_at: '2026-03-01T00:00:00Z' },
    ];
    expect(sortUsersNewestFirst(users).map((u) => u.id)).toEqual(['2', '3', '1']);
  });
});

describe('userInitials', () => {
  it('returns fallback initials when the name is empty', () => {
    expect(userInitials('')).toBe('U');
    expect(userInitials({ first_name: 'Sudeep', last_name: 'GN' })).toBe('SG');
  });
});
