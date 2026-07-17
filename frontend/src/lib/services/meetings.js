import api from '../api.js';
import { userBriefName, listResult, omitEmpty, toIsoDatetime } from '../activityHelpers.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';

export function normalizeMeeting(meeting) {
  const from = meeting.start_at ?? meeting.from_datetime;
  const to = meeting.end_at ?? meeting.to_datetime;
  const participants = meeting.participants || [];
  const participantIds = meeting.participant_ids
    || participants.map((p) => p?.id).filter(Boolean)
    || [];
  return {
    ...meeting,
    from_datetime: from,
    to_datetime: to,
    start_at: from,
    end_at: to,
    host_name: userBriefName(meeting.host) || meeting.host_name,
    participants,
    participant_ids: participantIds,
  };
}

export function normalizeMeetingReminder(item) {
  const start = item.start_at ?? item.from_datetime;
  const end = item.end_at ?? item.to_datetime;
  return {
    ...item,
    id: item.id,
    title: item.title || 'Meeting',
    host_id: item.host_id,
    host_name: userBriefName(item.host) || item.host_name || '—',
    start_at: start,
    end_at: end,
    from_datetime: start,
    to_datetime: end,
    location: item.location || null,
    description: item.description || null,
    role: item.role || 'participant',
    message: item.message || `You were added to "${item.title || 'a meeting'}"`,
  };
}

function toMeetingPayload(form) {
  const start = form.start_at || form.from_datetime;
  const end = form.end_at || form.to_datetime;
  const participantIds = form.participant_ids || form.participants;
  return omitEmpty({
    title: form.title,
    host_id: form.host_id || null,
    start_at: start ? toIsoDatetime(start) : undefined,
    end_at: end ? toIsoDatetime(end) : undefined,
    location: form.location,
    description: form.description,
    participant_ids: Array.isArray(participantIds) ? participantIds.filter(Boolean) : undefined,
    related_entity_type: form.related_entity_type || form.related_type || undefined,
    related_entity_id: form.related_entity_id || form.related_id || null,
    contact_id: form.contact_id || null,
  });
}

export async function listMeetings(params = {}) {
  const { page_size, limit, ...rest } = params;
  const res = await api.get('/meetings', { params: { ...rest, limit: limit ?? page_size ?? DEFAULT_PAGE_SIZE } });
  const result = listResult(res);
  return { ...result, data: result.data.map(normalizeMeeting) };
}

export async function getMeeting(id) {
  const res = await api.get(`/meetings/${id}`);
  return normalizeMeeting(res.data.data);
}

export async function createMeeting(form) {
  const res = await api.post('/meetings', toMeetingPayload(form));
  return normalizeMeeting(res.data.data);
}

export async function updateMeeting(id, form) {
  const res = await api.patch(`/meetings/${id}`, toMeetingPayload(form));
  return normalizeMeeting(res.data.data);
}

export async function deleteMeeting(id) {
  await api.delete(`/meetings/${id}`);
}

/** GET /meetings/reminders — undismissed meeting invites for the current user */
export async function listMeetingReminders() {
  const res = await api.get('/meetings/reminders');
  const data = res.data?.data;
  return (Array.isArray(data) ? data : []).map(normalizeMeetingReminder);
}

/** POST /meetings/reminders/{meeting_id}/ack — dismiss invite for current user */
export async function acknowledgeMeetingReminder(meetingId) {
  const res = await api.post(`/meetings/reminders/${meetingId}/ack`);
  return res.data;
}
