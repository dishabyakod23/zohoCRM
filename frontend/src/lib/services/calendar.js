import api from '../api.js';
import { normalizeEvent, toDateKey, todayKey } from '../calendarHelpers.js';

const STORAGE_PREFIX = 'crm_calendar_events';

function storageKey(userId) {
  return `${STORAGE_PREFIX}_${userId || 'guest'}`;
}

function readLocal(userId) {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
  } catch {
    return [];
  }
}

function writeLocal(userId, events) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(userId), JSON.stringify(events));
}

function localId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function filterLocal(events, { from, to, ownerId, userId, isAdmin }) {
  return events.filter((e) => {
    const date = toDateKey(e.event_date);
    if (from && date < from) return false;
    if (to && date > to) return false;
    if (!isAdmin && String(e.owner_id) !== String(userId)) return false;
    if (isAdmin && ownerId && String(e.owner_id) !== String(ownerId)) return false;
    return true;
  });
}

function useLocalFallback(err) {
  const status = err?.response?.status;
  return status === 404 || status === 501 || status === 405;
}

export async function listEvents({ from, to, owner_id, userId, isAdmin } = {}) {
  try {
    const params = { from, to };
    if (owner_id) params.owner_id = owner_id;
    const res = await api.get('/calendar/events', { params });
    return (res.data.data || []).map(normalizeEvent);
  } catch (err) {
    if (!useLocalFallback(err)) throw err;
    return filterLocal(readLocal(userId), { from, to, ownerId: owner_id, userId, isAdmin }).map(normalizeEvent);
  }
}

export async function getLoginReminders({ userId, isAdmin } = {}) {
  try {
    const res = await api.get('/calendar/reminders');
    return (res.data.data || []).map(normalizeEvent);
  } catch (err) {
    if (!useLocalFallback(err)) throw err;
    const today = todayKey();
    return filterLocal(readLocal(userId), { from: '1970-01-01', to: today, userId, isAdmin })
      .filter((e) => !e.completed && e.remind_on_login !== false)
      .map(normalizeEvent);
  }
}

export async function createEvent(form, { userId, isAdmin } = {}) {
  try {
    const res = await api.post('/calendar/events', form);
    return normalizeEvent(res.data.data);
  } catch (err) {
    if (!useLocalFallback(err)) throw err;
    const events = readLocal(userId);
    const created = normalizeEvent({
      ...form,
      id: localId(),
      owner_id: isAdmin && form.owner_id ? form.owner_id : userId,
      created_by: userId,
      owner_name: null,
    });
    events.push(created);
    writeLocal(userId, events);
    return created;
  }
}

export async function updateEvent(id, form, { userId, isAdmin } = {}) {
  try {
    const res = await api.patch(`/calendar/events/${id}`, form);
    return normalizeEvent(res.data.data);
  } catch (err) {
    if (!useLocalFallback(err)) throw err;
    const events = readLocal(userId);
    const idx = events.findIndex((e) => String(e.id) === String(id));
    if (idx < 0) throw new Error('Event not found');
    if (!isAdmin && String(events[idx].owner_id) !== String(userId)) throw new Error('Not allowed');
    events[idx] = normalizeEvent({ ...events[idx], ...form });
    writeLocal(userId, events);
    return events[idx];
  }
}

export async function deleteEvent(id, { userId, isAdmin } = {}) {
  try {
    await api.delete(`/calendar/events/${id}`);
  } catch (err) {
    if (!useLocalFallback(err)) throw err;
    const events = readLocal(userId);
    const target = events.find((e) => String(e.id) === String(id));
    if (!target) return;
    if (!isAdmin && String(target.owner_id) !== String(userId)) throw new Error('Not allowed');
    writeLocal(userId, events.filter((e) => String(e.id) !== String(id)));
  }
}
