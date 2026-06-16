import api from '../api.js';

function dateParams({ date_from, date_to } = {}) {
  const params = {};
  if (date_from) params.date_from = date_from;
  if (date_to) params.date_to = date_to;
  return params;
}

export async function getLeadReport({ group_by = 'status', date_from, date_to } = {}) {
  const res = await api.get('/reports/leads', { params: { group_by, ...dateParams({ date_from, date_to }) } });
  return res.data.data;
}

export async function getLeadConversionReport({ date_from, date_to } = {}) {
  const res = await api.get('/reports/leads/conversion', { params: dateParams({ date_from, date_to }) });
  return res.data.data;
}

export async function getDealReport({ group_by = 'stage', date_from, date_to } = {}) {
  const res = await api.get('/reports/deals', { params: { group_by, ...dateParams({ date_from, date_to }) } });
  return res.data.data;
}

export async function getWonLostReport({ date_from, date_to } = {}) {
  const res = await api.get('/reports/deals/won-lost', { params: dateParams({ date_from, date_to }) });
  return res.data.data;
}

export async function getAccountReport({ group_by = 'industry', date_from, date_to } = {}) {
  const res = await api.get('/reports/accounts', { params: { group_by, ...dateParams({ date_from, date_to }) } });
  return res.data.data;
}

export async function getActivityReport({ date_from, date_to } = {}) {
  const res = await api.get('/reports/activities', { params: dateParams({ date_from, date_to }) });
  return res.data.data;
}

export async function getCampaignReport({ date_from, date_to } = {}) {
  const res = await api.get('/reports/campaigns', { params: dateParams({ date_from, date_to }) });
  return res.data.data;
}

export async function exportReportCsv(path, { group_by, date_from, date_to } = {}) {
  const params = { ...dateParams({ date_from, date_to }) };
  if (group_by) params.group_by = group_by;
  const res = await api.get(path, { params, responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${path.split('/').pop()}-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function getAdminSettings() {
  const res = await api.get('/admin/settings');
  return res.data.data;
}

export async function updateWeeklyReportSettings(payload) {
  const res = await api.patch('/admin/settings/weekly-report', payload);
  return res.data.data;
}

export async function previewWeeklyReport() {
  const res = await api.get('/admin/reports/weekly/preview');
  return res.data.data;
}

export async function triggerWeeklyReport() {
  const res = await api.post('/admin/reports/weekly/trigger');
  return res.data.data;
}

export async function listWeeklyReportLogs({ page = 1, page_size = 20 } = {}) {
  const res = await api.get('/admin/reports/weekly/logs', { params: { page, page_size } });
  return {
    data: res.data.data || [],
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

export const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
