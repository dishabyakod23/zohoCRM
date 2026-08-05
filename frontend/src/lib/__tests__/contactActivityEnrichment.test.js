import {
  formatContactLastCallLabel,
  buildLatestCallByPhoneKey,
  rowMatchesActivityDateRange,
} from '../contactActivityEnrichment.js';
import { buildOutreachActivityIndex, setLinkedInRequestSent } from '../outreachActivity.js';
import { ownerContactCallSummary } from '../services/cloudTalkCalls.js';

describe('ownerContactCallSummary', () => {
  it('formats xyz called abc(1234567890)', () => {
    expect(ownerContactCallSummary({
      callerName: 'xyz',
      contactName: 'abc',
      phone: '1234567890',
      duration: 45,
      status: 'answered',
    })).toBe('xyz called abc(1234567890) (45s)');
  });
});

describe('formatContactLastCallLabel', () => {
  it('shows connected duration and timestamp', () => {
    const label = formatContactLastCallLabel({
      duration: 45,
      status: 'answered',
      created_at: '2026-08-05T10:30:00.000Z',
    });
    expect(label).toContain('connected (45s)');
    expect(label).toContain('on');
  });
});

describe('buildLatestCallByPhoneKey', () => {
  it('indexes CloudTalk calls by phone', () => {
    const map = buildLatestCallByPhoneKey([
      {
        source: 'cloudtalk',
        created_at: '2026-08-05T10:00:00.000Z',
        summary: 'John called Jane(9999999999) (30s)',
        meta: { external_number: '9999999999', duration: 30, cdr: { type: 'outgoing' } },
      },
    ]);
    expect(map.get('9999999999')?.duration).toBe(30);
  });
});

describe('rowMatchesActivityDateRange', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('matches linkedin request activity in date range', () => {
    setLinkedInRequestSent('c1', { sent: true, user: { id: 'u1', name: 'Rep' } });
    const outreachIndex = buildOutreachActivityIndex();
    const row = { record_id: 'c1', id: 'contact:c1' };
    const sentAt = outreachIndex.c1[0].at.slice(0, 10);
    expect(rowMatchesActivityDateRange(row, { activity_from: sentAt, activity_to: sentAt }, { outreachIndex })).toBe(true);
  });
});
