'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { userDisplayName } from '../../lib/userHelpers.js';
import { roleLabel } from '../../lib/roles.js';
import { leadStatusLabel } from '../../lib/leadHelpers.js';
import * as performanceApi from '../../lib/services/performanceReports.js';

export default function PerformanceReportsPanel() {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [period, setPeriod] = useState(() => performanceApi.getDefaultPerformancePeriod());
  const [preview, setPreview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const list = await performanceApi.listPerformanceUsers();
      setUsers(list);
      if (!selectedUserId && list.length) setSelectedUserId(String(list[0].id));
    } catch (err) {
      showToast(getApiError(err));
    }
  }, [selectedUserId, showToast]);

  const loadPreview = useCallback(async () => {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      const data = await performanceApi.previewPerformanceReport({
        user_id: selectedUserId,
        date_from: period.period_start,
        date_to: period.period_end,
      });
      setPreview(data);
    } catch (err) {
      showToast(getApiError(err));
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [selectedUserId, period, showToast]);

  const loadLogs = useCallback(async () => {
    try {
      const result = await performanceApi.listPerformanceReportLogs({ page: logsPage, page_size: 10 });
      setLogs(result.data);
      setLogsTotal(result.total);
    } catch {
      setLogs([]);
      setLogsTotal(0);
    }
  }, [logsPage]);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => {
    if (selectedUserId) loadPreview();
  }, [selectedUserId, loadPreview]);

  const selectedUser = useMemo(
    () => users.find((u) => String(u.id) === String(selectedUserId)),
    [users, selectedUserId],
  );

  const summary = preview?.summary;

  const handleSend = async () => {
    if (!selectedUserId) {
      showToast('Select a user first');
      return;
    }
    if (!selectedUser?.email) {
      showToast('Selected user has no email address');
      return;
    }
    setSending(true);
    try {
      const result = await performanceApi.sendPerformanceReport({
        user_id: selectedUserId,
        date_from: period.period_start,
        date_to: period.period_end,
      });
      showToast(result.message || 'Performance report sent', 'success');
      loadLogs();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSending(false);
    }
  };

  const summaryCards = summary ? [
    ['Leads owned', summary.total_leads_owned],
    ['New leads', summary.new_leads],
    ['Contacts', summary.new_contacts],
    ['Accounts', summary.new_accounts],
    ['Deals won', summary.deals_won],
    ['Tasks done', summary.tasks_completed],
    ['Calls', summary.calls_logged],
    ['Conversion', `${summary.conversion_rate}%`],
  ] : [];

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-semibold mb-1">Individual Performance Report</h3>
        <p className="text-xs text-gray-500 mb-4">
          Preview and email a performance summary for each team member. Managers see their team; admins see all users.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Team member</label>
            <select className="input w-full" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              <option value="">Select user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{userDisplayName(u)} ({roleLabel(u.role)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">From</label>
            <input className="input w-full" type="date" value={period.period_start}
              onChange={(e) => setPeriod((p) => ({ ...p, period_start: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To</label>
            <input className="input w-full" type="date" value={period.period_end}
              onChange={(e) => setPeriod((p) => ({ ...p, period_end: e.target.value }))} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={loadPreview} disabled={loading || !selectedUserId} className="btn-secondary text-xs">
            {loading ? 'Loading…' : 'Refresh preview'}
          </button>
          <button type="button" onClick={handleSend} disabled={sending || !selectedUserId || !selectedUser?.email} className="btn-primary text-xs">
            {sending ? 'Sending…' : `Send to ${selectedUser?.email || 'user'}`}
          </button>
        </div>
      </div>

      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summaryCards.map(([label, value]) => (
              <div key={label} className="card p-4 text-center">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-2xl font-bold mt-1">{value ?? 0}</p>
              </div>
            ))}
          </div>

          {(summary.leads_by_status || []).length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold mb-3">New leads by status</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-th text-left">Status</th>
                    <th className="table-th text-right">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summary.leads_by_status.map((row) => (
                    <tr key={row.label}>
                      <td className="table-td">{leadStatusLabel(row.label)}</td>
                      <td className="table-td text-right font-medium">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview?.html_body && (
            <div className="card p-5">
              <h3 className="font-semibold mb-3">Email preview</h3>
              <div className="border border-zoho-border rounded-lg overflow-hidden bg-white">
                <iframe
                  title="Performance report preview"
                  srcDoc={preview.html_body}
                  className="w-full min-h-[480px] border-0"
                  sandbox=""
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card p-5">
        <h3 className="font-semibold mb-3">Send history</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No performance reports sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">User</th>
                  <th className="table-th">Email</th>
                  <th className="table-th">Period</th>
                  <th className="table-th">Sent by</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Sent at</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="table-td">{log.user_name || '—'}</td>
                    <td className="table-td">{log.recipient_email}</td>
                    <td className="table-td">{log.report_period_start} – {log.report_period_end}</td>
                    <td className="table-td">{log.sent_by_name || '—'}</td>
                    <td className="table-td capitalize">{log.status}</td>
                    <td className="table-td">{log.sent_at ? new Date(log.sent_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {logsTotal > 10 && (
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" disabled={logsPage <= 1} onClick={() => setLogsPage((p) => p - 1)} className="btn-secondary text-xs">Previous</button>
            <button type="button" disabled={logsPage * 10 >= logsTotal} onClick={() => setLogsPage((p) => p + 1)} className="btn-secondary text-xs">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
