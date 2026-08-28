'use client';
import { useEffect, useState } from 'react';
import Badge from '../ui/Badge.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as sequencesApi from '../../lib/services/sequences.js';
import { stepTypeLabel, EMAIL_EVENT_LABELS } from '../../lib/sequenceHelpers.js';

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-zoho-border bg-white p-4">
      <p className="text-xs text-zoho-muted">{label}</p>
      <p className="text-2xl font-semibold text-zoho-text mt-1">{value ?? '—'}</p>
      {sub && <p className="text-xs text-zoho-muted mt-1">{sub}</p>}
    </div>
  );
}

function AbVariantTable({ rows }) {
  if (!rows?.length) return null;
  const keys = ['sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced'];
  return (
    <div className="rounded-xl border border-zoho-border overflow-hidden">
      <div className="px-4 py-3 border-b border-zoho-border bg-gray-50">
        <h3 className="text-sm font-semibold text-zoho-text">A/B Performance</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zoho-border">
            <th className="table-th text-left">Metric</th>
            {rows.map((v) => (
              <th key={v.variant_key} className="table-th text-right">Variant {v.variant_key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key} className="border-b border-zoho-border last:border-0">
              <td className="table-td capitalize">{EMAIL_EVENT_LABELS[key.toUpperCase()] || key}</td>
              {rows.map((v) => (
                <td key={v.variant_key} className="table-td text-right">{v[key] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SequenceAnalyticsPanel({ sequenceId, steps = [] }) {
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [stepStats, setStepStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    sequencesApi.getSequenceStats(sequenceId)
      .then((data) => { if (!cancelled) setStats(data); })
      .catch((err) => { if (!cancelled) showToast(getApiError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sequenceId, showToast]);

  useEffect(() => {
    if (!steps.length) return;
    let cancelled = false;
    Promise.all(
      steps.filter((s) => s.id).map(async (step) => {
        try {
          const data = await sequencesApi.getStepStats(sequenceId, step.id);
          return [step.id, data];
        } catch {
          return [step.id, null];
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setStepStats(Object.fromEntries(pairs.filter(([, v]) => v)));
    });
    return () => { cancelled = true; };
  }, [sequenceId, steps]);

  if (loading) return <p className="text-sm text-zoho-muted py-8 text-center">Loading analytics…</p>;
  if (!stats) return <p className="text-sm text-zoho-muted py-8 text-center">No analytics available yet.</p>;

  const funnel = stats.step_funnel || stats.steps || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Enrolled" value={stats.enrolled ?? stats.enrollment_count ?? stats.total} />
        <StatCard label="Eligible" value={stats.eligible ?? stats.active ?? stats.active_enrollment_count} />
        <StatCard label="Pending" value={stats.pending ?? stats.pending_count} />
        <StatCard label="Completed" value={stats.completed ?? stats.completed_count} />
        <StatCard label="Sent" value={stats.sent ?? stats.emails_sent ?? stats.sent_count} />
        <StatCard label="Delivered" value={stats.delivered ?? stats.delivered_count} />
        <StatCard label="Opened" value={stats.opened ?? stats.open_count ?? stats.opens} />
        <StatCard label="Clicked" value={stats.clicked ?? stats.click_count ?? stats.clicks} />
        <StatCard label="Replied" value={stats.replied ?? stats.reply_count} sub={stats.reply_rate != null ? `${stats.reply_rate}% reply rate` : undefined} />
        <StatCard label="Bounced" value={stats.bounced ?? stats.bounce_count ?? stats.bounces} />
        <StatCard label="Unsubscribed" value={stats.unsubscribed ?? stats.unsubscribe_count} />
      </div>

      {stats.ab_variants?.length > 0 && <AbVariantTable rows={stats.ab_variants} />}

      {funnel.length > 0 && (
        <div className="rounded-xl border border-zoho-border overflow-hidden">
          <div className="px-4 py-3 border-b border-zoho-border bg-gray-50">
            <h3 className="text-sm font-semibold text-zoho-text">Step Performance</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zoho-border">
                <th className="table-th text-left">Step</th>
                <th className="table-th text-left">Type</th>
                <th className="table-th text-right">Eligible</th>
                <th className="table-th text-right">Sent</th>
                <th className="table-th text-right">Delivered</th>
                <th className="table-th text-right">Opened</th>
                <th className="table-th text-right">Clicked</th>
                <th className="table-th text-right">Replied</th>
                <th className="table-th text-right">Bounced</th>
                <th className="table-th text-right">Pending</th>
              </tr>
            </thead>
            <tbody>
              {funnel.map((row, i) => {
                const detail = stepStats[row.step_id] || row;
                const ab = detail.ab_variants;
                return (
                  <tr key={row.step_id || `step-${i}`} className="border-b border-zoho-border">
                    <td className="table-td">Step {row.step_order ?? i + 1}</td>
                    <td className="table-td"><Badge label={stepTypeLabel(row.type)} /></td>
                    <td className="table-td text-right">{detail.eligible ?? row.eligible ?? '—'}</td>
                    <td className="table-td text-right">{detail.sent ?? row.sent ?? 0}</td>
                    <td className="table-td text-right">{detail.delivered ?? row.delivered ?? 0}</td>
                    <td className="table-td text-right">{detail.opened ?? row.opened ?? 0}</td>
                    <td className="table-td text-right">{detail.clicked ?? row.clicked ?? 0}</td>
                    <td className="table-td text-right">{detail.replied ?? row.replied ?? 0}</td>
                    <td className="table-td text-right">{detail.bounced ?? row.bounced ?? 0}</td>
                    <td className="table-td text-right">{detail.pending ?? row.pending ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
