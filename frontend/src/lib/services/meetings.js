import api from '../api.js';
import { userBriefName, listResult, omitEmpty, toIsoDatetime } from '../activityHelpers.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';

export function normalizeMeeting(meeting) {
  const from = meeting.from_datetime ?? meeting.start_at;
  const to = meeting.to_datetime ?? meeting.end_at;
  return {
    ...meeting,
    from_datetime: from,
    to_datetime: to,
    start_at: from,
    end_at: to,
    host_name: userBriefName(meeting.host) || meeting.host_name,
    participant_ids: meeting.participants || meeting.participant_ids || [],
  };
}

function toMeetingPayload(form, { partial = false } = {}) {
  return omitEmpty({
    title: form.title,
    host_id: form.host_id || null,
    from_datetime: form.from_datetime || form.start_at ? toIsoDatetime(form.from_datetime || form.start_at) : undefined,
    to_datetime: form.to_datetime || form.end_at ? toIsoDatetime(form.to_datetime || form.end_at) : undefined,
    location: form.location,
    description: form.description,
    participants: form.participants || form.participant_ids,
    related_type: form.related_type || (form.contact_id ? 'contact' : undefined),
    related_id: form.related_id || form.contact_id || null,
    reminder: form.reminder,
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
  const res = await api.patch(`/meetings/${id}`, toMeetingPayload(form, { partial: true }));
  return normalizeMeeting(res.data.data);
}

export async function deleteMeeting(id) {
  await api.delete(`/meetings/${id}`);
}
