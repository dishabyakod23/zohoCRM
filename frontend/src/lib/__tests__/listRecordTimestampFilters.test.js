import {
  matchesDateRange,
  matchesRecordTimestampFilters,
  applyLeadRecordFilters,
  applyAccountRecordFilters,
} from '../listRecordFilters.js';

describe('matchesRecordTimestampFilters', () => {
  const record = {
    created_at: '2026-03-10T10:00:00.000Z',
    updated_at: '2026-03-15T14:30:00.000Z',
  };

  it('passes when no timestamp filters are set', () => {
    expect(matchesRecordTimestampFilters(record, {})).toBe(true);
  });

  it('filters by created from date', () => {
    expect(matchesRecordTimestampFilters(record, { created_from: '2026-03-11' })).toBe(false);
    expect(matchesRecordTimestampFilters(record, { created_from: '2026-03-10' })).toBe(true);
  });

  it('filters by created to date', () => {
    expect(matchesRecordTimestampFilters(record, { created_to: '2026-03-09' })).toBe(false);
    expect(matchesRecordTimestampFilters(record, { created_to: '2026-03-10' })).toBe(true);
  });

  it('filters by updated date range', () => {
    expect(matchesRecordTimestampFilters(record, { updated_from: '2026-03-16' })).toBe(false);
    expect(matchesRecordTimestampFilters(record, { updated_from: '2026-03-15', updated_to: '2026-03-15' })).toBe(true);
  });
});

describe('applyLeadRecordFilters timestamp filters', () => {
  const leads = [
    { id: '1', company: 'A', created_at: '2026-01-01', updated_at: '2026-02-01' },
    { id: '2', company: 'B', created_at: '2026-03-01', updated_at: '2026-03-10' },
  ];

  it('filters leads by created date range', () => {
    const filtered = applyLeadRecordFilters(leads, { created_from: '2026-02-01' });
    expect(filtered.map((l) => l.id)).toEqual(['2']);
  });
});

describe('applyAccountRecordFilters timestamp filters', () => {
  const accounts = [
    { id: '1', industry: 'Tech', created_at: '2026-01-01', updated_at: '2026-02-01' },
    { id: '2', industry: 'Tech', created_at: '2026-03-01', updated_at: '2026-03-10' },
  ];

  it('filters accounts by updated date range', () => {
    const filtered = applyAccountRecordFilters(accounts, { updated_from: '2026-03-01' });
    expect(filtered.map((a) => a.id)).toEqual(['2']);
  });
});

describe('matchesDateRange', () => {
  it('includes timestamps within the to calendar day', () => {
    const noon = new Date('2026-03-10T12:00:00');
    expect(matchesDateRange(noon.toISOString(), null, '2026-03-10')).toBe(true);
  });
});
