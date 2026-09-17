import {
  meetingToCalendarItem,
  filterMeetingsInRange,
  filterMeetingsByHost,
  timeFromDatetime,
  defaultMeetingDatetimesForDate,
} from '../calendarMeetingHelpers.js';

describe('calendarMeetingHelpers', () => {
  it('maps CRM meetings onto calendar items with crm_meeting source', () => {
    const item = meetingToCalendarItem({
      id: 'm1',
      title: 'Demo',
      from_datetime: '2026-09-18T10:00:00',
      to_datetime: '2026-09-18T11:00:00',
      host_name: 'Alex',
      location: 'Bangalore',
    });
    expect(item).toMatchObject({
      id: 'meeting:m1',
      meeting_id: 'm1',
      event_type: 'meeting',
      event_date: '2026-09-18',
      start_time: '10:00',
      end_time: '11:00',
      source: 'crm_meeting',
    });
  });

  it('filters meetings by visible calendar range and host', () => {
    const meetings = [
      { id: '1', from_datetime: '2026-09-01T09:00:00', host_id: 'u1' },
      { id: '2', from_datetime: '2026-09-15T09:00:00', host_id: 'u2' },
      { id: '3', from_datetime: '2026-10-01T09:00:00', host_id: 'u1' },
    ];
    expect(filterMeetingsInRange(meetings, '2026-09-01', '2026-09-30').map((m) => m.id)).toEqual(['1', '2']);
    expect(filterMeetingsByHost(meetings, 'u1').map((m) => m.id)).toEqual(['1', '3']);
  });

  it('builds default meeting datetimes for a calendar day', () => {
    expect(defaultMeetingDatetimesForDate('2026-09-18')).toEqual({
      from_datetime: '2026-09-18T10:00',
      to_datetime: '2026-09-18T11:00',
    });
    expect(timeFromDatetime('2026-09-18T14:30:00Z')).toMatch(/^\d{2}:\d{2}$/);
  });
});
