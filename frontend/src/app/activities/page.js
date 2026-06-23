'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import Badge from '../../components/ui/Badge.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import { useToast } from '../../components/ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as tasksApi from '../../lib/services/tasks.js';
import * as meetingsApi from '../../lib/services/meetings.js';
import * as callsApi from '../../lib/services/calls.js';
import { tableLinkClass } from '../../lib/tableStyles.js';

export default function ActivitiesPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const [t, m, c] = await Promise.all([
        tasksApi.listTasks({ page: 1, page_size: 50 }),
        meetingsApi.listMeetings({ page: 1, page_size: 50 }),
        callsApi.listCalls({ page: 1, page_size: 50 }),
      ]);
      setTasks(t.data);
      setMeetings(m.data);
      setCalls(c.data);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const taskColumns = useMemo(() => [
    { id: 'subject', header: 'Subject', cell: (t) => <Link href={`/tasks/${t.id}`} className={tableLinkClass}>{t.title}</Link> },
    { id: 'due', header: 'Due Date', cell: (t) => <span className={new Date(t.due_date) < new Date() && t.status !== 'completed' ? 'text-red-600' : ''}>{new Date(t.due_date).toLocaleString()}</span> },
    { id: 'status', header: 'Status', cell: (t) => <Badge label={t.status_label} /> },
    { id: 'priority', header: 'Priority', cell: (t) => t.priority_label },
    { id: 'assigned', header: 'Assigned To', cell: (t) => t.assigned_name },
  ], []);

  const meetingColumns = useMemo(() => [
    { id: 'title', header: 'Title', cell: (m) => <Link href={`/meetings/${m.id}`} className={tableLinkClass}>{m.title}</Link> },
    { id: 'from', header: 'From', cell: (m) => new Date(m.from_datetime).toLocaleString() },
    { id: 'to', header: 'To', cell: (m) => new Date(m.to_datetime).toLocaleString() },
    { id: 'host', header: 'Host', cell: (m) => m.host_name },
    { id: 'location', header: 'Location', cell: (m) => m.location || '—' },
  ], []);

  const callColumns = useMemo(() => [
    { id: 'subject', header: 'Subject', cell: (c) => <Link href={`/calls/${c.id}`} className={tableLinkClass}>{c.subject}</Link> },
    { id: 'type', header: 'Type', cell: (c) => c.call_type_label },
    { id: 'date', header: 'Date', cell: (c) => new Date(c.start_time).toLocaleString() },
    { id: 'assigned', header: 'Assigned To', cell: (c) => c.assigned_name },
  ], []);

  const tabs = [
    { id: 'tasks', label: 'Tasks', count: tasks.length, href: '/tasks' },
    { id: 'meetings', label: 'Meetings', count: meetings.length, href: '/meetings' },
    { id: 'calls', label: 'Calls', count: calls.length, href: '/calls' },
  ];

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Activities"
          subtitle="Recent tasks, meetings, and calls."
          primaryAction={(
            <Link href={`/${tab}?create=1`} className="btn-primary-sm">
              Create {tab === 'tasks' ? 'Task' : tab === 'meetings' ? 'Meeting' : 'Call'}
            </Link>
          )}
        />

        <div className="flex border-b border-zoho-border bg-white rounded-t px-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`zoho-view-tab ${tab === t.id ? 'zoho-view-tab-active' : 'zoho-view-tab-inactive'}`}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <div className="card rounded-t-none">
          <div className="flex justify-end px-4 py-2 border-b border-zoho-border">
            <Link href={tabs.find((t) => t.id === tab)?.href || '/tasks'} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
              View all {tab} →
            </Link>
          </div>
          {tab === 'tasks' && (
            <RecordDataTable
              moduleKey="tasks"
              records={tasks}
              loading={loading}
              columns={taskColumns}
              onRefresh={fetchActivities}
              emptyMessage="No tasks found"
            />
          )}
          {tab === 'meetings' && (
            <RecordDataTable
              moduleKey="meetings"
              records={meetings}
              loading={loading}
              columns={meetingColumns}
              onRefresh={fetchActivities}
              emptyMessage="No meetings found"
            />
          )}
          {tab === 'calls' && (
            <RecordDataTable
              moduleKey="calls"
              records={calls}
              loading={loading}
              columns={callColumns}
              onRefresh={fetchActivities}
              emptyMessage="No calls found"
            />
          )}
        </div>
      </div>
    </CRMLayout>
  );
}
