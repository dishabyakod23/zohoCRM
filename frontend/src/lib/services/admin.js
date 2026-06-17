import api from '../api.js';

export async function listAdminUsers() {
  const res = await api.get('/admin/users');
  return res.data.data || [];
}

export async function getAdminUser(id) {
  const res = await api.get(`/admin/users/${id}`);
  return res.data.data;
}

export async function createAdminUser(payload) {
  const res = await api.post('/admin/users', payload);
  return res.data.data;
}

export async function updateAdminUser(id, payload) {
  const res = await api.patch(`/admin/users/${id}`, payload);
  return res.data.data;
}

export async function getAdminSettings() {
  const res = await api.get('/admin/settings');
  return res.data.data;
}

export async function updateAppSettings(payload) {
  const res = await api.patch('/admin/settings/app', payload);
  return res.data.data;
}

export async function updateWeeklyReportSettings(payload) {
  const res = await api.patch('/admin/settings/weekly-report', payload);
  return res.data.data;
}

export async function listAdminLeadStatuses() {
  const res = await api.get('/admin/lead-statuses');
  return res.data.data || [];
}

export async function createAdminLeadStatus({ label, value }) {
  const res = await api.post('/admin/lead-statuses', { label, value });
  return res.data.data;
}

export async function deleteAdminLeadStatus(value) {
  await api.delete(`/admin/lead-statuses/${encodeURIComponent(value)}`);
}
