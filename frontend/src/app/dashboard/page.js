'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import * as leadsApi from '../../lib/services/leads.js';
import * as contactsApi from '../../lib/services/contacts.js';
import * as accountsApi from '../../lib/services/accounts.js';
import * as dealsApi from '../../lib/services/deals.js';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { QUICK_CREATE } from '../../lib/constants.js';
import {
  CurrencyRupeeIcon, CheckCircleIcon, CalendarDaysIcon, UserGroupIcon,
} from '@heroicons/react/24/outline';

const COLORS = ['#6f5cf5', '#14c8b0', '#ff9f5a', '#ff5fa2', '#3aa0ff', '#ffc94d'];

function Widget({ title, children, className = '' }) {
  return (
    <div className={`zoho-widget ${className}`}>
      <h3 className="zoho-widget-title">{title}</h3>
      {children}
    </div>
  );
}

function KpiCard({ title, value, sub, subClass, icon: Icon, gradient }) {
  return (
    <div className="col-span-12 sm:col-span-6 lg:col-span-3 group">
      <div className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-soft hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 ${gradient}`}>
        <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10 group-hover:scale-125 transition-transform duration-500" />
        <div className="absolute -right-2 -bottom-6 w-16 h-16 rounded-full bg-white/10 group-hover:scale-125 transition-transform duration-500" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-2">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className={`text-xs mt-1 font-medium ${subClass || 'text-white/80'}`}>{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0">
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [homeView, setHomeView] = useState('Classic View');

  useEffect(() => {
    Promise.all([
      leadsApi.listLeads({ page: 1, page_size: 1 }),
      contactsApi.listContacts({ page: 1, page_size: 1 }),
      accountsApi.listAccounts({ page: 1, page_size: 1 }),
      dealsApi.listDeals({ page: 1, page_size: 100 }),
    ]).then(([leads, contacts, accounts, deals]) => {
      const openDeals = deals.data.filter(d => d.stage_value && !['closed_won', 'closed_lost'].includes(d.stage_value));
      const pipelineValue = openDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
      setStats({
        leads: { total: leads.total, this_month: 0 },
        contacts: contacts.total,
        accounts: accounts.total,
        deals: { open_deals: openDeals.length, total_deals: deals.total, open_value: pipelineValue, pipeline_value: pipelineValue },
        tasksDueToday: 0,
        tasksOverdue: 0,
        dealsClosingMonth: { count: 0, value: 0 },
        pipeline: [],
        leadsByStatus: [],
        recentActivities: [],
        topAccounts: [],
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fmt = (n) => n ? `₹${(n / 100000).toFixed(1)}L` : '₹0';

  return (
    <CRMLayout>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-zoho-text">
              Welcome back<span className="bg-brand-gradient bg-clip-text text-transparent">.</span>
            </h1>
            <p className="text-xs text-zoho-muted">Your personalized sales command center</p>
          </div>
          <select className="input w-40 text-xs py-1.5" value={homeView} onChange={e => setHomeView(e.target.value)}>
            <option>Classic View</option>
            <option>Manager View</option>
            <option>My View</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : stats ? (
          <div className="grid grid-cols-12 gap-4">
            {/* Row 1 - KPI cards with vibrant gradients */}
            <KpiCard
              title="My Open Deals"
              value={stats.deals.open_deals || stats.deals.total_deals}
              sub={fmt(stats.deals.open_value || stats.deals.pipeline_value)}
              icon={CurrencyRupeeIcon}
              gradient="bg-gradient-to-br from-brand-500 to-brand-700"
            />
            <KpiCard
              title="Tasks Due Today"
              value={stats.tasksDueToday}
              sub={stats.tasksOverdue > 0 ? `${stats.tasksOverdue} overdue` : 'All caught up'}
              subClass={stats.tasksOverdue > 0 ? 'text-yellow-100' : 'text-white/80'}
              icon={CheckCircleIcon}
              gradient="bg-gradient-to-br from-accent-pink to-brand-600"
            />
            <KpiCard
              title="Deals Closing This Month"
              value={stats.dealsClosingMonth?.count || 0}
              sub={fmt(stats.dealsClosingMonth?.value)}
              icon={CalendarDaysIcon}
              gradient="bg-gradient-to-br from-accent-orange to-accent-pink"
            />
            <KpiCard
              title="Total Leads"
              value={stats.leads.total}
              sub={`+${stats.leads.this_month} this month`}
              icon={UserGroupIcon}
              gradient="bg-gradient-to-br from-accent-teal to-brand-600"
            />

            {/* Pipeline by Stage */}
            <Widget title="Pipeline by Stage" className="col-span-12 lg:col-span-7">
              {stats.pipeline?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.pipeline} margin={{ left: -20 }}>
                    <XAxis dataKey="stage" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
                    <Tooltip formatter={(v) => [`₹${(v/100000).toFixed(1)}L`, 'Value']} contentStyle={{ borderRadius: 12, border: '1px solid #e7e5fb' }} cursor={{ fill: 'rgba(111,92,245,0.06)' }} />
                    <Bar dataKey="total" radius={[6,6,0,0]}>{stats.pipeline.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-zoho-muted text-center py-8">No pipeline data</p>}
            </Widget>

            {/* My Leads by Status */}
            <Widget title="My Leads by Status" className="col-span-12 lg:col-span-5">
              {stats.leadsByStatus?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart><Pie data={stats.leadsByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} label={({ status, count }) => `${status}: ${count}`}>
                    {stats.leadsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />)}
                  </Pie><Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5fb' }} /></PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-zoho-muted text-center py-8">No leads</p>}
            </Widget>

            {/* Recent Activities */}
            <Widget title="Recent Activities" className="col-span-12 lg:col-span-6">
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {stats.recentActivities?.map(act => (
                  <div key={act.id} className="flex gap-3 text-sm py-2 px-2 -mx-2 rounded-lg hover:bg-brand-50/60 transition-colors">
                    <span className="w-2 h-2 rounded-full bg-brand-gradient mt-1.5 shrink-0 ring-4 ring-brand-100" />
                    <div><p className="text-zoho-text font-medium">{act.subject}</p><p className="text-[11px] text-zoho-muted">{act.type}</p></div>
                  </div>
                ))}
              </div>
            </Widget>

            <Widget title="Top Accounts by Revenue" className="col-span-12 lg:col-span-6">
              <div className="space-y-1">
                {stats.topAccounts?.map((a, i) => (
                  <div key={a.name} className="flex items-center justify-between text-sm py-2 px-2 -mx-2 rounded-lg hover:bg-brand-50/60 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-brand-gradient text-white text-[11px] font-bold flex items-center justify-center shrink-0">{a.name?.[0]}</span>
                      <span className="truncate">{a.name}</span>
                    </div>
                    <span className="text-brand-600 font-semibold shrink-0">{fmt(a.revenue)}</span>
                  </div>
                ))}
              </div>
            </Widget>

            {/* Quick Create */}
            <Widget title="Quick Create" className="col-span-12">
              <div className="flex flex-wrap gap-2">
                {QUICK_CREATE.map(q => (
                  <Link key={q.label} href={q.href}
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium border border-zoho-border text-zoho-text hover:text-white hover:border-transparent hover:bg-brand-gradient hover:shadow-soft transition-all duration-200">
                    + {q.label}
                  </Link>
                ))}
              </div>
            </Widget>
          </div>
        ) : <p className="text-zoho-muted">Failed to load dashboard</p>}
      </div>
    </CRMLayout>
  );
}
