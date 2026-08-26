'use client';

import { useEffect, useState } from 'react';
import AppLink from '../ui/AppLink.js';
import * as salesTargetsApi from '../../lib/services/salesTargets.js';
import { formatTargetAmount } from '../../lib/salesTargetHelpers.js';
import { getApiError } from '../../lib/api.js';
import { useToast } from '../ui/Toast.js';

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

export default function SalesTargetWidgets() {
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    salesTargetsApi.getSalesTargetDashboard()
      .then(setSummary)
      .catch((err) => showToast(getApiError(err)))
      .finally(() => setLoading(false));
  }, [showToast]);

  if (loading) {
    return (
      <div className="col-span-12 card p-5 text-sm text-zoho-muted text-center">Loading sales targets…</div>
    );
  }

  if (!summary) return null;

  return (
    <>
      <div className="col-span-12 sm:col-span-6 lg:col-span-3">
        <div className="zoho-widget h-full">
          <h3 className="zoho-widget-title">Monthly Pipeline</h3>
          <ProgressBar
            actual={summary.monthly_pipeline_actual}
            target={summary.monthly_pipeline_target}
            color="bg-accent-teal"
          />
        </div>
      </div>
      <div className="col-span-12 sm:col-span-6 lg:col-span-3">
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
          <h3 className="zoho-widget-title mb-0">BDE Pipeline Leaderboard</h3>
          <AppLink href="/reports" className="text-xs text-brand-600 hover:underline">View reports →</AppLink>
        </div>
        <div className="space-y-2">
          {(summary.bde_leaderboard || []).length === 0 ? (
            <p className="text-sm text-zoho-muted text-center py-4">No leaderboard data</p>
          ) : summary.bde_leaderboard.slice(0, 5).map((item, index) => (
            <div key={item.employee_id || item.id || index} className="flex items-center justify-between text-sm py-1.5">
              <span className="truncate">{item.employee_name || item.name}</span>
              <span className="font-medium text-brand-600 shrink-0">
                {formatTargetAmount(item.actual_pipeline || item.pipeline_actual)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-12 lg:col-span-6 zoho-widget">
        <div className="flex items-center justify-between mb-3">
          <h3 className="zoho-widget-title mb-0">Off Track Users</h3>
          <AppLink href="/settings" className="text-xs text-brand-600 hover:underline">Configure targets →</AppLink>
        </div>
        <div className="space-y-2">
          {(summary.off_track_users || []).length === 0 ? (
            <p className="text-sm text-emerald-600 text-center py-4">All users on track</p>
          ) : summary.off_track_users.slice(0, 5).map((item, index) => (
            <div key={item.employee_id || item.id || index} className="flex items-center justify-between text-sm py-1.5">
              <span className="truncate">{item.employee_name || item.name}</span>
              <span className="badge bg-red-50 text-red-700 shrink-0">{item.status || 'Off Track'}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
