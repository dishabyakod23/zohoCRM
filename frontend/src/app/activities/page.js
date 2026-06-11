'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Badge from '../../components/ui/Badge.js';
import api from '../../lib/api.js';

/** Zoho-style unified Activities hub: Tasks, Meetings (Events), Calls */
export default function ActivitiesPage() {
  const [tab, setTab] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/tasks', { params: { limit: 20 } }),
      api.get('/meetings', { params: { limit: 20 } }),
      api.get('/calls', { params: { limit: 20 } }),
    ]).then(([t, m, c]) => {
      setTasks(t.data.data);
      setMeetings(m.data.data);
      setCalls(c.data.data);
    });
  }, []);

  const tabs = [
    { id: 'tasks', label: 'Tasks', count: tasks.length, href: '/tasks' },
    { id: 'meetings', label: 'Meetings', count: meetings.length, href: '/meetings' },
    { id: 'calls', label: 'Calls', count: calls.length, href: '/calls' },
  ];

  return (
    <CRMLayout>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-zoho-text">Activities</h1>
          <Link href={`/${tab}`} className="btn-primary text-xs">+ Create {tab === 'tasks' ? 'Task' : tab === 'meetings' ? 'Meeting' : 'Call'}</Link>
        </div>

        <div className="flex border-b border-zoho-border bg-white rounded-t px-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`zoho-view-tab ${tab === t.id ? 'zoho-view-tab-active' : 'zoho-view-tab-inactive'}`}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <div className="card rounded-t-none overflow-x-auto">
          {tab === 'tasks' && (
            <table className="w-full">
              <thead><tr><th className="table-th">Subject</th><th className="table-th">Due Date</th><th className="table-th">Status</th><th className="table-th">Priority</th><th className="table-th">Assigned To</th></tr></thead>
              <tbody>{tasks.map(t => (
                <tr key={t.id} className="hover:bg-brand-50/30">
                  <td className="table-td font-medium"><Link href="/tasks" className="text-brand-600 hover:underline">{t.title}</Link></td>
                  <td className={`table-td ${new Date(t.due_date) < new Date() && t.status !== 'Completed' ? 'text-red-600' : ''}`}>{new Date(t.due_date).toLocaleString()}</td>
                  <td className="table-td"><Badge label={t.status} /></td>
                  <td className="table-td">{t.priority}</td>
                  <td className="table-td">{t.assigned_name}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {tab === 'meetings' && (
            <table className="w-full">
              <thead><tr><th className="table-th">Title</th><th className="table-th">From</th><th className="table-th">To</th><th className="table-th">Host</th><th className="table-th">Location</th></tr></thead>
              <tbody>{meetings.map(m => (
                <tr key={m.id} className="hover:bg-brand-50/30">
                  <td className="table-td font-medium"><Link href="/meetings" className="text-brand-600">{m.title}</Link></td>
                  <td className="table-td">{new Date(m.from_datetime).toLocaleString()}</td>
                  <td className="table-td">{new Date(m.to_datetime).toLocaleString()}</td>
                  <td className="table-td">{m.host_name}</td>
                  <td className="table-td">{m.location || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {tab === 'calls' && (
            <table className="w-full">
              <thead><tr><th className="table-th">Subject</th><th className="table-th">Type</th><th className="table-th">Date</th><th className="table-th">Assigned To</th></tr></thead>
              <tbody>{calls.map(c => (
                <tr key={c.id} className="hover:bg-brand-50/30">
                  <td className="table-td font-medium"><Link href="/calls" className="text-brand-600">{c.subject}</Link></td>
                  <td className="table-td">{c.call_type}</td>
                  <td className="table-td">{new Date(c.start_time).toLocaleString()}</td>
                  <td className="table-td">{c.assigned_name}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </CRMLayout>
  );
}
