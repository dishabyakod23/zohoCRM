'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import FormField from '../forms/FormField.js';
import Modal from '../ui/Modal.js';
import WeeklyKpiPreviewTable from '../settings/WeeklyKpiPreviewTable.js';
import { useToast } from '../ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import { fetchUsers } from '../../lib/services/lookups.js';
import * as salesTargetsApi from '../../lib/services/salesTargets.js';
import {
  TARGET_PERIOD_TYPES,
  TARGET_ROLES,
  formatAchievementPct,
  formatTargetAmount,
} from '../../lib/salesTargetHelpers.js';
import { buildPreviewRowsFromReportRow } from '../../lib/salesTargetMetrics.js';
import { userDisplayName } from '../../lib/userHelpers.js';

function achievementBadgeClass(status) {
  if (status === 'On Track') return 'bg-emerald-50 text-emerald-700';
  if (status === 'Needs Attention') return 'bg-amber-50 text-amber-700';
  if (status === 'Off Track') return 'bg-red-50 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

function defaultDateRange(periodType) {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now);
  if (periodType === 'weekly') start.setDate(start.getDate() - 6);
  else if (periodType === 'monthly') start.setMonth(start.getMonth() - 1);
  else if (periodType === 'quarterly') start.setMonth(start.getMonth() - 3);
  else start.setFullYear(start.getFullYear() - 1);
  return { date_from: start.toISOString().slice(0, 10), date_to: end };
}

export default function SalesTargetReportsPanel() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { can } = usePermissions();
  const canExport = can('settings_sales_targets', 'export') || can('reports', 'export');
  const canRemark = can('settings_sales_targets', 'edit');
  const canPickEmployee = can('settings_sales_targets', 'edit') || can('settings_sales_targets', 'create');

  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({
    period_type: 'weekly',
    all_time: false,
    ...defaultDateRange('weekly'),
    employee_id: '',
    reporting_manager_id: '',
    role: '',
  });
  const [remarkModal, setRemarkModal] = useState(null);
  const [remarkText, setRemarkText] = useState('');
  const [savingRemark, setSavingRemark] = useState(false);
  const [previewRow, setPreviewRow] = useState(null);

  const scopedEmployeeId = canPickEmployee ? filters.employee_id : (user?.id || '');
  const reportFilters = useMemo(() => ({
    ...filters,
    employee_id: scopedEmployeeId || undefined,
  }), [filters, scopedEmployeeId]);

  const previewRows = useMemo(
    () => (previewRow ? buildPreviewRowsFromReportRow(previewRow) : []),
    [previewRow],
  );

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await fetchUsers());
    } catch (err) {
      showToast(getApiError(err));
    }
  }, [showToast]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await salesTargetsApi.getSalesTargetPerformanceReport(reportFilters);
      setRows(data);
    } catch (err) {
      showToast(getApiError(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [reportFilters, showToast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { loadReport(); }, [loadReport]);

  useEffect(() => {
    if (!user?.id || canPickEmployee) return;
    setFilters((f) => ({ ...f, employee_id: user.id }));
  }, [user?.id, canPickEmployee]);

  const handlePeriodChange = (periodType) => {
    const range = defaultDateRange(periodType);
    setFilters((f) => ({ ...f, period_type: periodType, all_time: false, ...range }));
  };

  const handleAllTimeChange = (checked) => {
    setFilters((f) => ({
      ...f,
      all_time: checked,
      ...(checked ? { date_from: '', date_to: '' } : defaultDateRange(f.period_type)),
    }));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await salesTargetsApi.exportSalesTargetPerformanceReport(reportFilters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sales-target-${filters.period_type}-report.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Report exported', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setExporting(false);
    }
  };

  const openRemark = (row) => {
    setRemarkModal(row);
    setRemarkText(row.management_remarks || '');
  };

  const saveRemark = async () => {
    if (!remarkModal || !remarkText.trim()) return;
    setSavingRemark(true);
    try {
      await salesTargetsApi.addSalesTargetReportRemark({
        employee_id: remarkModal.employee_id,
        period_start: remarkModal.period_start,
        period_end: remarkModal.period_end,
        remarks: remarkText.trim(),
      });
      showToast('Remark saved', 'success');
      setRemarkModal(null);
      loadReport();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSavingRemark(false);
    }
  };

  const reportTitle = {
    weekly: 'Weekly Pipeline & Revenue Target Report',
    monthly: 'Monthly Pipeline & Revenue Target Report',
    quarterly: 'Quarterly Sales Performance Report',
    yearly: 'Yearly Sales Target Achievement Report',
  }[filters.period_type] || 'Sales Target Performance Report';

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-semibold mb-1">{reportTitle}</h3>
        <p className="text-xs text-zoho-muted mb-4">Target vs actual from <code className="text-brand-600">/sales-targets/reports/performance</code></p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <FormField label="Period" name="period_type">
            <select className="input text-xs" value={filters.period_type} onChange={(e) => handlePeriodChange(e.target.value)}>
              {TARGET_PERIOD_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </FormField>
          <FormField label="Date range" name="all_time">
            <select
              className="input text-xs"
              value={filters.all_time ? 'all_time' : 'custom'}
              onChange={(e) => handleAllTimeChange(e.target.value === 'all_time')}
            >
              <option value="custom">Custom dates</option>
              <option value="all_time">All time</option>
            </select>
          </FormField>
          <FormField label="From" name="date_from">
            <input
              className="input text-xs"
              type="date"
              value={filters.date_from}
              disabled={filters.all_time}
              onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value, all_time: false }))}
            />
          </FormField>
          <FormField label="To" name="date_to">
            <input
              className="input text-xs"
              type="date"
              value={filters.date_to}
              disabled={filters.all_time}
              onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value, all_time: false }))}
            />
          </FormField>
          {canPickEmployee ? (
            <FormField label="Employee" name="employee_id">
              <select className="input text-xs" value={filters.employee_id} onChange={(e) => setFilters((f) => ({ ...f, employee_id: e.target.value }))}>
                <option value="">All</option>
                {users.map((u) => <option key={u.id} value={u.id}>{userDisplayName(u)}</option>)}
              </select>
            </FormField>
          ) : (
            <FormField label="Employee" name="employee_id">
              <input className="input text-xs bg-gray-50" value={userDisplayName(user)} disabled readOnly />
            </FormField>
          )}
          <FormField label="Role" name="role">
            <select className="input text-xs" value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}>
              <option value="">All</option>
              {TARGET_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </FormField>
          <div className="flex items-end gap-2">
            <button type="button" onClick={loadReport} className="btn-secondary text-xs">Refresh</button>
            {canExport && (
              <button type="button" onClick={handleExport} disabled={exporting} className="btn-primary text-xs">
                {exporting ? 'Exporting…' : 'Export'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-th">Period</th>
              <th className="table-th">Employee</th>
              <th className="table-th">Pipeline Target</th>
              <th className="table-th">Actual Pipeline</th>
              <th className="table-th">Pipeline %</th>
              <th className="table-th">Revenue Target</th>
              <th className="table-th">Actual Revenue</th>
              <th className="table-th">Revenue %</th>
              <th className="table-th">Status</th>
              <th className="table-th">KPI Report</th>
              {canRemark && <th className="table-th">Remarks</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={canRemark ? 11 : 10} className="table-td text-center py-8 text-gray-400">Loading report…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={canRemark ? 11 : 10} className="table-td text-center py-8 text-gray-400">No report data for this period</td></tr>
            ) : rows.map((row) => (
              <tr key={`${row.employee_id}-${row.period_start}-${row.period_end}`}>
                <td className="table-td">
                  <div className="font-medium">{row.period_name}</div>
                  <div className="text-xs text-zoho-muted">{row.period_start} – {row.period_end}</div>
                </td>
                <td className="table-td">
                  <div>{row.employee_name}</div>
                  <div className="text-xs text-zoho-muted">{row.role_label}</div>
                </td>
                <td className="table-td">{formatTargetAmount(row.pipeline_target, row.currency)}</td>
                <td className="table-td">{formatTargetAmount(row.actuals?.actual_pipeline, row.currency)}</td>
                <td className="table-td">{formatAchievementPct(row.achievement?.pipeline_achievement_pct)}</td>
                <td className="table-td">{formatTargetAmount(row.revenue_target, row.currency)}</td>
                <td className="table-td">{formatTargetAmount(row.actuals?.actual_revenue, row.currency)}</td>
                <td className="table-td">{formatAchievementPct(row.achievement?.revenue_achievement_pct)}</td>
                <td className="table-td">
                  <span className={`badge ${achievementBadgeClass(row.achievement?.status)}`}>{row.achievement?.status}</span>
                </td>
                <td className="table-td">
                  <button
                    type="button"
                    onClick={() => setPreviewRow(row)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View preview
                  </button>
                </td>
                {canRemark && (
                  <td className="table-td">
                    <button type="button" onClick={() => openRemark(row)} className="text-xs text-blue-600 hover:underline">
                      {row.management_remarks ? 'Edit' : 'Add'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previewRow && (
        <Modal
          title={`KPI Report — ${previewRow.employee_name}`}
          onClose={() => setPreviewRow(null)}
          wide
        >
          <p className="text-sm text-zoho-muted mb-4">
            {previewRow.period_name} · {previewRow.period_start} – {previewRow.period_end}
          </p>
          <WeeklyKpiPreviewTable
            rows={previewRows}
            ownerName={previewRow.employee_name}
            periodStart={previewRow.period_start}
            periodEnd={previewRow.period_end}
          />
        </Modal>
      )}

      {remarkModal && (
        <Modal title="Management Remarks" onClose={() => setRemarkModal(null)}>
          <p className="text-sm text-zoho-muted mb-3">
            {remarkModal.employee_name} · {remarkModal.period_name}
          </p>
          <textarea
            className="input min-h-[100px] w-full"
            value={remarkText}
            onChange={(e) => setRemarkText(e.target.value)}
            placeholder="Add management notes for this period…"
          />
          <div className="flex gap-2 justify-end pt-4">
            <button type="button" onClick={() => setRemarkModal(null)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={saveRemark} disabled={savingRemark} className="btn-primary">
              {savingRemark ? 'Saving…' : 'Save Remark'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
