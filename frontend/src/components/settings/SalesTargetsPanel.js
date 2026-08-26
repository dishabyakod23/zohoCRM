'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppLink from '../ui/AppLink.js';
import FormField from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import { DEFAULT_PAGE_SIZE } from '../../lib/constants.js';
import { userDisplayName } from '../../lib/userHelpers.js';
import { normalizeRole } from '../../lib/roles.js';
import { fetchUsers } from '../../lib/services/lookups.js';
import * as salesTargetsApi from '../../lib/services/salesTargets.js';
import {
  TARGET_PERIOD_TYPES,
  TARGET_ROLES,
  TARGET_STATUSES,
  formatTargetAmount,
  targetStatusLabel,
} from '../../lib/salesTargetHelpers.js';
import { salesTargetEditHref } from '../../lib/recordNavigation.js';

function statusBadgeClass(status) {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700';
  if (status === 'locked') return 'bg-amber-50 text-amber-700';
  if (status === 'archived') return 'bg-gray-100 text-gray-600';
  return 'bg-slate-50 text-slate-600';
}

export default function SalesTargetsPanel() {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canCreate = can('settings_sales_targets', 'create');
  const canEdit = can('settings_sales_targets', 'edit');
  const canDelete = can('settings_sales_targets', 'delete');

  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [targets, setTargets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [filters, setFilters] = useState({
    period_type: '',
    year: new Date().getFullYear(),
    quarter: '',
    month: '',
    role: '',
    employee_id: '',
    reporting_manager_id: '',
    status: '',
  });

  const managers = useMemo(
    () => users.filter((u) => normalizeRole(u.role) === 'sales_manager'),
    [users],
  );

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await fetchUsers());
    } catch (err) {
      showToast(getApiError(err));
    }
  }, [showToast]);

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await salesTargetsApi.getSalesTargetSettings());
    } catch (err) {
      showToast(getApiError(err));
    }
  }, [showToast]);

  const loadTargets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await salesTargetsApi.listSalesTargets({
        ...filters,
        year: filters.year || undefined,
        quarter: filters.quarter || undefined,
        month: filters.month || undefined,
        page,
        page_size: DEFAULT_PAGE_SIZE,
      });
      setTargets(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
      setTargets([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters, page, showToast]);

  useEffect(() => { loadUsers(); loadSettings(); }, [loadUsers, loadSettings]);
  useEffect(() => { loadTargets(); }, [loadTargets]);

  const handleLock = async (target, lock) => {
    try {
      if (lock) await salesTargetsApi.lockSalesTarget(target.id);
      else await salesTargetsApi.unlockSalesTarget(target.id);
      showToast(lock ? 'Target locked' : 'Target unlocked', 'success');
      loadTargets();
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const handleDelete = async (target) => {
    if (!window.confirm('Delete this draft target?')) return;
    try {
      await salesTargetsApi.deleteSalesTarget(target.id);
      showToast('Target deleted', 'success');
      loadTargets();
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const handleCopy = async (target) => {
    try {
      await salesTargetsApi.copySalesTarget({
        source_target_id: target.id,
        period_type: target.period_type,
        period_name: `${target.period_name} (Copy)`,
        start_date: target.start_date,
        end_date: target.end_date,
        employee_id: target.employee_id,
        status: 'draft',
      });
      showToast('Target copied', 'success');
      loadTargets();
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const updated = await salesTargetsApi.updateSalesTargetSettings(settings);
      setSettings(updated);
      showToast('Target settings saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {settings && canEdit && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-1">Target Configuration Settings</h2>
          <p className="text-xs text-zoho-muted mb-4">Company-wide rules for how pipeline and revenue targets are calculated.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Year Format" name="year_format">
              <select className="input" value={settings.year_format} onChange={(e) => setSettings((s) => ({ ...s, year_format: e.target.value }))}>
                <option value="calendar">Calendar Year (Jan–Dec)</option>
                <option value="financial">Financial Year (Apr–Mar)</option>
              </select>
            </FormField>
            <FormField label="Default Currency" name="default_currency">
              <input className="input" value={settings.default_currency} onChange={(e) => setSettings((s) => ({ ...s, default_currency: e.target.value }))} />
            </FormField>
            <FormField label="Pipeline Owner Rule" name="pipeline_owner_rule">
              <select className="input" value={settings.pipeline_owner_rule} onChange={(e) => setSettings((s) => ({ ...s, pipeline_owner_rule: e.target.value }))}>
                <option value="current_owner">Current Opportunity Owner</option>
                <option value="original_owner">Original Lead Owner</option>
              </select>
            </FormField>
          </div>
          <button type="button" onClick={saveSettings} disabled={savingSettings} className="btn-primary text-xs mt-4">
            {savingSettings ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold">Pipeline &amp; Revenue Targets</h2>
            <p className="text-xs text-zoho-muted">Configure weekly, monthly, quarterly, and yearly targets</p>
          </div>
          {canCreate && (
            <AppLink href="/settings/sales-targets/new" className="btn-primary text-xs">+ Add Target</AppLink>
          )}
        </div>

        <div className="p-4 border-b grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          <select className="input text-xs" value={filters.period_type} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, period_type: e.target.value })); }}>
            <option value="">All periods</option>
            {TARGET_PERIOD_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <input className="input text-xs" type="number" placeholder="Year" value={filters.year} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, year: e.target.value })); }} />
          <select className="input text-xs" value={filters.quarter} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, quarter: e.target.value })); }}>
            <option value="">Quarter</option>
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
          </select>
          <select className="input text-xs" value={filters.month} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, month: e.target.value })); }}>
            <option value="">Month</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="input text-xs" value={filters.role} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, role: e.target.value })); }}>
            <option value="">All roles</option>
            {TARGET_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select className="input text-xs" value={filters.employee_id} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, employee_id: e.target.value })); }}>
            <option value="">All employees</option>
            {users.map((u) => <option key={u.id} value={u.id}>{userDisplayName(u)}</option>)}
          </select>
          <select className="input text-xs" value={filters.reporting_manager_id} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, reporting_manager_id: e.target.value })); }}>
            <option value="">All managers</option>
            {managers.map((u) => <option key={u.id} value={u.id}>{userDisplayName(u)}</option>)}
          </select>
          <select className="input text-xs" value={filters.status} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, status: e.target.value })); }}>
            <option value="">All statuses</option>
            {TARGET_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Period</th>
                <th className="table-th">Employee</th>
                <th className="table-th">Role</th>
                <th className="table-th">Manager</th>
                <th className="table-th">Pipeline</th>
                <th className="table-th">Revenue</th>
                <th className="table-th">Source</th>
                <th className="table-th">Status</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={9} className="table-td text-center py-8 text-gray-400">Loading targets…</td></tr>
              ) : targets.length === 0 ? (
                <tr><td colSpan={9} className="table-td text-center py-8 text-gray-400">No targets found</td></tr>
              ) : targets.map((target) => (
                <tr key={target.id}>
                  <td className="table-td">
                    <div className="font-medium">{target.period_name}</div>
                    <div className="text-xs text-zoho-muted">{target.period_type_label} · {target.start_date} – {target.end_date}</div>
                  </td>
                  <td className="table-td">{target.employee_name || '—'}</td>
                  <td className="table-td">{target.role_label}</td>
                  <td className="table-td">{target.reporting_manager_name || '—'}</td>
                  <td className="table-td">{formatTargetAmount(target.pipeline_target, target.currency)}</td>
                  <td className="table-td">{formatTargetAmount(target.revenue_target, target.currency)}</td>
                  <td className="table-td text-xs">{target.target_source_label}</td>
                  <td className="table-td">
                    <span className={`badge ${statusBadgeClass(target.status)}`}>{targetStatusLabel(target.status)}</span>
                  </td>
                  <td className="table-td">
                    <div className="flex flex-wrap gap-2">
                      {canEdit && target.status !== 'locked' && (
                        <a href={salesTargetEditHref(target.id)} className="text-xs text-blue-600 hover:underline">Edit</a>
                      )}
                      {canCreate && (
                        <button type="button" onClick={() => handleCopy(target)} className="text-xs text-blue-600 hover:underline">Copy</button>
                      )}
                      {canEdit && target.status !== 'locked' && (
                        <button type="button" onClick={() => handleLock(target, true)} className="text-xs text-amber-600 hover:underline">Lock</button>
                      )}
                      {canEdit && target.status === 'locked' && (
                        <button type="button" onClick={() => handleLock(target, false)} className="text-xs text-amber-600 hover:underline">Unlock</button>
                      )}
                      {canDelete && target.status === 'draft' && (
                        <button type="button" onClick={() => handleDelete(target)} className="text-xs text-red-600 hover:underline">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > DEFAULT_PAGE_SIZE && (
          <div className="flex justify-between items-center px-4 py-3 border-t">
            <p className="text-xs text-gray-500">{total} target(s)</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1">← Prev</button>
              <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page * DEFAULT_PAGE_SIZE >= total} className="btn-secondary text-xs py-1">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
