import { getSortApiParams, sortRecords } from '../listSortHelpers.js';

describe('listSortHelpers email sorting', () => {
  const rows = [
    { email: 'zebra@example.com', first_name: 'Z' },
    { email: 'alpha@example.com', first_name: 'A' },
    { email: 'mike@example.com', first_name: 'M' },
  ];

  it('maps email_asc to API params', () => {
    expect(getSortApiParams('email_asc', 'contacts')).toEqual({
      sort_by: 'email',
      sort_order: 'asc',
    });
  });

  it('maps email_desc to API params', () => {
    expect(getSortApiParams('email_desc', 'leads')).toEqual({
      sort_by: 'email',
      sort_order: 'desc',
    });
  });

  it('sorts records by email ascending', () => {
    const sorted = sortRecords(rows, 'email_asc', 'contacts');
    expect(sorted.map((r) => r.email)).toEqual([
      'alpha@example.com',
      'mike@example.com',
      'zebra@example.com',
    ]);
  });

  it('sorts records by email descending', () => {
    const sorted = sortRecords(rows, 'email_desc', 'contacts');
    expect(sorted.map((r) => r.email)).toEqual([
      'zebra@example.com',
      'mike@example.com',
      'alpha@example.com',
    ]);
  });
});

describe('listSortHelpers recycle-bin name sorting', () => {
  const rows = [
    { entity_name: 'Vasu Ojha' },
    { entity_name: 'Sudeep G N' },
    { entity_name: 'ewfygqeyfg' },
    { entity_name: 'Abhishek S' },
    { entity_name: 'ddwfow evewv' },
  ];

  it('maps name sort to name field and date sort to deleted_at', () => {
    expect(getSortApiParams('name_asc', 'recycle-bin')).toEqual({
      sort_by: 'name',
      sort_order: 'asc',
    });
    expect(getSortApiParams('created_desc', 'recycle-bin')).toEqual({
      sort_by: 'deleted_at',
      sort_order: 'desc',
    });
  });

  it('sorts names A→Z case-insensitively', () => {
    const sorted = sortRecords(rows, 'name_asc', 'recycle-bin');
    expect(sorted.map((r) => r.entity_name)).toEqual([
      'Abhishek S',
      'ddwfow evewv',
      'ewfygqeyfg',
      'Sudeep G N',
      'Vasu Ojha',
    ]);
  });
});
