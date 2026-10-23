import { formatTime } from './calendarHelpers.js';

/** Parse API ISO / datetime-local into a Date in the viewer's local timezone. */
export function parseMeetingDatetime(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local calendar day (YYYY-MM-DD) for a meeting datetime. */
export function toLocalDateKey(value) {
  const d = parseMeetingDatetime(value);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local HH:MM for a meeting datetime (not the UTC clock on the ISO string). */
export function timeFromDatetime(value) {
  const d = parseMeetingDatetime(value);
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Value for `<input type="datetime-local">` in the viewer's timezone. */
export function toDatetimeLocalValue(value) {
  if (!value) return '';
  const d = parseMeetingDatetime(value);
  if (!d) return '';
  return `${toLocalDateKey(d)}T${timeFromDatetime(d)}`;
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
    event_date: toLocalDateKey(from),
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
    const key = toLocalDateKey(m.from_datetime || m.start_at);
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
