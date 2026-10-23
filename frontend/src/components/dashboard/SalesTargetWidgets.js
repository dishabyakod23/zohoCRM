'use client';

import { useCallback, useEffect, useState } from 'react';
import AppLink from '../ui/AppLink.js';
import * as salesTargetsApi from '../../lib/services/salesTargets.js';
import { formatTargetAmount } from '../../lib/salesTargetHelpers.js';
import { getApiError } from '../../lib/api.js';
import { useToast } from '../ui/Toast.js';
import { useCrmLiveRefresh } from '../../lib/crmLiveRefresh.js';
import { currentMonthProposalsHref } from '../../lib/salesTargetDashboardEnrichment.js';

function ProgressBar({ actual, target, color = 'bg-brand-500' }) {
  const actualNum = Number(actual) || 0;
  const targetNum = Number(target) || 0;
  const pct = targetNum > 0 ? Math.min(100, Math.round((actualNum / targetNum) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-zoho-muted mb-1">
        <span>{formatTargetAmount(actualNum)} actual</span>
        <span>{targetNum > 0 ? `${pct}%` : 'Not Configured'}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-zoho-muted mt-1">Target: {formatTargetAmount(targetNum)}</p>
    </div>
  );
}

function roleBadgeClass(role) {
  return role === 'sales_manager'
    ? 'bg-violet-50 text-violet-700'
    : 'bg-blue-50 text-blue-700';
}

function statusToneClass(tone) {
  if (tone === 'over') return 'bg-emerald-50 text-emerald-700';
  if (tone === 'warn') return 'bg-amber-50 text-amber-700';
  if (tone === 'under') return 'bg-red-50 text-red-700';
  return 'bg-gray-50 text-gray-600';
}

function statusDotClass(tone) {
  if (tone === 'over') return 'bg-emerald-500';
  if (tone === 'warn') return 'bg-amber-500';
  if (tone === 'under') return 'bg-red-500';
  return 'bg-gray-400';
}

function barClass(tone) {
  if (tone === 'over') return 'bg-emerald-500';
  if (tone === 'warn') return 'bg-amber-500';
  if (tone === 'under') return 'bg-red-500';
  return 'bg-gray-300';
}

function PipelineAchievementTable({ rows }) {
  if (!rows?.length) {
    return <p className="text-sm text-zoho-muted text-center py-8">No pipeline targets yet</p>;
  }
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="table-th">User</th>
            <th className="table-th">Role</th>
            <th className="table-th">Achieved Pipeline</th>
            <th className="table-th">Target</th>
            <th className="table-th">Achievement</th>
            <th className="table-th min-w-[140px]">Progress</th>
            <th className="table-th">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.employee_id} className="border-b border-zoho-border last:border-0">
              <td className="table-td font-medium text-zoho-text whitespace-nowrap">{row.employee_name}</td>
              <td className="table-td">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${roleBadgeClass(row.role)}`}>
                  {row.role_label}
                </span>
              </td>
              <td className="table-td whitespace-nowrap">{formatTargetAmount(row.achieved_pipeline)}</td>
              <td className="table-td whitespace-nowrap text-zoho-muted">{formatTargetAmount(row.pipeline_target)}</td>
              <td className="table-td font-medium whitespace-nowrap">{row.pipeline_target > 0 ? `${row.achievement_pct}%` : '—'}</td>
              <td className="table-td">
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden min-w-[96px]">
                  <div
                    className={`h-full rounded-full ${barClass(row.status_tone)}`}
                    style={{ width: `${Math.min(100, row.achievement_pct || 0)}%` }}
                  />
                </div>
              </td>
              <td className="table-td whitespace-nowrap">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusToneClass(row.status_tone)}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(row.status_tone)}`} />
                  {row.status_label}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SalesTargetWidgets() {
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback((opts = {}) => {
    if (!opts.silent) setLoading(true);
    salesTargetsApi.getSalesTargetDashboard()
      .then(setSummary)
      .catch((err) => showToast(getApiError(err)))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useCrmLiveRefresh(() => loadSummary({ silent: true }), { minIntervalMs: 1500, pollIntervalMs: 30000 });

  if (loading) {
    return (
      <div className="col-span-12 card p-5 text-sm text-zoho-muted text-center">Loading sales targets…</div>
    );
  }

  if (!summary) return null;

  const overallActual = summary.overall_pipeline_actual ?? summary.monthly_pipeline_actual;
  const monthHref = summary.current_month_proposals_href || currentMonthProposalsHref();
  const monthLabel = summary.pipeline_month_label || 'This month';
  const achievementRows = summary.pipeline_achievement || [];

  return (
    <>
      <AppLink href="/proposals" className="col-span-12 sm:col-span-6 lg:col-span-4 zoho-widget h-full block hover:shadow-card transition-shadow">
        <h3 className="zoho-widget-title">Overall Pipeline</h3>
        <p className="text-xl font-semibold text-zoho-text tracking-tight">
          {formatTargetAmount(overallActual)}
        </p>
        <p className="text-xs text-zoho-muted mt-1">All open proposals · View list →</p>
      </AppLink>
      <AppLink href={monthHref} className="col-span-12 sm:col-span-6 lg:col-span-4 zoho-widget h-full block hover:shadow-card transition-shadow">
        <h3 className="zoho-widget-title">This Month Pipeline</h3>
        <ProgressBar
          actual={summary.monthly_pipeline_actual}
          target={summary.monthly_pipeline_target}
          color="bg-accent-teal"
        />
        <p className="text-xs text-brand-600 mt-2">{monthLabel} · View proposals →</p>
      </AppLink>
      <div className="col-span-12 sm:col-span-6 lg:col-span-4">
        <div className="zoho-widget h-full">
          <h3 className="zoho-widget-title">Monthly Revenue</h3>
          <ProgressBar
            actual={summary.monthly_revenue_actual}
            target={summary.monthly_revenue_target}
            color="bg-brand-600"
          />
        </div>
      </div>

      <div className="col-span-12 lg:col-span-6 zoho-widget">
        <div className="flex items-center justify-between mb-3">
          <h3 className="zoho-widget-title mb-0">Monthly Pipeline Achievement</h3>
          <AppLink href="/reports" className="text-xs text-brand-600 hover:underline">View reports →</AppLink>
        </div>
        <PipelineAchievementTable rows={achievementRows} />
      </div>
    </>
  );
}
