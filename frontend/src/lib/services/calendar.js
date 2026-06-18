import api from '../api.js';
import { normalizeEvent, toDateKey } from '../calendarHelpers.js';

/**
 * Calendar API — https://api-salescrm.duckdns.org/docs#/Calendar
 * GET/POST   /calendar/events
 * GET        /calendar/reminders
 * GET/PATCH/DELETE /calendar/events/{event_id}
 */

function extractData(res) {
  return res?.data?.data;
}

function extractList(res) {
  const data = extractData(res);
  return Array.isArray(data) ? data : [];
}

/** API expects HH:MM:SS or null */
export function formatTimeForApi(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  return raw;
}

/** Map form → CalendarEventCreate / CalendarEventUpdate */
export function buildCalendarEventBody(form, { forUpdate = false } = {}) {
  const allDay = form.all_day !== false;
  const body = {
    title: form.title != null ? String(form.title).trim() : undefined,
    description: form.description != null ? (form.description || null) : undefined,
    event_type: form.event_type || undefined,
    event_date: form.event_date ? toDateKey(form.event_date) : undefined,
    start_time: allDay ? null : formatTimeForApi(form.start_time),
    end_time: allDay ? null : formatTimeForApi(form.end_time),
    all_day: allDay,
    completed: form.completed != null ? !!form.completed : undefined,
    remind_on_login: form.remind_on_login != null ? form.remind_on_login !== false : undefined,
    owner_id: form.owner_id || undefined,
  };

  if (forUpdate) {
    Object.keys(body).forEach((key) => {
      if (body[key] === undefined) delete body[key];
    });
  }

  return body;
}

/** GET /calendar/events — list events (optional from, to, owner_id) */
export async function listEvents({ from, to, owner_id } = {}) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  if (owner_id) params.owner_id = owner_id;

  const res = await api.get('/calendar/events', { params });
  return extractList(res).map(normalizeEvent);
}

/** GET /calendar/events/{event_id} */
export async function getEvent(eventId) {
  const res = await api.get(`/calendar/events/${eventId}`);
  const data = extractData(res);
  if (!data) throw new Error('Event not found');
  return normalizeEvent(data);
}

/** GET /calendar/reminders — login reminder events */
export async function getLoginReminders() {
  const res = await api.get('/calendar/reminders');
  return extractList(res).map(normalizeEvent);
}

/** POST /calendar/events */
export async function createEvent(form) {
  const res = await api.post('/calendar/events', buildCalendarEventBody(form));
  const data = extractData(res);
  if (!data) throw new Error('Failed to create event');
  return normalizeEvent(data);
}

/** Create one event per assignee (POST /calendar/events with owner_id) */
export async function createEventsForAssignees(form, assigneeIds = []) {
  const ids = [...new Set(assigneeIds.filter(Boolean))];
  const created = [];
  for (const owner_id of ids) {
    created.push(await createEvent({ ...form, owner_id }));
  }
  return created;
}

/** PATCH /calendar/events/{event_id} */
export async function updateEvent(id, form) {
  const res = await api.patch(`/calendar/events/${id}`, buildCalendarEventBody(form, { forUpdate: true }));
  const data = extractData(res);
  if (!data) throw new Error('Failed to update event');
  return normalizeEvent(data);
}

/** DELETE /calendar/events/{event_id} */
export async function deleteEvent(id) {
  await api.delete(`/calendar/events/${id}`);
}
