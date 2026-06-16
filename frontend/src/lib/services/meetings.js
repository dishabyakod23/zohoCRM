import api from '../api.js';
import { userBriefName, listResult, omitEmpty, toIsoDatetime } from '../activityHelpers.js';

export function normalizeMeeting(meeting) {
  return {
    ...meeting,
    from_datetime: meeting.start_at,
    to_datetime: meeting.end_at,
    host_name: userBriefName(meeting.host),
  };
}

function toMeetingPayload(form, { partial = false } = {}) {
  return omitEmpty({
    title: form.title,
    host_id: form.host_id || null,
    start_at: form.from_datetime || form.start_at ? toIsoDatetime(form.from_datetime || form.start_at) : undefined,
    end_at: form.to_datetime || form.end_at ? toIsoDatetime(form.to_datetime || form.end_at) : undefined,
    location: form.location,
    description: form.description,
    contact_id: form.contact_id || null,
    participant_ids: form.participant_ids,
  });
}

export async function listMeetings(params = {}) {
  const res = await api.get('/meetings', { params });
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
