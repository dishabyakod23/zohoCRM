'use client';
import { useEffect, useState } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import { useAuth } from '../../hooks/useAuth.js';
import { canDownload } from '../../lib/constants.js';
import api from '../../lib/api.js';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#378ADD', '#639922', '#EF9F27', '#D85A30', '#1D9E75', '#E24B4A', '#7F77DD', '#888'];

export default function ReportsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('leads');
  const [data, setData] = useState({});
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    const params = { ...(dateRange.start && { start_date: dateRange.start }), ...(dateRange.end && { end_date: dateRange.end }) };
    Promise.all([
      api.get('/reports/leads-by-source', { params }),
      api.get('/reports/leads-by-status'),
      api.get('/reports/lead-conversion'),
      api.get('/reports/deals-by-stage'),
      api.get('/reports/deals-won-lost'),
      api.get('/reports/accounts-by-industry'),
      api.get('/reports/activity-summary'),
      api.get('/reports/campaign-roi'),
    ]).then(([source, status, conversion, stages, wonLost, industry, activity, campaigns]) => {
      setData({ source: source.data, status: status.data, conversion: conversion.data, stages: stages.data, wonLost: wonLost.data, industry: industry.data, activity: activity.data, campaigns: campaigns.data });
    });
  }, [dateRange]);

  const download = (type) => window.open(`/api/reports/export/${type}`, '_blank');

  const tabs = [
    { id: 'leads', label: 'Lead Reports' },
    { id: 'deals', label: 'Deal Reports' },
    { id: 'accounts', label: 'Account Reports' },
    { id: 'activity', label: 'Activity Reports' },
    { id: 'campaigns', label: 'Campaign Reports' },
  ];

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Reports</h1>
          <div className="flex gap-2 items-center">
            <input className="input w-36 text-xs" type="date" value={dateRange.start} onChange={e => setDateRange(d => ({ ...d, start: e.target.value }))} />
            <span className="text-gray-400">to</span>
            <input className="input w-36 text-xs" type="date" value={dateRange.end} onChange={e => setDateRange(d => ({ ...d, end: e.target.value }))} />
            {canDownload(user?.role) && (
              <button onClick={() => download('leads')} className="btn-secondary text-xs">Download CSV</button>
            )}
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-gray-100">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === t.id ? 'border-brand-500 text-brand-600 font-medium' : 'border-transparent text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'leads' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5"><h3 className="font-semibold mb-4">Leads by Source</h3>
              <ResponsiveContainer width="100%" height={220}><BarChart data={data.source || []}><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill="#378ADD" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer>
            </div>
            <div className="card p-5"><h3 className="font-semibold mb-4">Leads by Status</h3>
              <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data.status || []} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label>{(data.status || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
            </div>
            <div className="card p-5 col-span-full"><h3 className="font-semibold mb-2">Lead Conversion Rate</h3>
              <p className="text-3xl font-bold text-brand-600">{data.conversion?.rate || 0}%</p>
              <p className="text-sm text-gray-500">{data.conversion?.converted} of {data.conversion?.total} leads converted</p>
            </div>
          </div>
        )}

        {tab === 'deals' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5"><h3 className="font-semibold mb-4">Pipeline by Stage</h3>
              <ResponsiveContainer width="100%" height={220}><BarChart data={data.stages || []}><XAxis dataKey="label" tick={{ fontSize: 9 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill="#639922" /></BarChart></ResponsiveContainer>
            </div>
            <div className="card p-5"><h3 className="font-semibold mb-4">Won vs Lost</h3>
              <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data.wonLost || []} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label>{(data.wonLost || []).map((_, i) => <Cell key={i} fill={COLORS[i + 2]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
            </div>
          </div>
        )}

        {tab === 'accounts' && (
          <div className="card p-5"><h3 className="font-semibold mb-4">Accounts by Industry</h3>
            <ResponsiveContainer width="100%" height={280}><BarChart data={data.industry || []} layout="vertical"><XAxis type="number" /><YAxis dataKey="label" type="category" width={100} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="#EF9F27" /></BarChart></ResponsiveContainer>
          </div>
        )}

        {tab === 'activity' && data.activity && (
          <div className="grid grid-cols-3 gap-4">
            {[['Tasks Completed', data.activity.tasks_completed], ['Calls Logged', data.activity.calls_logged], ['Meetings Held', data.activity.meetings_held]].map(([l, v]) => (
              <div key={l} className="card p-5 text-center"><p className="text-xs text-gray-500">{l}</p><p className="text-3xl font-bold mt-2">{v}</p></div>
            ))}
          </div>
        )}

        {tab === 'campaigns' && (
          <div className="card overflow-x-auto">
            <table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">Campaign</th><th className="table-th">Expected Revenue</th><th className="table-th">Actual Cost</th><th className="table-th">Members</th></tr></thead>
              <tbody className="divide-y">{(data.campaigns || []).map(c => (
                <tr key={c.name}><td className="table-td">{c.name}</td><td className="table-td">₹{Number(c.expected_revenue || 0).toLocaleString()}</td><td className="table-td">₹{Number(c.actual_cost || 0).toLocaleString()}</td><td className="table-td">{c.members}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </CRMLayout>
  );
}
