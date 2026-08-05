'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CRMLayout from '../layout/CRMLayout.js';
import FormField, { inputClass } from '../forms/FormField.js';
import WeeklyKpiPreviewTable from './WeeklyKpiPreviewTable.js';
import { useToast } from '../ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import { DEFAULT_CURRENCY } from '../../lib/currencies.js';
import { userDisplayName } from '../../lib/userHelpers.js';
import { roleLabel, normalizeRole } from '../../lib/roles.js';
import { fetchUsers } from '../../lib/services/lookups.js';
import * as salesTargetsApi from '../../lib/services/salesTargets.js';
import {
  TARGET_PERIOD_TYPES,
  TARGET_STATUSES,
} from '../../lib/salesTargetHelpers.js';
import {
  applyMetricsToForm,
  availableMetricsToAdd,
  buildPreviewRows,
  createMetricRow,
  defaultMetricRows,
  metricsFromTarget,
} from '../../lib/salesTargetMetrics.js';

const EMPTY_FORM = {
  period_type: 'weekly',
  period_name: '',
  start_date: '',
  end_date: '',
  employee_id: '',
  role: 'sales_rep',
  reporting_manager_id: '',
  currency: DEFAULT_CURRENCY,
  pipeline_target: '',
  revenue_target: '',
  collection_target: '',
  proposal_value_target: '',
  proposal_count_target: '',
  qualified_meetings_target: '',
  deal_closure_count_target: '',
  status: 'draft',
  is_manual_override: false,
  override_reason: '',
  remarksText: '',
};

export default function SalesTargetEditor({ targetId = null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canSave = targetId ? can('settings_sales_targets', 'edit') : can('settings_sales_targets', 'create');

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(!!targetId);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [metrics, setMetrics] = useState(defaultMetricRows());
  const [metricToAdd, setMetricToAdd] = useState('');

  const managers = useMemo(
    () => users.filter((u) => normalizeRole(u.role) === 'sales_manager'),
    [users],
  );

  const selectedEmployee = useMemo(
    () => users.find((u) => String(u.id) === String(form.employee_id)),
    [users, form.employee_id],
  );

  const previewRows = useMemo(
    () => buildPreviewRows(metrics, {}, form.currency),
    [metrics, form.currency],
  );

  const loadData = useCallback(async () => {
    try {
      const userList = await fetchUsers();
      setUsers(userList);
      if (!targetId) return;
      setLoading(true);
      const target = await salesTargetsApi.getSalesTarget(targetId);
      const parsed = metricsFromTarget(target);
      setForm({
        period_type: target.period_type,
        period_name: target.period_name,
        start_date: target.start_date,
        end_date: target.end_date,
        employee_id: target.employee_id,
        role: target.role,
        reporting_manager_id: target.reporting_manager_id || '',
        currency: target.currency,
        pipeline_target: target.pipeline_target,
        revenue_target: target.revenue_target,
        collection_target: target.collection_target || '',
        proposal_value_target: target.proposal_value_target || '',
        proposal_count_target: target.proposal_count_target ?? '',
        qualified_meetings_target: target.qualified_meetings_target ?? '',
        deal_closure_count_target: target.deal_closure_count_target ?? '',
        status: target.status,
        is_manual_override: target.is_manual_override,
        override_reason: target.override_reason || '',
        remarksText: parsed.remarksText || '',
      });
      setMetrics(parsed.metrics);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [targetId, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleEmployeeChange = (employeeId) => {
    const employee = users.find((u) => String(u.id) === String(employeeId));
    const role = normalizeRole(employee?.role) || 'sales_rep';
    setForm((f) => ({
      ...f,
      employee_id: employeeId,
      role: role === 'sales_manager' ? 'sales_manager' : 'sales_rep',
    }));
  };

  const updateMetric = (id, patch) => {
    setMetrics((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeMetric = (id) => {
    setMetrics((rows) => rows.filter((row) => row.id !== id));
  };

  const addMetric = () => {
    if (metricToAdd === '__custom__') {
      setMetrics((rows) => [...rows, createMetricRow({ label: 'Custom Metric', isCustom: true, key: `custom_${Date.now()}` })]);
      setMetricToAdd('');
      return;
    }
    const def = availableMetricsToAdd(metrics).find((m) => m.key === metricToAdd);
    if (!def) return;
    setMetrics((rows) => [...rows, createMetricRow(def)]);
    setMetricToAdd('');
  };

  const saveTarget = async () => {
    if (!form.period_name?.trim() || !form.start_date || !form.end_date || !form.employee_id) {
      showToast('Period name, dates, and employee are required');
      return;
    }
    setSaving(true);
    try {
      const payload = applyMetricsToForm({ ...form, remarks: form.remarksText }, metrics);
      if (targetId) {
        await salesTargetsApi.updateSalesTarget(targetId, payload);
        showToast('Target updated', 'success');
      } else {
        await salesTargetsApi.createSalesTarget(payload);
        showToast('Target created', 'success');
      }
      router.push('/settings?sales_targets=1');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <CRMLayout>
        <div className="p-8 text-center text-sm text-gray-400">Loading target configuration…</div>
      </CRMLayout>
    );
  }

  const addOptions = availableMetricsToAdd(metrics);

  return (
    <CRMLayout>
      <div className="max-w-6xl mx-auto w-full p-4 md:p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/settings?sales_targets=1" className="text-xs text-brand-600 hover:underline">← Back to Pipeline &amp; Revenue Targets</Link>
            <h1 className="text-lg font-semibold text-zoho-text mt-2">
              {targetId ? 'Edit Target' : 'Add Target'}
            </h1>
            <p className="text-sm text-zoho-muted">Configure metrics and preview the weekly KPI report below</p>
          </div>
          {canSave && (
            <button type="button" onClick={saveTarget} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Saving…' : 'Save Target'}
            </button>
          )}
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold">Basic Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Target Period" required name="period_type">
              <select className="input" value={form.period_type} onChange={(e) => setForm((f) => ({ ...f, period_type: e.target.value }))} disabled={!!targetId}>
                {TARGET_PERIOD_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </FormField>
            <FormField label="Status" name="status">
              <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {TARGET_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </FormField>
            <FormField label="Period Name" required name="period_name">
              <input className="input" value={form.period_name} onChange={(e) => setForm((f) => ({ ...f, period_name: e.target.value }))} placeholder="e.g. Week 1 Aug 2026" />
            </FormField>
            <FormField label="Currency" name="currency">
              <input className="input" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
            </FormField>
            <FormField label="Start Date" required name="start_date">
              <input className="input" type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </FormField>
            <FormField label="End Date" required name="end_date">
              <input className="input" type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
            </FormField>
            <FormField label="Employee" required name="employee_id">
              <select className="input" value={form.employee_id} onChange={(e) => handleEmployeeChange(e.target.value)} disabled={!!targetId}>
                <option value="">Select employee</option>
                {users.filter((u) => u.is_active !== false).map((u) => (
                  <option key={u.id} value={u.id}>{userDisplayName(u)} ({roleLabel(u.role)})</option>
                ))}
              </select>
            </FormField>
            <FormField label="Reporting Manager" name="reporting_manager_id">
              <select className="input" value={form.reporting_manager_id} onChange={(e) => setForm((f) => ({ ...f, reporting_manager_id: e.target.value }))}>
                <option value="">Select manager</option>
                {managers.map((u) => <option key={u.id} value={u.id}>{userDisplayName(u)}</option>)}
              </select>
            </FormField>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold">Target Metrics</h2>
              <p className="text-xs text-zoho-muted">Add, remove, and set target values for each KPI</p>
            </div>
            <div className="flex gap-2 items-center">
              <select className="input text-xs" value={metricToAdd} onChange={(e) => setMetricToAdd(e.target.value)}>
                <option value="">Add metric…</option>
                {addOptions.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                <option value="__custom__">+ Custom metric</option>
              </select>
              <button type="button" onClick={addMetric} disabled={!metricToAdd} className="btn-secondary text-xs">Add</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">Metric</th>
                  <th className="table-th">Type</th>
                  <th className="table-th">Target Value</th>
                  <th className="table-th w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {metrics.length === 0 ? (
                  <tr><td colSpan={4} className="table-td text-center py-8 text-gray-400">No metrics configured</td></tr>
                ) : metrics.map((metric) => (
                  <tr key={metric.id}>
                    <td className="table-td">
                      {metric.isCustom ? (
                        <input
                          className="input text-sm"
                          value={metric.label}
                          onChange={(e) => updateMetric(metric.id, { label: e.target.value })}
                          placeholder="Metric name"
                        />
                      ) : (
                        <span className="font-medium">{metric.label}</span>
                      )}
                    </td>
                    <td className="table-td text-xs text-zoho-muted capitalize">{metric.type}</td>
                    <td className="table-td">
                      <input
                        className="input text-sm"
                        type="number"
                        min="0"
                        value={metric.target}
                        onChange={(e) => updateMetric(metric.id, { target: e.target.value })}
                        placeholder="Not Configured"
                      />
                    </td>
                    <td className="table-td">
                      <button type="button" onClick={() => removeMetric(metric.id)} className="text-xs text-red-600 hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Live Preview</h2>
          <p className="text-xs text-zoho-muted">Preview updates as you change metric targets. Actuals will populate from CRM data in the live report.</p>
          <WeeklyKpiPreviewTable
            rows={previewRows}
            ownerName={selectedEmployee ? userDisplayName(selectedEmployee) : ''}
            periodStart={form.start_date}
            periodEnd={form.end_date}
          />
        </div>

        <div className="flex gap-2 justify-end pb-6">
          <Link href="/settings?sales_targets=1" className="btn-secondary">Cancel</Link>
          {canSave && (
            <button type="button" onClick={saveTarget} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Target'}
            </button>
          )}
        </div>
      </div>
    </CRMLayout>
  );
}
