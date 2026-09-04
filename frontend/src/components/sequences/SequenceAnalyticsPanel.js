'use client';
import { useCallback, useEffect, useState } from 'react';
import Badge from '../ui/Badge.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as sequencesApi from '../../lib/services/sequences.js';
import {
  stepTypeLabel,
  EMAIL_EVENT_LABELS,
  formatDateTimeInTimezone,
} from '../../lib/sequenceHelpers.js';

const EMAIL_STAT_KEYS = [
  { key: 'SENT', label: 'Sent', valueKeys: ['sent', 'emails_sent', 'sent_count'] },
  { key: 'DELIVERED', label: 'Delivered', valueKeys: ['delivered', 'delivered_count'] },
  { key: 'OPENED', label: 'Opened', valueKeys: ['opened', 'open_count', 'opens'] },
  { key: 'CLICKED', label: 'Clicked', valueKeys: ['clicked', 'click_count', 'clicks'] },
  { key: 'REPLIED', label: 'Replied', valueKeys: ['replied', 'reply_count'] },
  { key: 'BOUNCED', label: 'Bounced', valueKeys: ['bounced', 'bounce_count', 'bounces'] },
  { key: 'UNSUBSCRIBED', label: 'Unsubscribed', valueKeys: ['unsubscribed', 'unsubscribe_count'] },
];

function pickStat(stats, keys) {
  for (const key of keys) {
    if (stats?.[key] != null) return stats[key];
  }
  return undefined;
}

function StatCard({ label, value, sub, selected = false, onClick }) {
  const clickable = typeof onClick === 'function';
  const className = [
    'rounded-xl border bg-white p-4 text-left w-full transition-colors',
    selected ? 'border-brand-600 ring-2 ring-brand-200' : 'border-zoho-border',
    clickable ? 'hover:border-brand-400 cursor-pointer' : '',
  ].filter(Boolean).join(' ');

  const body = (
    <>
      <p className="text-xs text-zoho-muted">{label}</p>
      <p className="text-2xl font-semibold text-zoho-text mt-1">{value ?? '—'}</p>
      {sub && <p className="text-xs text-zoho-muted mt-1">{sub}</p>}
      {clickable && (
        <p className="text-[11px] text-brand-600 mt-2">
          {selected ? 'Hide list' : 'View list'}
        </p>
      )}
    </>
  );

  if (!clickable) {
    return <div className={className}>{body}</div>;
  }

  return (
    <button type="button" className={className} onClick={onClick} aria-pressed={selected}>
      {body}
    </button>
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

function EmailActivityList({
  sequenceId,
  eventType,
  sequenceTimezone = 'UTC',
}) {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  const load = useCallback(async () => {
    if (!sequenceId || !eventType) return;
    setLoading(true);
    try {
      const result = await sequencesApi.listSequenceEmailEvents(sequenceId, {
        event_type: eventType,
        page,
        page_size: pageSize,
      });
      setRows(result.data || []);
      setTotal(result.total ?? 0);
    } catch (err) {
      setRows([]);
      setTotal(0);
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [sequenceId, eventType, page, showToast]);

  useEffect(() => {
    setPage(1);
  }, [eventType]);

  useEffect(() => {
    load();
  }, [load]);

  const label = EMAIL_EVENT_LABELS[eventType] || eventType;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="rounded-xl border border-zoho-border overflow-hidden">
      <div className="px-4 py-3 border-b border-zoho-border bg-gray-50 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zoho-text">{label} emails</h3>
        <span className="text-xs text-zoho-muted">{total} total</span>
      </div>

      {loading ? (
        <p className="text-sm text-zoho-muted py-8 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zoho-muted py-8 text-center">No {label.toLowerCase()} emails yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zoho-border">
                <th className="table-th text-left">Prospect</th>
                <th className="table-th text-left">Email</th>
                <th className="table-th text-left">Step</th>
                <th className="table-th text-left">Subject</th>
                <th className="table-th text-left">When</th>
                <th className="table-th text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id || `${row.member_email}-${row.occurred_at}`} className="border-b border-zoho-border last:border-0">
                  <td className="table-td">{row.member_name}</td>
                  <td className="table-td">{row.member_email}</td>
                  <td className="table-td">{row.step_order != null ? `Step ${row.step_order}` : '—'}</td>
                  <td className="table-td max-w-[220px] truncate" title={row.subject}>{row.subject}</td>
                  <td className="table-td text-xs whitespace-nowrap">
                    {row.occurred_at
                      ? formatDateTimeInTimezone(row.occurred_at, sequenceTimezone)
                      : '—'}
                  </td>
                  <td className="table-td">
                    <Badge label={EMAIL_EVENT_LABELS[row.event_type] || row.event_type || label} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zoho-border text-xs">
          <button
            type="button"
            className="btn-secondary-sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="text-zoho-muted">Page {page} of {totalPages}</span>
          <button
            type="button"
            className="btn-secondary-sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function SequenceAnalyticsPanel({
  sequenceId,
  steps = [],
  sequenceTimezone = 'UTC',
}) {
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [stepStats, setStepStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

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

  const toggleEvent = (eventType) => {
    setSelectedEvent((prev) => (prev === eventType ? null : eventType));
  };

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
        {EMAIL_STAT_KEYS.map((stat) => (
          <StatCard
            key={stat.key}
            label={stat.label}
            value={pickStat(stats, stat.valueKeys)}
            sub={stat.key === 'REPLIED' && stats.reply_rate != null ? `${stats.reply_rate}% reply rate` : undefined}
            selected={selectedEvent === stat.key}
            onClick={() => toggleEvent(stat.key)}
          />
        ))}
      </div>

      {selectedEvent && (
        <EmailActivityList
          sequenceId={sequenceId}
          eventType={selectedEvent}
          sequenceTimezone={sequenceTimezone}
        />
      )}

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
