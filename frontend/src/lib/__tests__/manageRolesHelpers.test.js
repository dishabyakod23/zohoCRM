import {
  sanitizeRoleText,
  slugifyRoleKey,
  validateRoleName,
  validateRoleDescription,
  isProtectedRoleKey,
  canDeleteRole,
  ROLE_NAME_MAX_LENGTH,
} from '../manageRolesHelpers.js';

describe('sanitizeRoleText', () => {
  it('strips angle brackets', () => {
    expect(sanitizeRoleText('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
  });

  it('trims whitespace', () => {
    expect(sanitizeRoleText('  Junior Sales  ')).toBe('Junior Sales');
  });
});

describe('slugifyRoleKey', () => {
  it('lowercases and replaces non-alphanumeric runs with a single underscore', () => {
    expect(slugifyRoleKey('Junior Sales Rep')).toBe('junior_sales_rep');
    expect(slugifyRoleKey('  Regional -- Manager!! ')).toBe('regional_manager');
  });

  it('returns an empty string for input with no alphanumeric characters', () => {
    expect(slugifyRoleKey('!!!')).toBe('');
  });
});

describe('validateRoleName', () => {
  const existing = [{ id: '1', name: 'Business Development Executive' }, { id: '2', name: 'Viewer' }];

  it('requires a name', () => {
    expect(validateRoleName('', existing)).toBe('Role name is required.');
    expect(validateRoleName('   ', existing)).toBe('Role name is required.');
  });

  it('rejects names over the max length', () => {
    const long = 'x'.repeat(ROLE_NAME_MAX_LENGTH + 1);
    expect(validateRoleName(long, existing)).toMatch(/50 characters or fewer/);
  });

  it('accepts a name exactly at the max length', () => {
    const exact = 'x'.repeat(ROLE_NAME_MAX_LENGTH);
    expect(validateRoleName(exact, existing)).toBeNull();
  });

  it('rejects names containing angle brackets', () => {
    expect(validateRoleName('<b>Manager</b>', existing)).toMatch(/cannot contain/);
  });

  it('rejects a duplicate name, case-insensitively', () => {
    expect(validateRoleName('viewer', existing)).toBe('This role name already exists.');
    expect(validateRoleName('VIEWER', existing)).toBe('This role name already exists.');
  });

  it('allows a role to keep its own name when editing (excluded from the duplicate check)', () => {
    expect(validateRoleName('Viewer', existing, '2')).toBeNull();
  });

  it('accepts a valid, unique name', () => {
    expect(validateRoleName('Regional Manager', existing)).toBeNull();
  });
});

describe('validateRoleDescription', () => {
  it('allows an empty description', () => {
    expect(validateRoleDescription('')).toBeNull();
    expect(validateRoleDescription(undefined)).toBeNull();
  });

  it('rejects a description containing angle brackets', () => {
    expect(validateRoleDescription('<img src=x onerror=alert(1)>')).toMatch(/cannot contain/);
  });

  it('accepts an ordinary description', () => {
    expect(validateRoleDescription('Handles inbound leads for the west region.')).toBeNull();
  });
});

describe('isProtectedRoleKey (re-exported)', () => {
  it('protects the built-in roles', () => {
    expect(isProtectedRoleKey('super_admin')).toBe(true);
    expect(isProtectedRoleKey('custom_role')).toBe(false);
  });
});

describe('canDeleteRole', () => {
  it('refuses to delete a system role regardless of assignment count', () => {
    expect(canDeleteRole({ is_system: true, key: 'custom_role' }, 0)).toBe(false);
  });

  it('refuses to delete a protected key even if not flagged is_system', () => {
    expect(canDeleteRole({ key: 'viewer' }, 0)).toBe(false);
  });

  it('refuses to delete a custom role with assigned users', () => {
    expect(canDeleteRole({ key: 'custom_role' }, 3)).toBe(false);
  });

  it('allows deleting a custom role with zero assigned users', () => {
    expect(canDeleteRole({ key: 'custom_role' }, 0)).toBe(true);
  });

  it('returns false for a null role', () => {
    expect(canDeleteRole(null, 0)).toBe(false);
  });
});
