'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLink from '../ui/AppLink.js';
import CRMLayout from '../layout/CRMLayout.js';
import WeeklyKpiPreviewTable from './WeeklyKpiPreviewTable.js';
import { useToast } from '../ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import * as salesTargetsApi from '../../lib/services/salesTargets.js';
import { formatTargetAmount, targetStatusLabel } from '../../lib/salesTargetHelpers.js';
import { buildPreviewRows, metricsFromTarget } from '../../lib/salesTargetMetrics.js';
import { fetchPreviewActualsForTargetForm } from '../../lib/salesTargetActuals.js';
import { navigateToRecord, salesTargetEditHref } from '../../lib/recordNavigation.js';

const LIST_HREF = '/settings?sales_targets=1';

function statusBadgeClass(status) {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700';
  if (status === 'locked') return 'bg-amber-50 text-amber-700';
  if (status === 'archived') return 'bg-gray-100 text-gray-600';
  return 'bg-slate-50 text-slate-600';
}

function Stat({ label, value }) {
  return (
    <div className="card px-4 py-3 min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-zoho-muted font-medium">{label}</p>
      <p className="text-base font-semibold text-zoho-text truncate mt-0.5" title={String(value)}>{value}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wider text-zoho-muted font-medium">{label}</dt>
      <dd className="text-sm text-zoho-text mt-0.5 break-words">{children || '—'}</dd>
    </div>
  );
}

/** Actuals for the target's employee and period: the performance report when it has a row, plus CRM activity. */
async function loadActuals(target) {
  let apiActuals = {};
  try {
    const report = await salesTargetsApi.getSalesTargetPerformanceReport({
      period_type: target.period_type,
      date_from: target.start_date,
      date_to: target.end_date,
      employee_id: target.employee_id,
    });
    const row = report.find((r) => (
      String(r.employee_id) === String(target.employee_id)
      && r.period_start === target.start_date
      && r.period_end === target.end_date
    )) || report[0];
    apiActuals = row?.actuals || {};
  } catch {
    apiActuals = {};
  }
  return fetchPreviewActualsForTargetForm({
    employee_id: target.employee_id,
    start_date: target.start_date,
    end_date: target.end_date,
    apiActuals,
  });
}

/** Read-only page for one pipeline & revenue target, opened from the targets list. */
export default function SalesTargetView({ targetId = null }) {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canEdit = can('settings_sales_targets', 'edit');
  const [target, setTarget] = useState(null);
  const [actuals, setActuals] = useState({});
  const [loadingActuals, setLoadingActuals] = useState(false);

  useEffect(() => {
    if (!targetId) return undefined;
    let cancelled = false;
    setTarget(null);
    salesTargetsApi.getSalesTarget(targetId)
      .then((loaded) => {
        if (cancelled) return;
        setTarget(loaded);
        if (!loaded.employee_id || !loaded.start_date || !loaded.end_date) return;
        setLoadingActuals(true);
        loadActuals(loaded)
          .then((result) => { if (!cancelled) setActuals(result || {}); })
          .catch(() => { if (!cancelled) setActuals({}); })
          .finally(() => { if (!cancelled) setLoadingActuals(false); });
      })
      .catch((err) => {
        if (cancelled) return;
        showToast(getApiError(err));
        navigateToRecord(LIST_HREF);
      });
    return () => { cancelled = true; };
  }, [targetId, showToast]);

  const parsed = useMemo(() => metricsFromTarget(target), [target]);
  const previewRows = useMemo(
    () => buildPreviewRows(parsed.metrics, actuals, target?.currency),
    [parsed.metrics, actuals, target?.currency],
  );

  if (!target) {
    return (
      <CRMLayout>
        <div className="p-8 text-center text-sm text-gray-400">Loading target…</div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="max-w-6xl mx-auto w-full p-4 md:p-6 space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <AppLink href={LIST_HREF} className="text-xs text-brand-600 hover:underline">← Back to Pipeline &amp; Revenue Targets</AppLink>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <h1 className="text-lg font-semibold text-zoho-text">{target.period_name || 'Target'}</h1>
              <span className={`badge ${statusBadgeClass(target.status)}`}>{targetStatusLabel(target.status)}</span>
            </div>
            <p className="text-sm text-zoho-muted">
              {target.period_type_label} · {target.start_date} – {target.end_date}
              {target.employee_name ? ` · ${target.employee_name}` : ''}
            </p>
          </div>
          {canEdit && target.status !== 'locked' && (
            <a href={salesTargetEditHref(target.id)} className="btn-secondary text-xs">Edit</a>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Pipeline Target" value={formatTargetAmount(target.pipeline_target, target.currency)} />
          <Stat label="Revenue Target" value={formatTargetAmount(target.revenue_target, target.currency)} />
          <Stat label="Employee" value={target.employee_name || '—'} />
          <Stat label="Reporting Manager" value={target.reporting_manager_name || '—'} />
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Basic Details</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <Field label="Target Period">{target.period_type_label}</Field>
            <Field label="Period Name">{target.period_name}</Field>
            <Field label="Status">{targetStatusLabel(target.status)}</Field>
            <Field label="Start Date">{target.start_date}</Field>
            <Field label="End Date">{target.end_date}</Field>
            <Field label="Currency">{target.currency}</Field>
            <Field label="Employee">{target.employee_name}</Field>
            <Field label="Role">{target.role_label}</Field>
            <Field label="Reporting Manager">{target.reporting_manager_name}</Field>
            <Field label="Source">{target.target_source_label}</Field>
            {target.is_manual_override && <Field label="Override Reason">{target.override_reason}</Field>}
          </dl>
          {parsed.remarksText && (
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wider text-zoho-muted font-medium">Remarks</p>
              <p className="text-sm text-zoho-text mt-0.5 whitespace-pre-wrap">{parsed.remarksText}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Targets vs Actuals</h2>
          <p className="text-xs text-zoho-muted">
            {loadingActuals
              ? 'Loading actuals from CRM activity…'
              : 'Actuals combine backend report data (when available) with CRM activity for this employee and period.'}
          </p>
          <WeeklyKpiPreviewTable
            rows={previewRows}
            ownerName={target.employee_name || ''}
            periodStart={target.start_date}
            periodEnd={target.end_date}
          />
        </div>
      </div>
    </CRMLayout>
  );
}
