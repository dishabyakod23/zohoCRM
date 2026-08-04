import { isGenericRoleName, personDisplayName, ownerName } from '../recordHelpers.js';

describe('isGenericRoleName', () => {
  it('flags known role labels, case-insensitively', () => {
    expect(isGenericRoleName('Super Admin')).toBe(true);
    expect(isGenericRoleName('super admin')).toBe(true);
    expect(isGenericRoleName('Business Development Manager')).toBe(true);
    expect(isGenericRoleName('Business Development Executive')).toBe(true);
    expect(isGenericRoleName('Sales Manager')).toBe(true);
    expect(isGenericRoleName('Business Rep')).toBe(true);
    expect(isGenericRoleName('Viewer')).toBe(true);
    expect(isGenericRoleName('Admin')).toBe(true);
    expect(isGenericRoleName('System')).toBe(true);
  });

  it('does not flag an ordinary person name', () => {
    expect(isGenericRoleName('Raksha Chaturvedi')).toBe(false);
    expect(isGenericRoleName('')).toBe(false);
    expect(isGenericRoleName(undefined)).toBe(false);
  });
});

describe('personDisplayName', () => {
  it('returns the name when it is a real (non-generic) name', () => {
    expect(personDisplayName({ name: 'Raksha Chaturvedi', email: 'raksha@x.com' })).toBe('Raksha Chaturvedi');
  });

  it('falls back to email when the name is a role placeholder', () => {
    expect(personDisplayName({ name: 'Super Admin', email: 'admin@sterlite.com' })).toBe('admin@sterlite.com');
  });

  it('falls back to the (generic) name when no email is available', () => {
    expect(personDisplayName({ name: 'Super Admin' })).toBe('Super Admin');
  });

  it('returns null when neither name nor email is present', () => {
    expect(personDisplayName({})).toBeNull();
    expect(personDisplayName()).toBeNull();
  });
});

describe('ownerName (record owner resolution — "Super Admin" regression)', () => {
  it('prefers the owner email over a role-label name', () => {
    const record = { owner: { first_name: 'Super', last_name: 'Admin', email: 'admin@sterlite.com' } };
    expect(ownerName(record)).toBe('admin@sterlite.com');
  });

  it('returns a real owner name unchanged', () => {
    const record = { owner: { first_name: 'Raksha', last_name: 'Chaturvedi', email: 'raksha@sterlite.com' } };
    expect(ownerName(record)).toBe('Raksha Chaturvedi');
  });

  it('falls back to the flat owner_name field when there is no nested owner object', () => {
    expect(ownerName({ owner_name: 'Raksha Chaturvedi' })).toBe('Raksha Chaturvedi');
  });

  it('returns null for a record with no owner information at all', () => {
    expect(ownerName({})).toBeNull();
    expect(ownerName(null)).toBeNull();
  });
});
