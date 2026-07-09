import api from '../api.js';
import { listResult, toIsoDatetime } from '../activityHelpers.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';

export function normalizeAnnouncement(item) {
  if (!item) return item;
  return {
    ...item,
    audience_roles: item.audience_roles || [],
  };
}

export function formatAnnouncementDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday - startOfDate) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function toAnnouncementPayload(form) {
  const audience = Array.isArray(form.audience_roles) ? form.audience_roles.filter(Boolean) : [];
  return {
    title: form.title?.trim(),
    body: form.body?.trim(),
    is_active: form.is_active !== false,
    priority: Number(form.priority) || 0,
    audience_roles: audience.length ? audience : undefined,
    starts_at: form.starts_at ? toIsoDatetime(form.starts_at) : null,
    ends_at: form.ends_at ? toIsoDatetime(form.ends_at) : null,
  };
}

/** Active announcements for the logged-in user (bottom utility bar) */
export async function listAnnouncements({ limit = DEFAULT_PAGE_SIZE } = {}) {
  const res = await api.get('/announcements', { params: { limit } });
  return (res.data.data || []).map(normalizeAnnouncement);
}

/** Admin — paginated list */
export async function listAdminAnnouncements({ page = 1, page_size = DEFAULT_PAGE_SIZE, include_inactive = true } = {}) {
  const res = await api.get('/admin/announcements', {
    params: { page, page_size, include_inactive },
  });
  const result = listResult(res);
  return { ...result, data: result.data.map(normalizeAnnouncement) };
}

export async function getAdminAnnouncement(id) {
  const res = await api.get(`/admin/announcements/${id}`);
  return normalizeAnnouncement(res.data.data);
}

export async function createAnnouncement(form) {
  const res = await api.post('/admin/announcements', toAnnouncementPayload(form));
  return normalizeAnnouncement(res.data.data);
}

export async function updateAnnouncement(id, form) {
  const payload = toAnnouncementPayload(form);
  const res = await api.patch(`/admin/announcements/${id}`, payload);
  return normalizeAnnouncement(res.data.data);
}

export async function deleteAnnouncement(id) {
  await api.delete(`/admin/announcements/${id}`);
}
