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
