import { toDateKey, formatTime } from './calendarHelpers.js';

/** Extract HH:MM from an ISO / datetime-local string. */
export function timeFromDatetime(value) {
  if (!value) return '';
  const str = String(value);
  const match = str.match(/T(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Map a CRM meeting (Outlook-synced or local) onto the calendar grid shape.
 * Click handlers should treat `source === 'crm_meeting'` as open meeting detail.
 */
export function meetingToCalendarItem(meeting) {
  const from = meeting.from_datetime || meeting.start_at;
  const to = meeting.to_datetime || meeting.end_at;
  const meetingId = meeting.id;
  return {
    id: `meeting:${meetingId}`,
    meeting_id: meetingId,
    title: meeting.title || 'Meeting',
    event_type: 'meeting',
    event_date: toDateKey(from),
    start_time: timeFromDatetime(from),
    end_time: timeFromDatetime(to),
    all_day: false,
    completed: false,
    source: 'crm_meeting',
    location: meeting.location || '',
    host_name: meeting.host_name || '',
    host_id: meeting.host_id || meeting.host?.id || '',
    microsoft_sync_status: meeting.microsoft_sync_status || null,
    microsoft_imported: !!meeting.microsoft_imported,
  };
}

/** Keep meetings whose start date falls inside [fromKey, toKey] (inclusive). */
export function filterMeetingsInRange(meetings = [], fromKey, toKey) {
  return (meetings || []).filter((m) => {
    const key = toDateKey(m.from_datetime || m.start_at);
    if (!key) return false;
    if (fromKey && key < fromKey) return false;
    if (toKey && key > toKey) return false;
    return true;
  });
}

/** Optional host filter for calendar owner dropdown. */
export function filterMeetingsByHost(meetings = [], hostId) {
  if (!hostId) return meetings;
  return meetings.filter((m) => String(m.host_id || m.host?.id || '') === String(hostId));
}

/** Default datetime-local values for creating a meeting on a calendar day. */
export function defaultMeetingDatetimesForDate(dateKey, hour = 10) {
  if (!dateKey) return {};
  const startH = String(hour).padStart(2, '0');
  const endH = String(hour + 1).padStart(2, '0');
  return {
    from_datetime: `${dateKey}T${startH}:00`,
    to_datetime: `${dateKey}T${endH}:00`,
  };
}

export function calendarItemLabel(item) {
  if (!item) return '';
  const time = !item.all_day && item.start_time ? `${formatTime(item.start_time)} ` : '';
  return `${time}${item.title || ''}`;
}
