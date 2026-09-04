'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../ui/Toast.js';
import { OwnerFilter } from '../layout/ListFilterFields.js';
import { getApiError } from '../../lib/api.js';
import { defaultOwnerFilterId } from '../../lib/listRecordFilters.js';
import { canAssignRecords } from '../../lib/roles.js';
import { fetchUsers } from '../../lib/services/lookups.js';
import * as reportsApi from '../../lib/services/reports.js';
import { buildOutreachActivityIndex } from '../../lib/outreachActivity.js';

function toDateInput(d) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfDay(d) {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
}

function countOutreachInRange(index, { from, to, ownerId, type }) {
  let count = 0;
  const fromMs = from ? new Date(from).setHours(0, 0, 0, 0) : null;
  const toMs = to ? new Date(to).setHours(23, 59, 59, 999) : null;
  for (const events of Object.values(index || {})) {
    for (const event of events || []) {
      if (type && event.type !== type) continue;
      if (ownerId && String(event.user_id || '') !== String(ownerId)) continue;
      const at = new Date(event.at).getTime();
      if (Number.isNaN(at)) continue;
      if (fromMs != null && at < fromMs) continue;
      if (toMs != null && at > toMs) continue;
      count += 1;
    }
  }
  return count;
}

const METRICS = [
  { key: 'linkedin', label: 'LinkedIn connections sent' },
  { key: 'emails', label: 'Emails sent' },
  { key: 'calls', label: 'Calls' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'followups', label: 'Follow-ups' },
];

export default function DailySalesActivityPanel() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canPickOwner = canAssignRecords(user?.role);
  const [users, setUsers] = useState([]);
  const [preset, setPreset] = useState('today');
  const [ownerId, setOwnerId] = useState(() => defaultOwnerFilterId(user) || user?.id || '');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});

  const range = useMemo(() => {
    const now = new Date();
    if (preset === 'week') {
      return { start: toDateInput(startOfWeek(now)), end: toDateInput(endOfDay(now)) };
    }
    if (preset === 'month') {
      return { start: toDateInput(startOfMonth(now)), end: toDateInput(endOfDay(now)) };
    }
    return { start: toDateInput(now), end: toDateInput(now) };
  }, [preset]);

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    if (user?.id && !ownerId && !canPickOwner) {
      setOwnerId(defaultOwnerFilterId(user) || user.id);
    }
  }, [user, ownerId, canPickOwner]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const report = await reportsApi.getActivityReport({
        date_from: range.start,
        date_to: range.end,
        owner_id: ownerId || undefined,
      });
      const outreach = buildOutreachActivityIndex();
      const linkedin = countOutreachInRange(outreach, {
        from: range.start,
        to: range.end,
        ownerId: ownerId || undefined,
        type: 'linkedin',
      });
      const emailsLocal = countOutreachInRange(outreach, {
        from: range.start,
        to: range.end,
        ownerId: ownerId || undefined,
        type: 'email',
      });
      setStats({
        linkedin: report.linkedin_sent ?? report.linkedin ?? linkedin,
        emails: report.emails_sent ?? report.emails ?? emailsLocal,
        calls: report.calls_logged ?? report.calls ?? 0,
        meetings: report.meetings_held ?? report.meetings ?? 0,
        followups: report.followups ?? report.follow_ups ?? report.tasks_completed ?? 0,
      });
    } catch (err) {
      // Fall back to local LinkedIn/email counts when API fails or is thin.
      const outreach = buildOutreachActivityIndex();
      setStats({
        linkedin: countOutreachInRange(outreach, {
          from: range.start, to: range.end, ownerId: ownerId || undefined, type: 'linkedin',
        }),
        emails: countOutreachInRange(outreach, {
          from: range.start, to: range.end, ownerId: ownerId || undefined, type: 'email',
        }),
        calls: 0,
        meetings: 0,
        followups: 0,
      });
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end, ownerId, showToast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1 rounded-lg border border-zoho-border p-1 bg-white">
          {[
            ['today', 'Today'],
            ['week', 'This Week'],
            ['month', 'This Month'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPreset(id)}
              className={`px-3 py-1.5 text-xs rounded-md ${preset === id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-zoho-muted hover:text-zoho-text'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="w-56">
          {canPickOwner ? (
            <OwnerFilter users={users} value={ownerId} onChange={setOwnerId} label="Salesperson" />
          ) : (
            <p className="text-xs text-zoho-muted pt-5">Showing your activity</p>
          )}
        </div>
        <p className="text-xs text-zoho-muted pb-2">{range.start} → {range.end}</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading activity…</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {METRICS.map((m) => (
            <div key={m.key} className="card p-5 text-center">
              <p className="text-xs text-gray-500">{m.label}</p>
              <p className="text-3xl font-bold mt-2">{stats[m.key] ?? 0}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-zoho-muted">
        LinkedIn counts include browser-marked “connection sent” activity for this salesperson.
        Calls/meetings/emails prefer the activity report API when available.
      </p>
    </div>
  );
}
