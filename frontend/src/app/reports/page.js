'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import { useToast } from '../../components/ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { getApiError } from '../../lib/api.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { userDisplayName } from '../../lib/userHelpers.js';
import * as reportsApi from '../../lib/services/reports.js';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#378ADD', '#639922', '#EF9F27', '#D85A30', '#1D9E75', '#E24B4A', '#7F77DD', '#888'];

const EXPORT_PATHS = {
  leads: { path: '/reports/leads/export', group_by: 'source' },
  accounts: { path: '/reports/accounts/export', group_by: 'industry' },
  campaigns: { path: '/reports/campaigns/export' },
};

export default function ReportsPage() {
  const { showToast } = useToast();
  const { user, canDownload, canManageWeeklyReports, canAccessReports } = usePermissions();
  const admin = canManageWeeklyReports;
  const [tab, setTab] = useState('leads');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [weeklySettings, setWeeklySettings] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [weeklyPreview, setWeeklyPreview] = useState(null);
  const [weeklyLogs, setWeeklyLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [savingSettings, setSavingSettings] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const dateParams = {
    date_from: dateRange.start || undefined,
    date_to: dateRange.end || undefined,
  };

  const loadReportData = useCallback(async () => {
    if (tab === 'weekly') return;
    setLoading(true);
    try {
      if (tab === 'leads') {
        const [source, status, conversion] = await Promise.all([
          reportsApi.getLeadReport({ ...dateParams, group_by: 'source' }),
          reportsApi.getLeadReport({ ...dateParams, group_by: 'status' }),
          reportsApi.getLeadConversionReport(dateParams),
        ]);
        setData({
          source: source.rows || [],
          status: status.rows || [],
          conversion: {
            rate: Math.round((conversion.conversion_rate || 0) * 100) / 100,
            converted: conversion.converted_leads,
            total: conversion.total_leads,
          },
        });
      } else if (tab === 'deals') {
        const [stages, wonLost] = await Promise.all([
          reportsApi.getDealReport({ ...dateParams, group_by: 'stage' }),
          reportsApi.getWonLostReport(dateParams),
        ]);
        setData({
          stages: stages.rows || [],
          wonLost: [
            { label: 'Won', count: wonLost.won_count, amount: wonLost.won_amount },
            { label: 'Lost', count: wonLost.lost_count, amount: wonLost.lost_amount },
          ],
        });
      } else if (tab === 'accounts') {
        const report = await reportsApi.getAccountReport({ ...dateParams, group_by: 'industry' });
        setData({ industry: report.rows || [] });
      } else if (tab === 'activity') {
        const report = await reportsApi.getActivityReport(dateParams);
        setData({ activity: report });
      } else if (tab === 'campaigns') {
        const report = await reportsApi.getCampaignReport(dateParams);
        setData({ campaigns: report.rows || [] });
      }
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [tab, dateRange.start, dateRange.end, showToast]);

  const loadWeeklyData = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    try {
      const [settings, preview, logs, users] = await Promise.all([
        reportsApi.getAdminSettings(),
        reportsApi.previewWeeklyReport(),
        reportsApi.listWeeklyReportLogs({ page: logsPage, page_size: 10 }),
        reportsApi.listAdminUsers(),
      ]);
      setWeeklySettings(settings.weekly_report);
      setAdminUsers(users);
      setWeeklyPreview(preview);
      setWeeklyLogs(logs.data);
      setLogsTotal(logs.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [admin, logsPage, showToast]);

  useEffect(() => {
    if (tab === 'weekly') loadWeeklyData();
    else loadReportData();
  }, [tab, loadReportData, loadWeeklyData]);

  const download = async () => {
    const cfg = EXPORT_PATHS[tab];
    if (!cfg) {
      showToast('Export is not available for this report type');
      return;
    }
    try {
      await reportsApi.exportReportCsv(cfg.path, { ...dateParams, group_by: cfg.group_by });
      showToast('Report downloaded', 'success');
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const saveWeeklySettings = async () => {
    if (!weeklySettings) return;
    setSavingSettings(true);
    try {
      const updated = await reportsApi.updateWeeklyReportSettings({
        enabled: weeklySettings.enabled,
        super_admin_enabled: weeklySettings.super_admin_enabled,
        sales_manager_enabled: weeklySettings.sales_manager_enabled,
        day_of_week: weeklySettings.day_of_week,
        hour: weeklySettings.hour,
        minute: weeklySettings.minute,
        timezone: weeklySettings.timezone,
        excluded_user_ids: weeklySettings.excluded_user_ids || [],
      });
      setWeeklySettings(updated.weekly_report);
      showToast('Weekly report settings saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTriggerWeekly = async () => {
    const recipients = reportsApi.getWeeklyReportRecipients(adminUsers, weeklySettings);
    if (!recipients.length) {
      showToast('No recipients selected. Enable a role and include at least one user with an email.');
      return;
    }
    setTriggering(true);
    try {
      const result = await reportsApi.triggerWeeklyReport();
      const emails = recipients.map(u => u.email).join(', ');
      showToast(result.message || `Sent ${result.sent_count} report(s) to ${emails}`, 'success');
      const logs = await reportsApi.listWeeklyReportLogs({ page: 1, page_size: 10 });
      setWeeklyLogs(logs.data);
      setLogsTotal(logs.total);
      setLogsPage(1);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setTriggering(false);
    }
  };

  const tabs = [
    { id: 'leads', label: 'Lead Reports' },
    { id: 'accounts', label: 'Account Reports' },
    { id: 'campaigns', label: 'Campaign Reports' },
    ...(admin ? [{ id: 'weekly', label: 'Weekly Reports' }] : []),
  ];

  const summary = weeklyPreview?.summary;
  const reportRecipients = useMemo(
    () => reportsApi.getWeeklyReportRecipients(adminUsers, weeklySettings),
    [adminUsers, weeklySettings],
  );

  const toggleRecipient = (userId, included) => {
    setWeeklySettings(s => reportsApi.setUserReportIncluded(s, userId, included));
  };

  if (!canAccessReports) {
    return (
      <CRMLayout>
        <div className="p-6">
          <h1 className="text-xl font-bold mb-2">Reports</h1>
          <p className="text-gray-500 text-sm">Your role does not have access to reports. Contact a super admin if you need access.</p>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Reports</h1>
          {tab !== 'weekly' && (
            <div className="flex gap-2 items-center">
              <input className="input w-36 text-xs" type="date" value={dateRange.start} onChange={e => setDateRange(d => ({ ...d, start: e.target.value }))} />
              <span className="text-gray-400">to</span>
              <input className="input w-36 text-xs" type="date" value={dateRange.end} onChange={e => setDateRange(d => ({ ...d, end: e.target.value }))} />
              {canDownload && EXPORT_PATHS[tab] && (
                <button onClick={download} className="btn-secondary text-xs">Download CSV</button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-1 mb-6 border-b border-gray-100 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? 'border-brand-500 text-brand-600 font-medium' : 'border-transparent text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading && tab !== 'weekly' && (
          <p className="text-sm text-gray-400 py-8 text-center">Loading report data...</p>
        )}

        {!loading && tab === 'leads' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5"><h3 className="font-semibold mb-4">Leads by Source</h3>
              <ResponsiveContainer width="100%" height={220}><BarChart data={data.source || []}><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill="#378ADD" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
            </div>
            <div className="card p-5"><h3 className="font-semibold mb-4">Leads by Status</h3>
              <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data.status || []} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label>{(data.status || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
            </div>
            <div className="card p-5 col-span-full"><h3 className="font-semibold mb-2">Lead Conversion Rate</h3>
              <p className="text-3xl font-bold text-brand-600">{data.conversion?.rate ?? 0}%</p>
              <p className="text-sm text-gray-500">{data.conversion?.converted ?? 0} of {data.conversion?.total ?? 0} leads converted</p>
            </div>
          </div>
        )}

        {!loading && tab === 'deals' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5"><h3 className="font-semibold mb-4">Pipeline by Stage</h3>
              <ResponsiveContainer width="100%" height={220}><BarChart data={data.stages || []}><XAxis dataKey="label" tick={{ fontSize: 9 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill="#639922" /></BarChart></ResponsiveContainer>
            </div>
            <div className="card p-5"><h3 className="font-semibold mb-4">Won vs Lost</h3>
              <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data.wonLost || []} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label>{(data.wonLost || []).map((_, i) => <Cell key={i} fill={COLORS[i + 2]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
            </div>
          </div>
        )}

        {!loading && tab === 'accounts' && (
          <div className="card p-5"><h3 className="font-semibold mb-4">Accounts by Industry</h3>
            <ResponsiveContainer width="100%" height={280}><BarChart data={data.industry || []} layout="vertical"><XAxis type="number" /><YAxis dataKey="label" type="category" width={100} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="#EF9F27" /></BarChart></ResponsiveContainer>
          </div>
        )}

        {!loading && tab === 'activity' && data.activity && (
          <div className="grid grid-cols-3 gap-4">
            {[['Tasks Completed', data.activity.tasks_completed], ['Calls Logged', data.activity.calls_logged], ['Meetings Held', data.activity.meetings_held]].map(([l, v]) => (
              <div key={l} className="card p-5 text-center"><p className="text-xs text-gray-500">{l}</p><p className="text-3xl font-bold mt-2">{v ?? 0}</p></div>
            ))}
          </div>
        )}

        {!loading && tab === 'campaigns' && (
          <div className="card overflow-x-auto">
            <table className="w-full"><thead className="bg-gray-50"><tr>
              <th className="table-th">Campaign</th><th className="table-th">Members</th><th className="table-th">Responded</th>
              <th className="table-th">Response Rate</th><th className="table-th">Expected Revenue</th><th className="table-th">Actual Cost</th>
            </tr></thead>
              <tbody className="divide-y">{(data.campaigns || []).length === 0 ? (
                <tr><td colSpan={6} className="table-td text-center py-8 text-gray-400">No campaign data for this period</td></tr>
              ) : (data.campaigns || []).map(c => (
                <tr key={c.campaign_id}><td className="table-td">{c.campaign_name}</td><td className="table-td">{c.members_added}</td>
                  <td className="table-td">{c.responded_count}</td><td className="table-td">{c.response_rate}%</td>
                  <td className="table-td">₹{Number(c.expected_revenue || 0).toLocaleString()}</td><td className="table-td">₹{Number(c.actual_cost || 0).toLocaleString()}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === 'weekly' && admin && (
          <div className="space-y-6">
            {loading && !weeklySettings ? (
              <p className="text-sm text-gray-400 py-8 text-center">Loading weekly report settings...</p>
            ) : (
              <>
                <div className="card p-5">
                  <h3 className="font-semibold mb-4">Weekly Report Settings</h3>
                  {weeklySettings && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={weeklySettings.enabled} onChange={e => setWeeklySettings(s => ({ ...s, enabled: e.target.checked }))} />
                        Enable weekly reports
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={weeklySettings.super_admin_enabled} onChange={e => setWeeklySettings(s => ({ ...s, super_admin_enabled: e.target.checked }))} />
                        Send to Super Admins
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={weeklySettings.sales_manager_enabled} onChange={e => setWeeklySettings(s => ({ ...s, sales_manager_enabled: e.target.checked }))} />
                        Send to Sales Managers
                      </label>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Day of week</label>
                        <select className="input w-full" value={weeklySettings.day_of_week} onChange={e => setWeeklySettings(s => ({ ...s, day_of_week: +e.target.value }))}>
                          {reportsApi.WEEKDAY_LABELS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Time</label>
                        <div className="flex gap-2">
                          <input className="input w-20" type="number" min={0} max={23} value={weeklySettings.hour} onChange={e => setWeeklySettings(s => ({ ...s, hour: +e.target.value }))} />
                          <span className="self-center">:</span>
                          <input className="input w-20" type="number" min={0} max={59} value={weeklySettings.minute} onChange={e => setWeeklySettings(s => ({ ...s, minute: +e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Timezone</label>
                        <input className="input w-full" value={weeklySettings.timezone || ''} onChange={e => setWeeklySettings(s => ({ ...s, timezone: e.target.value }))} />
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button onClick={saveWeeklySettings} disabled={savingSettings} className="btn-primary text-xs">{savingSettings ? 'Saving...' : 'Save Settings'}</button>
                    <button onClick={handleTriggerWeekly} disabled={triggering || !reportRecipients.length} className="btn-secondary text-xs">{triggering ? 'Sending...' : `Send to ${reportRecipients.length} recipient(s)`}</button>
                    <button onClick={loadWeeklyData} className="btn-secondary text-xs">Refresh Preview</button>
                  </div>
                </div>

                <div className="card p-5">
                  <h3 className="font-semibold mb-1">Email Recipients</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Loaded from <code className="text-brand-600">GET /admin/users</code>. Reports are sent to the email addresses of included users.
                    {reportRecipients.length > 0 && (
                      <span className="block mt-1 text-brand-700 font-medium">
                        Will send to: {reportRecipients.map(u => u.email).join(', ')}
                      </span>
                    )}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-th w-10">Send</th>
                          <th className="table-th">Name</th>
                          <th className="table-th">Email</th>
                          <th className="table-th">Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {adminUsers.length === 0 ? (
                          <tr><td colSpan={4} className="table-td text-center py-6 text-gray-400">No users found</td></tr>
                        ) : adminUsers.map(u => {
                          const eligible = reportsApi.isWeeklyRecipientEligible(u, weeklySettings);
                          const included = reportsApi.isUserIncludedInReports(u, weeklySettings);
                          return (
                            <tr key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
                              <td className="table-td">
                                {eligible ? (
                                  <input
                                    type="checkbox"
                                    checked={included}
                                    onChange={e => toggleRecipient(u.id, e.target.checked)}
                                  />
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                              <td className="table-td">{userDisplayName(u)}</td>
                              <td className="table-td text-blue-600">{u.email}</td>
                              <td className="table-td capitalize">{u.role?.replace('_', ' ')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Super Admins and Sales Managers are eligible when their role toggle is enabled above. Uncheck a user to exclude them via saved settings.
                  </p>
                </div>

                {summary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[['New Leads', summary.new_leads_total], ['Converted', summary.converted_leads], ['Deals Won', summary.deals_won_count], ['Tasks Done', summary.tasks_completed]].map(([l, v]) => (
                      <div key={l} className="card p-4 text-center"><p className="text-xs text-gray-500">{l}</p><p className="text-2xl font-bold mt-1">{v ?? 0}</p></div>
                    ))}
                  </div>
                )}

                {weeklyPreview && (
                  <div className="card p-5">
                    <h3 className="font-semibold mb-2">Preview — {weeklyPreview.company_name}</h3>
                    <p className="text-xs text-gray-500 mb-4">{weeklyPreview.period_start} to {weeklyPreview.period_end}</p>
                    <div className="border rounded-lg overflow-hidden bg-white max-h-[480px] overflow-y-auto">
                      <iframe title="Weekly report preview" srcDoc={weeklyPreview.html_body} className="w-full min-h-[400px] border-0" sandbox="" />
                    </div>
                  </div>
                )}

                <div className="card overflow-x-auto">
                  <h3 className="font-semibold p-5 pb-0">Delivery Logs</h3>
                  <table className="w-full mt-3"><thead className="bg-gray-50"><tr>
                    <th className="table-th">Recipient</th><th className="table-th">Period</th><th className="table-th">Status</th>
                    <th className="table-th">Trigger</th><th className="table-th">Sent At</th>
                  </tr></thead>
                    <tbody className="divide-y">{weeklyLogs.length === 0 ? (
                      <tr><td colSpan={5} className="table-td text-center py-8 text-gray-400">No delivery logs yet</td></tr>
                    ) : weeklyLogs.map(log => (
                      <tr key={log.id}>
                        <td className="table-td">{log.recipient_email}</td>
                        <td className="table-td text-xs">{log.report_period_start} – {log.report_period_end}</td>
                        <td className="table-td"><span className={`badge ${log.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{log.status}</span></td>
                        <td className="table-td capitalize">{log.trigger_type?.replace('_', ' ')}</td>
                        <td className="table-td text-xs">{log.sent_at ? new Date(log.sent_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  {logsTotal > 10 && (
                    <div className="flex justify-between px-4 py-3 border-t">
                      <p className="text-xs text-gray-500">{logsTotal} log(s)</p>
                      <div className="flex gap-2">
                        <button onClick={() => setLogsPage(p => p - 1)} disabled={logsPage === 1} className="btn-secondary text-xs py-1">← Prev</button>
                        <button onClick={() => setLogsPage(p => p + 1)} disabled={logsPage * 10 >= logsTotal} className="btn-secondary text-xs py-1">Next →</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </CRMLayout>
  );
}
