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
  formatBounceTypeLabel,
  formatBounceSubtypeLabel,
  resolveBounceReasonText,
  bounceReasonHint,
} from '../../lib/sequenceHelpers.js';
import { tokenizeSearchQuery } from '../../lib/listSearchHelpers.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';

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
  sendingEmail = '',
}) {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);
  const pageSize = 25;
  const senderNorm = String(sendingEmail || '').trim().toLowerCase();

  const load = useCallback(async () => {
    if (!sequenceId || !eventType) return;
    const q = debouncedSearch.trim();
    const tokens = tokenizeSearchQuery(q);
    const isSearch = tokens.length > 0;
    // Keep prior rows visible while refining search — only block on first load.
    if (isSearch) setSearching(true);
    else setLoading(true);
    try {
      // Single request only (API page_size ≤ 100). Rely on server search + light client filter.
      const result = await sequencesApi.listSequenceEmailEvents(sequenceId, {
        event_type: eventType,
        page: isSearch ? 1 : page,
        page_size: isSearch ? 100 : pageSize,
        ...(q ? { search: q } : {}),
      });
      let data = result.data || [];
      // Hide obvious self-opens (sender opened their own mail) in the detail list.
      if (eventType === 'OPENED' && senderNorm) {
        data = data.filter((row) => {
          const email = String(row.member_email || row.email || row.to_email || '').trim().toLowerCase();
          return email && email !== senderNorm;
        });
      }
      if (tokens.length) {
        data = data.filter((row) => {
          const haystack = [
            row.member_name,
            row.member_email,
            row.email,
            row.to_email,
            row.first_name,
            row.last_name,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return tokens.every((token) => haystack.includes(token));
        });
        const start = (page - 1) * pageSize;
        setTotal(data.length);
        setRows(data.slice(start, start + pageSize));
      } else {
        setRows(data);
        setTotal(result.total ?? data.length);
      }
    } catch (err) {
      setRows([]);
      setTotal(0);
      showToast(getApiError(err));
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, [sequenceId, eventType, page, showToast, senderNorm, debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [eventType, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const label = EMAIL_EVENT_LABELS[eventType] || eventType;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showBounceReason = eventType === 'BOUNCED';

  return (
    <div className="rounded-xl border border-zoho-border overflow-hidden">
      <div className="px-4 py-3 border-b border-zoho-border bg-gray-50 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zoho-text">{label} emails</h3>
            {showBounceReason && (
              <p className="text-[11px] text-zoho-muted mt-1">
                Reason comes from Resend bounce webhooks (CRM API). Permanent / “not found” ≈ invalid email;
                Transient / MailboxFull ≈ temporary; Suppressed ≈ Resend blocked resend.
              </p>
            )}
          </div>
          <span className="text-xs text-zoho-muted shrink-0">
            {searching ? 'Searching…' : `${total} total`}
          </span>
        </div>
        <div className="relative max-w-md">
          <input
            type="search"
            className="w-full py-2 pl-9 pr-3 text-sm border border-zoho-border rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-brand-100 focus:border-brand-400"
            placeholder="Search by email, first name, or full name…"
            aria-label="Search prospects by email or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zoho-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zoho-muted py-8 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zoho-muted py-8 text-center">
          {debouncedSearch.trim()
            ? 'No matching prospects found.'
            : `No ${label.toLowerCase()} emails yet.`}
        </p>
      ) : (
        <div className={`overflow-x-auto ${searching ? 'opacity-60' : ''}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zoho-border">
                <th className="table-th text-left">Prospect</th>
                <th className="table-th text-left">Email</th>
                <th className="table-th text-left">Step</th>
                <th className="table-th text-left">Subject</th>
                {showBounceReason && <th className="table-th text-left">Reason</th>}
                <th className="table-th text-left">When</th>
                <th className="table-th text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const reasonText = showBounceReason ? resolveBounceReasonText(row) : null;
                const typeLabel = showBounceReason ? formatBounceTypeLabel(row.bounce_type) : null;
                const subtypeLabel = showBounceReason ? formatBounceSubtypeLabel(row.bounce_subtype) : null;
                const hint = showBounceReason ? bounceReasonHint(row) : null;
                return (
                  <tr key={row.id || `${row.member_email}-${row.occurred_at}`} className="border-b border-zoho-border last:border-0">
                    <td className="table-td">{row.member_name}</td>
                    <td className="table-td">{row.member_email}</td>
                    <td className="table-td">{row.step_order != null ? `Step ${row.step_order}` : '—'}</td>
                    <td className="table-td max-w-[220px] truncate" title={row.subject}>{row.subject}</td>
                    {showBounceReason && (
                      <td className="table-td max-w-[280px]" title={hint || reasonText || undefined}>
                        {reasonText || typeLabel || subtypeLabel ? (
                          <div className="space-y-1">
                            <p className="text-zoho-text leading-snug">{reasonText || '—'}</p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {typeLabel && <Badge label={typeLabel} />}
                              {subtypeLabel && (
                                <span className="text-[11px] text-zoho-muted">{subtypeLabel}</span>
                              )}
                            </div>
                            {hint && (
                              <p className="text-[11px] text-zoho-muted leading-snug">{hint}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-zoho-muted">—</span>
                        )}
                      </td>
                    )}
                    <td className="table-td text-xs whitespace-nowrap">
                      {row.occurred_at
                        ? formatDateTimeInTimezone(row.occurred_at, sequenceTimezone)
                        : '—'}
                    </td>
                    <td className="table-td">
                      <Badge label={EMAIL_EVENT_LABELS[row.event_type] || row.event_type || label} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zoho-border text-xs">
          <button
            type="button"
            className="btn-secondary-sm"
            disabled={page <= 1 || loading || searching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="text-zoho-muted">Page {page} of {totalPages}</span>
          <button
            type="button"
            className="btn-secondary-sm"
            disabled={page >= totalPages || loading || searching}
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
  sequence = null,
  sequenceTimezone = 'UTC',
  sendingEmail = '',
}) {
  const { showToast } = useToast();
  const cached = typeof window !== 'undefined'
    ? sequencesApi.readCachedSequenceStats(sequenceId)
    : null;
  const provisional = sequencesApi.provisionalStatsFromSequence(sequence);
  const [stats, setStats] = useState(() => cached || provisional || null);
  const [statsFresh, setStatsFresh] = useState(() => Boolean(cached && !cached._provisional));
  const [refreshing, setRefreshing] = useState(!cached);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const cachedNow = sequencesApi.readCachedSequenceStats(sequenceId);
    const provisionalNow = sequencesApi.provisionalStatsFromSequence(sequence);
    if (cachedNow) {
      setStats(cachedNow);
      setStatsFresh(true);
    } else if (provisionalNow) {
      setStats((prev) => prev || provisionalNow);
      setStatsFresh(false);
    }
    setRefreshing(true);

    // 1) Fast email-event totals (usually seconds, not ~40s like /stats).
    sequencesApi.getEmailEventCountMap(sequenceId)
      .then((counts) => {
        if (cancelled) return;
        setStats((prev) => ({
          ...(prev || provisionalNow || {}),
          ...counts,
          _provisional: prev?._provisional && !sequencesApi.readCachedSequenceStats(sequenceId),
        }));
      })
      .catch(() => {});

    // 2) Full /stats (slow on large sequences) — upgrade when ready; shared with prefetch.
    sequencesApi.prefetchSequenceStats(sequenceId)
      .then((data) => {
        if (cancelled || !data) return;
        setStats(data);
        setStatsFresh(true);
      })
      .catch((err) => {
        if (cancelled) return;
        // Keep provisional / cached UI; only toast if we have nothing useful.
        if (!cachedNow && !provisionalNow) showToast(getApiError(err));
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => { cancelled = true; };
  }, [sequenceId, sequence, showToast]);

  const toggleEvent = (eventType) => {
    setSelectedEvent((prev) => (prev === eventType ? null : eventType));
  };

  if (!stats) {
    return <p className="text-sm text-zoho-muted py-8 text-center">Loading analytics…</p>;
  }

  const funnel = stats.step_funnel || stats.steps || [];
  const showStaleHint = refreshing || stats._provisional || !statsFresh;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs text-zoho-muted max-w-3xl">
          Tracking funnel: Sent → Delivered → Opened → Clicked → Replied / Bounced. Click a card to list matching emails.
          Sequence mail is sent via Resend and will not appear in Outlook Sent Items — use this panel for send history.
          {sendingEmail ? (
            <> Opens from the sending address ({sendingEmail}) are hidden in the event list when detectable; totals still come from the API until self-opens are excluded server-side.</>
          ) : null}
          {' '}Replies are not reported by Resend webhooks — use “Mark replied” on enrollments when needed.
        </p>
        {showStaleHint && (
          <span className="text-[11px] text-brand-600 bg-brand-50 border border-brand-100 rounded-full px-2.5 py-1 shrink-0">
            {refreshing ? 'Updating live stats…' : 'Showing available counts'}
          </span>
        )}
      </div>
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
          sendingEmail={sendingEmail}
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
              {funnel.map((row, i) => (
                <tr key={row.step_id || `step-${i}`} className="border-b border-zoho-border">
                  <td className="table-td">Step {row.step_order ?? i + 1}</td>
                  <td className="table-td"><Badge label={stepTypeLabel(row.type)} /></td>
                  <td className="table-td text-right">{row.eligible ?? '—'}</td>
                  <td className="table-td text-right">{row.sent ?? 0}</td>
                  <td className="table-td text-right">{row.delivered ?? 0}</td>
                  <td className="table-td text-right">{row.opened ?? 0}</td>
                  <td className="table-td text-right">{row.clicked ?? 0}</td>
                  <td className="table-td text-right">{row.replied ?? 0}</td>
                  <td className="table-td text-right">{row.bounced ?? 0}</td>
                  <td className="table-td text-right">{row.pending ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!funnel.length && refreshing && (
        <p className="text-xs text-zoho-muted">Step performance loads with live stats…</p>
      )}
    </div>
  );
}
