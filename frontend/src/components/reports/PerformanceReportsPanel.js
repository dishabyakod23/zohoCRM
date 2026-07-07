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
  const [managementRecipients, setManagementRecipients] = useState([]);
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
      const managers = list.filter((u) => u.role === 'super_admin' || u.role === 'sales_manager');
      setManagementRecipients(managers);
      if (!selectedUserId && list.length) {
        const firstRep = list.find((u) => u.role !== 'super_admin') || list[0];
        setSelectedUserId(String(firstRep.id));
      }
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
      showToast('Select a team member first');
      return;
    }
    if (!managementRecipients.length) {
      showToast('No admin or sales manager recipients found');
      return;
    }
    setSending(true);
    try {
      const result = await performanceApi.sendPerformanceReport({
        user_id: selectedUserId,
        date_from: period.period_start,
        date_to: period.period_end,
      });
      showToast(result.message || 'Performance report sent to management', 'success');
      loadLogs();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPreview = () => {
    if (!preview?.html_body) return;
    (async () => {
      try {
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import('html2canvas'),
          import('jspdf'),
        ]);
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-10000px';
        container.style.top = '0';
        container.style.width = '1024px';
        container.style.background = '#fff';
        container.innerHTML = preview.html_body;
        document.body.appendChild(container);

        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        document.body.removeChild(container);

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/png');

        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
          heightLeft -= pageHeight;
        }

        pdf.save(`performance-report-preview-${selectedUserId || 'user'}.pdf`);
      } catch (err) {
        showToast(getApiError(err) || 'Failed to download PDF preview');
      }
    })();
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-semibold mb-1">Individual Performance Report</h3>
        <p className="text-xs text-gray-500 mb-4">
          Preview a weekly sales status report for a team member. Sending delivers the report to all admins and sales managers, not to the selected person.
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
          <button type="button" onClick={handleSend} disabled={sending || !selectedUserId || !managementRecipients.length} className="btn-primary text-xs">
            {sending ? 'Sending…' : 'Send to admins and managers'}
          </button>
        </div>
      </div>

      {summary && (
        <div className="space-y-4">
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
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-semibold">Preview</h3>
                <button type="button" onClick={handleDownloadPreview} className="btn-secondary text-xs">
                  Download
                </button>
              </div>
              <iframe
                title="Performance report preview"
                srcDoc={preview.html_body}
                className="w-full min-h-[480px] border-0"
                sandbox=""
              />
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
