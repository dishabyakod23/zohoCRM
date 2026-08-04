import { defaultOwnerFilterId, withDefaultOwnerFilters, countActiveFilters, EMPTY_CONTACT_FILTERS } from '../listRecordFilters.js';

describe('defaultOwnerFilterId', () => {
  it('returns empty for super admin (all owners)', () => {
    expect(defaultOwnerFilterId({ id: '1', role: 'super_admin' })).toBe('');
  });

  it('returns user id for sales manager', () => {
    expect(defaultOwnerFilterId({ id: 'mgr1', role: 'sales_manager' })).toBe('mgr1');
  });

  it('returns user id for sales rep', () => {
    expect(defaultOwnerFilterId({ id: 'rep1', role: 'sales_rep' })).toBe('rep1');
  });

  it('returns empty for viewer (view all records)', () => {
    expect(defaultOwnerFilterId({ id: 'v1', role: 'viewer' })).toBe('');
  });

  it('returns empty string when user is missing', () => {
    expect(defaultOwnerFilterId(null)).toBe('');
  });
});

describe('withDefaultOwnerFilters', () => {
  it('merges default owner for sales rep', () => {
    expect(withDefaultOwnerFilters(EMPTY_CONTACT_FILTERS, { id: 'u1', role: 'sales_rep' })).toEqual({
      ...EMPTY_CONTACT_FILTERS,
      owner_id: 'u1',
    });
  });

  it('leaves owner empty for super admin', () => {
    expect(withDefaultOwnerFilters(EMPTY_CONTACT_FILTERS, { id: 'u1', role: 'super_admin' })).toEqual({
      ...EMPTY_CONTACT_FILTERS,
      owner_id: '',
    });
  });

  it('merges default owner for sales manager', () => {
    expect(withDefaultOwnerFilters(EMPTY_CONTACT_FILTERS, { id: 'u1', role: 'sales_manager' })).toEqual({
      ...EMPTY_CONTACT_FILTERS,
      owner_id: 'u1',
    });
  });
});

describe('countActiveFilters', () => {
  it('does not count default owner as active for sales rep', () => {
    const user = { id: 'u1', role: 'sales_rep' };
    expect(countActiveFilters({ ...EMPTY_CONTACT_FILTERS, owner_id: 'u1' }, user)).toBe(0);
  });

  it('counts non-default owner as active for sales rep', () => {
    const user = { id: 'u1', role: 'sales_rep' };
    expect(countActiveFilters({ ...EMPTY_CONTACT_FILTERS, owner_id: 'u2' }, user)).toBe(1);
  });

  it('counts owner filter as active for super admin', () => {
    const user = { id: 'u1', role: 'super_admin' };
    expect(countActiveFilters({ ...EMPTY_CONTACT_FILTERS, owner_id: 'u1' }, user)).toBe(1);
  });

  it('counts non-default owner as active for sales manager', () => {
    const user = { id: 'u1', role: 'sales_manager' };
    expect(countActiveFilters({ ...EMPTY_CONTACT_FILTERS, owner_id: 'u2' }, user)).toBe(1);
  });
});
