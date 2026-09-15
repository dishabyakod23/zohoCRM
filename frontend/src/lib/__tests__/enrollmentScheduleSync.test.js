import {
  enrollmentNextActionFromStep,
  clampScheduledAtToSendWindow,
  sameScheduleInstant,
} from '../sequenceHelpers.js';

describe('enrollment schedule sync helpers', () => {
  it('builds next_action from step schedule in sequence timezone', () => {
    const next = enrollmentNextActionFromStep(
      {
        scheduled_date: '2026-09-15',
        scheduled_time: '12:35:00',
        timezone: 'Asia/Kolkata',
      },
      {
        timezone: 'Asia/Kolkata',
        send_window_start: '12:35',
        send_window_end: '12:45',
        send_days: 62,
      },
    );
    // 12:35 IST = 07:05 UTC
    expect(next).toBe('2026-09-15T07:05:00.000Z');
  });

  it('clamps times before the send window up to window start', () => {
    const clamped = clampScheduledAtToSendWindow('2026-09-15T06:49:00.000Z', {
      timezone: 'Asia/Kolkata',
      send_window_start: '12:35',
      send_window_end: '12:45',
      send_days: 62,
    });
    expect(clamped).toBe('2026-09-15T07:05:00.000Z');
  });

  it('treats nearby timestamps as the same schedule instant', () => {
    expect(sameScheduleInstant(
      '2026-09-15T07:05:00.000Z',
      '2026-09-15T07:05:30.000Z',
    )).toBe(true);
  });
});
