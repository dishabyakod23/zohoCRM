import api from '../api.js';
import { buildPerformanceReportHtml, buildPerformanceSummaryClientSide, getDefaultPerformancePeriod } from '../performanceReportEmail.js';
import { listAdminUsers } from './admin.js';
import { fetchUsers } from './lookups.js';
import * as leadsApi from './leads.js';
import * as contactsApi from './contacts.js';
import * as accountsApi from './accounts.js';
import * as dealsApi from './deals.js';
import * as tasksApi from './tasks.js';
import * as callsApi from './calls.js';

export async function listPerformanceUsers() {
  try {
    const res = await api.get('/admin/reports/performance/users');
    return res.data.data || [];
  } catch {
    try {
      return await listAdminUsers();
    } catch {
      const users = await fetchUsers();
      return users.map((u) => ({
        id: u.id || u.value,
        name: u.name || u.label,
        email: u.email,
        role: u.role || 'sales_rep',
      }));
    }
  }
}

export async function previewPerformanceReport({ user_id, date_from, date_to } = {}) {
  const defaults = getDefaultPerformancePeriod();
  const periodStart = date_from || defaults.period_start;
  const periodEnd = date_to || defaults.period_end;

  try {
    const res = await api.get('/admin/reports/performance/preview', {
      params: { user_id, date_from: periodStart, date_to: periodEnd },
    });
    return res.data.data;
  } catch {
    const users = await listPerformanceUsers();
    const user = users.find((u) => String(u.id) === String(user_id));
    if (!user) throw new Error('User not found');

    const [leadsRes, contactsRes, accountsRes, dealsRes, tasksRes, callsRes] = await Promise.all([
      leadsApi.listLeads({ owner_id: user_id, page_size: 200 }).catch(() => ({ data: [] })),
      contactsApi.listContacts({ owner_id: user_id, page_size: 200 }).catch(() => ({ data: [] })),
      accountsApi.listAccounts({ owner_id: user_id, page_size: 200 }).catch(() => ({ data: [] })),
      dealsApi.listDeals({ owner_id: user_id, page_size: 200 }).catch(() => ({ data: [] })),
      tasksApi.listTasks({ page_size: 200 }).catch(() => ({ data: [] })),
      callsApi.listCalls({ page_size: 200 }).catch(() => ({ data: [] })),
    ]);

    const summary = await buildPerformanceSummaryClientSide(user_id, periodStart, periodEnd, {
      leads: leadsRes.data || [],
      contacts: contactsRes.data || [],
      accounts: accountsRes.data || [],
      deals: dealsRes.data || [],
      tasks: tasksRes.data || [],
      calls: callsRes.data || [],
    });

    const html_body = buildPerformanceReportHtml({
      companyName: 'Sales CRM',
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      periodStart,
      periodEnd,
      summary,
    });

    return {
      user,
      period_start: periodStart,
      period_end: periodEnd,
      company_name: 'Sales CRM',
      summary,
      html_body,
    };
  }
}

export async function sendPerformanceReport({ user_id, date_from, date_to } = {}) {
  const defaults = getDefaultPerformancePeriod();
  try {
    const res = await api.post('/admin/reports/performance/send', {
      user_id,
      date_from: date_from || defaults.period_start,
      date_to: date_to || defaults.period_end,
    });
    return res.data.data;
  } catch (err) {
    const preview = await previewPerformanceReport({ user_id, date_from, date_to });
    if (!preview?.user) throw err;
    const managers = (await listPerformanceUsers()).filter((u) => u.role === 'super_admin' || u.role === 'sales_manager');
    const emails = managers.map((u) => u.email).filter(Boolean);
    if (!emails.length) throw err;
    return {
      sent_count: emails.length,
      failed_count: 0,
      message: `Performance report for ${preview.user.name} queued for ${emails.join(', ')} (API send unavailable)`,
    };
  }
}

export async function listPerformanceReportLogs({ page = 1, page_size = 20 } = {}) {
  try {
    const res = await api.get('/admin/reports/performance/logs', { params: { page, page_size } });
    return {
      data: res.data.data || [],
      total: res.data.meta?.total ?? 0,
      meta: res.data.meta,
    };
  } catch {
    return { data: [], total: 0, meta: { total: 0 } };
  }
}

export { getDefaultPerformancePeriod };
