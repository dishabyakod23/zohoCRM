'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as tasksApi from '../../lib/services/tasks.js';
import * as callsApi from '../../lib/services/calls.js';
import * as meetingsApi from '../../lib/services/meetings.js';
import { TabPanelSkeleton } from './RecordDetailSkeleton.js';
import { tableLinkClass } from '../../lib/tableStyles.js';

function matchesEntity(item, entityType, entityId) {
  const id = String(entityId);
  if (item.related_type === entityType && String(item.related_id) === id) return true;
  if (entityType === 'contact' && String(item.contact_id) === id) return true;
  if (entityType === 'account' && String(item.account_id) === id) return true;
  return false;
}

function activityDate(item) {
  return item.due_date || item.start_time || item.from_datetime || item.created_at || '';
}

export default function RecordActivitiesTab({ entityType, recordId }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [calls, setCalls] = useState([]);
  const [meetings, setMeetings] = useState([]);

  useEffect(() => {
    if (!entityType || !recordId) return;
    setLoading(true);
    Promise.all([
      tasksApi.listTasks({ page: 1, page_size: 100 }),
      callsApi.listCalls({ page: 1, page_size: 100 }),
      meetingsApi.listMeetings({ page: 1, page_size: 100 }),
    ])
      .then(([t, c, m]) => {
        setTasks((t.data || []).filter((row) => matchesEntity(row, entityType, recordId)));
        setCalls((c.data || []).filter((row) => matchesEntity(row, entityType, recordId)));
        setMeetings((m.data || []).filter((row) => matchesEntity(row, entityType, recordId)));
      })
      .catch((err) => showToast(getApiError(err)))
      .finally(() => setLoading(false));
  }, [entityType, recordId, showToast]);

  const items = useMemo(() => {
    const rows = [
      ...tasks.map((t) => ({
        id: `task-${t.id}`,
        type: 'Task',
        label: t.title || t.subject,
        href: `/tasks/${t.id}`,
        when: activityDate(t),
        meta: t.status_label || t.status,
      })),
      ...calls.map((c) => ({
        id: `call-${c.id}`,
        type: 'Call',
        label: c.subject,
        href: `/calls/${c.id}`,
        when: activityDate(c),
        meta: c.call_type_label || c.call_type,
      })),
      ...meetings.map((m) => ({
        id: `meeting-${m.id}`,
        type: 'Meeting',
        label: m.title,
        href: `/meetings/${m.id}`,
        when: activityDate(m),
        meta: m.location || '',
      })),
    ];
    return rows.sort((a, b) => new Date(b.when) - new Date(a.when));
  }, [tasks, calls, meetings]);

  if (loading) return <TabPanelSkeleton rows={3} />;

  if (!items.length) {
    return (
      <div className="card p-8 text-center text-sm text-zoho-muted">
        No tasks, calls, or meetings linked to this record yet.
      </div>
    );
  }

  return (
    <div className="card divide-y divide-zoho-border">
      {items.map((item) => (
        <div key={item.id} className="px-5 py-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zoho-muted">{item.type}</p>
            <Link href={item.href} className={`text-sm font-medium ${tableLinkClass}`}>{item.label || '—'}</Link>
            {item.meta && <p className="text-xs text-zoho-muted mt-0.5">{item.meta}</p>}
          </div>
          <span className="text-xs text-zoho-muted shrink-0">
            {item.when ? new Date(item.when).toLocaleString() : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
