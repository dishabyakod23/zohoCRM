import api from '../api.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import { normalizeRole } from '../roles.js';

function dateParams({ date_from, date_to } = {}) {
  const params = {};
  if (date_from) params.date_from = date_from;
  if (date_to) params.date_to = date_to;
  return params;
}

function asRows(data) {
  return Array.isArray(data) ? data : (data?.rows || []);
}

export async function getLeadReport({ group_by = 'status', date_from, date_to } = {}) {
  const res = await api.get('/reports/leads', { params: { group_by, ...dateParams({ date_from, date_to }) } });
  return { rows: asRows(res.data.data) };
}

export async function getLeadConversionReport({ date_from, date_to } = {}) {
  const res = await api.get('/reports/leads/conversion', { params: dateParams({ date_from, date_to }) });
  const data = res.data.data || {};
  const total = Number(data.total ?? data.total_leads ?? 0);
  const converted = Number(data.converted ?? data.converted_leads ?? 0);
  const rate = Number(data.rate ?? data.conversion_rate ?? (total > 0 ? (converted / total) * 100 : 0));
  return {
    total_leads: total,
    converted_leads: converted,
    conversion_rate: rate,
    not_converted: Number(data.not_converted ?? total - converted),
  };
}

export async function getDealReport({ group_by = 'stage', date_from, date_to } = {}) {
  const res = await api.get('/reports/deals', { params: { group_by, ...dateParams({ date_from, date_to }) } });
  return { rows: asRows(res.data.data) };
}

export async function getWonLostReport({ date_from, date_to } = {}) {
  const res = await api.get('/reports/deals/won-lost', { params: dateParams({ date_from, date_to }) });
  const rows = asRows(res.data.data);
  let won_count = 0;
  let won_amount = 0;
  let lost_count = 0;
  let lost_amount = 0;
  for (const row of rows) {
    const label = String(row.label || '').toLowerCase();
    const count = Number(row.count) || 0;
    const amount = Number(row.total ?? row.amount) || 0;
    if (label.includes('won')) {
      won_count += count;
      won_amount += amount;
    } else if (label.includes('lost')) {
      lost_count += count;
      lost_amount += amount;
    }
  }
  return { won_count, won_amount, lost_count, lost_amount, rows };
}

export async function getAccountReport({ group_by = 'industry', date_from, date_to } = {}) {
  const res = await api.get('/reports/accounts', { params: { group_by, ...dateParams({ date_from, date_to }) } });
  return { rows: asRows(res.data.data) };
}

export async function getActivityReport({ date_from, date_to, owner_id } = {}) {
  const params = dateParams({ date_from, date_to });
  if (owner_id) params.owner_id = owner_id;
  const res = await api.get('/reports/activity-summary', { params });
  return res.data.data || {};
}

export async function getCampaignReport({ date_from, date_to } = {}) {
  const res = await api.get('/reports/campaigns', { params: dateParams({ date_from, date_to }) });
  const rows = asRows(res.data.data);
  return {
    rows: rows.map((row) => ({
      ...row,
      campaign_id: row.campaign_id || row.id,
      campaign_name: row.campaign_name || row.label || row.name,
      members_added: row.members_added ?? row.members ?? 0,
      responded_count: row.responded_count ?? 0,
      response_rate: row.response_rate ?? 0,
    })),
  };
}

export async function getAccountRevenueReport({ date_from, date_to } = {}) {
  const res = await api.get('/reports/account-revenue', { params: dateParams({ date_from, date_to }) });
  return res.data.data;
}

export async function getDealsClosingThisMonth() {
  const res = await api.get('/reports/deals-closing-month');
  return res.data.data;
}

export async function exportReportCsv(exportType, { group_by, date_from, date_to } = {}) {
  const params = { ...dateParams({ date_from, date_to }) };
  if (group_by) params.group_by = group_by;
  const res = await api.get(`/reports/export/${exportType}`, { params, responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${exportType}-report-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export { listAdminUsers, getAdminSettings, updateWeeklyReportSettings } from './admin.js';

export function isWeeklyRecipientEligible(user, settings) {
  if (!user?.is_active || !settings) return false;
  const role = normalizeRole(user.role);
  if (role === 'super_admin' && settings.super_admin_enabled) return true;
  if (role === 'sales_manager' && settings.sales_manager_enabled) return true;
  return false;
}

/** Prefer explicit recipient_user_ids; fall back to legacy role toggles + excluded_user_ids. */
export function getWeeklyReportRecipients(users, settings) {
  if (Array.isArray(settings?.recipient_user_ids)) {
    const allowed = new Set((settings.recipient_user_ids || []).map(String));
    return (users || []).filter((u) => u?.is_active && u.email && allowed.has(String(u.id)));
  }
  const excluded = new Set(settings?.excluded_user_ids || []);
  return (users || []).filter((u) => isWeeklyRecipientEligible(u, settings) && !excluded.has(u.id));
}

export function isUserIncludedInReports(user, settings) {
  if (Array.isArray(settings?.recipient_user_ids)) {
    return (settings.recipient_user_ids || []).map(String).includes(String(user.id));
  }
  if (!isWeeklyRecipientEligible(user, settings)) return false;
  return !(settings?.excluded_user_ids || []).includes(user.id);
}

export function isWeeklySubjectSelected(user, settings) {
  if (!user?.is_active) return false;
  const ids = settings?.subject_user_ids;
  // Empty subject_user_ids falls back to all active BDE/BDM (minus exclusions on the server).
  if (Array.isArray(ids) && ids.length > 0) {
    return ids.map(String).includes(String(user.id));
  }
  const role = normalizeRole(user.role);
  return role === 'sales_rep' || role === 'sales_manager';
}

export function setUserInIdList(ids, userId, included) {
  const next = new Set((ids || []).map(String));
  if (included) next.add(String(userId));
  else next.delete(String(userId));
  return [...next];
}

export function setUserReportIncluded(settings, userId, included) {
  if (Array.isArray(settings?.recipient_user_ids)) {
    return {
      ...settings,
      recipient_user_ids: setUserInIdList(settings.recipient_user_ids, userId, included),
    };
  }
  const excluded = new Set(settings?.excluded_user_ids || []);
  if (included) excluded.delete(userId);
  else excluded.add(userId);
  return { ...settings, excluded_user_ids: [...excluded] };
}

export function setWeeklySubjectIncluded(settings, userId, included) {
  const current = Array.isArray(settings?.subject_user_ids)
    ? settings.subject_user_ids
    : [];
  return {
    ...settings,
    subject_user_ids: setUserInIdList(current, userId, included),
  };
}

/** Prefer member_rows from weekly preview; empty means fall back to html_body iframe. */
export function extractWeeklyMemberRows(preview) {
  if (!preview) return [];
  if (Array.isArray(preview.member_rows) && preview.member_rows.length) return preview.member_rows;
  if (Array.isArray(preview.summary?.member_rows) && preview.summary.member_rows.length) {
    return preview.summary.member_rows;
  }
  return [];
}

export async function previewWeeklyReport() {
  const res = await api.get('/admin/reports/weekly/preview');
  return res.data.data;
}

export async function triggerWeeklyReport() {
  const res = await api.post('/admin/reports/weekly/trigger');
  return res.data.data;
}

export async function listWeeklyReportLogs({ page = 1, page_size = DEFAULT_PAGE_SIZE } = {}) {
  const res = await api.get('/admin/reports/weekly/logs', { params: { page, page_size } });
  return {
    data: res.data.data || [],
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

export const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
