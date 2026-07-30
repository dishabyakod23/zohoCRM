import { normalizeAuditLog } from '../auditLogs.js';

describe('normalizeAuditLog — actor name resolution ("Super Admin" regression)', () => {
  it('prefers the actor email over a role-label user_name when a nested user object is present', () => {
    const log = {
      id: '1',
      action: 'update',
      user_name: 'Super Admin',
      user: { first_name: 'Super', last_name: 'Admin', email: 'admin@sterlite.com' },
    };
    expect(normalizeAuditLog(log).user_name).toBe('admin@sterlite.com');
  });

  it('keeps a real user_name unchanged even if a nested user object also exists', () => {
    const log = {
      id: '2',
      action: 'create',
      user_name: 'Raksha Chaturvedi',
      user: { first_name: 'Raksha', last_name: 'Chaturvedi', email: 'raksha@sterlite.com' },
    };
    expect(normalizeAuditLog(log).user_name).toBe('Raksha Chaturvedi');
  });

  it('falls back to the role-label name when no nested user/email is available at all', () => {
    const log = { id: '3', action: 'update', user_name: 'Super Admin' };
    expect(normalizeAuditLog(log).user_name).toBe('Super Admin');
  });

  it('resolves from the nested user object when user_name is entirely absent', () => {
    const log = { id: '4', action: 'update', user: { first_name: 'Raksha', last_name: 'Chaturvedi' } };
    expect(normalizeAuditLog(log).user_name).toBe('Raksha Chaturvedi');
  });

  it('falls back to "—" when there is no name information anywhere', () => {
    const log = { id: '5', action: 'update' };
    expect(normalizeAuditLog(log).user_name).toBe('—');
  });
});
