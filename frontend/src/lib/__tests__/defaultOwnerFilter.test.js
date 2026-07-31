import { defaultOwnerFilterId, withDefaultOwnerFilters, countActiveFilters, EMPTY_CONTACT_FILTERS } from '../listRecordFilters.js';

describe('defaultOwnerFilterId', () => {
  it('returns empty string for super admin', () => {
    expect(defaultOwnerFilterId({ id: '1', role: 'super_admin' })).toBe('');
  });

  it('returns user id for sales manager', () => {
    expect(defaultOwnerFilterId({ id: 'mgr1', role: 'sales_manager' })).toBe('mgr1');
  });

  it('returns user id for sales rep', () => {
    expect(defaultOwnerFilterId({ id: 'rep1', role: 'sales_rep' })).toBe('rep1');
  });

  it('returns empty string when user is missing', () => {
    expect(defaultOwnerFilterId(null)).toBe('');
  });
});

describe('withDefaultOwnerFilters', () => {
  it('merges default owner into empty filters', () => {
    expect(withDefaultOwnerFilters(EMPTY_CONTACT_FILTERS, { id: 'u1', role: 'sales_rep' })).toEqual({
      ...EMPTY_CONTACT_FILTERS,
      owner_id: 'u1',
    });
  });
});

describe('countActiveFilters', () => {
  it('does not count default owner as an active filter', () => {
    const user = { id: 'u1', role: 'sales_rep' };
    expect(countActiveFilters({ ...EMPTY_CONTACT_FILTERS, owner_id: 'u1' }, user)).toBe(0);
  });

  it('counts non-default owner as active', () => {
    const user = { id: 'u1', role: 'sales_rep' };
    expect(countActiveFilters({ ...EMPTY_CONTACT_FILTERS, owner_id: 'u2' }, user)).toBe(1);
  });
});
