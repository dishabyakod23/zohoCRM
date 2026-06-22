'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import { useToast } from '../../components/ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as dashboardApi from '../../lib/services/dashboard.js';
import * as leadsApi from '../../lib/services/leads.js';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { QUICK_CREATE } from '../../lib/constants.js';
import { userBriefName } from '../../lib/activityHelpers.js';
import { leadStatusLabel } from '../../lib/leadHelpers.js';
import {
  UserGroupIcon, BuildingOffice2Icon, DocumentTextIcon, ChartBarIcon,
} from '@heroicons/react/24/outline';

const COLORS = ['#6f5cf5', '#14c8b0', '#ff9f5a', '#ff5fa2', '#3aa0ff', '#ffc94d'];

const DASHBOARD_VIEWS = {
  'Classic View': { showLeadsChart: true, showRecent: true, showTopAccounts: true, showQuickCreate: true },
  'Manager View': { showLeadsChart: true, showRecent: true, showTopAccounts: true, showQuickCreate: false },
  'My View': { showLeadsChart: true, showRecent: true, showTopAccounts: false, showQuickCreate: true },
};

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
    <div className="col-span-12 sm:col-span-6 lg:col-span-3">
      <div className={`relative overflow-hidden rounded-xl p-5 text-white shadow-soft hover:shadow-card transition-shadow duration-200 ${gradient}`}>
        <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/8" />
        <div className="absolute -right-2 -bottom-6 w-16 h-16 rounded-full bg-white/8" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-white/70 uppercase tracking-wider mb-2">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className={`text-xs mt-1.5 ${subClass || 'text-white/70'}`}>{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [homeView, setHomeView] = useState('Classic View');

  useEffect(() => {
    Promise.all([
      dashboardApi.getDashboardHome(),
      leadsApi.countLeadsThisMonth().catch(() => 0),
    ]).then(([home, leadsThisMonth]) => {
      const leadsTotal = (home.leads_by_status || []).reduce((s, r) => s + r.count, 0);
      const qualifiedCount = (home.leads_by_status || []).find(r => /qualified/i.test(r.label || r.key || ''))?.count ?? 0;
      setStats({
        leads: { total: leadsTotal, this_month: leadsThisMonth, qualified: qualifiedCount },
        accounts: { total: (home.top_accounts || []).length },
        topAccountRevenue: (home.top_accounts || []).reduce((s, a) => s + (Number(a.annual_revenue) || 0), 0),
        leadsByStatus: (home.leads_by_status || []).map(r => ({
          status: leadStatusLabel(r.label),
          count: r.count,
        })),
        recentActivities: (home.recent_activities || []).map(a => ({
          id: a.id,
          subject: `${a.action?.replace(/_/g, ' ')} ${a.entity_type}`,
          type: `${userBriefName(a.user)} · ${new Date(a.created_at).toLocaleString()}`,
        })),
        topAccounts: (home.top_accounts || []).map(a => ({
          id: a.id,
          name: a.account_name,
          revenue: Number(a.annual_revenue) || 0,
        })),
      });
      setLoading(false);
    }).catch((err) => {
      showToast(getApiError(err));
      setLoading(false);
    });
  }, [showToast]);

  const fmt = (n) => n ? `₹${(n / 100000).toFixed(1)}L` : '₹0';
  const viewLayout = DASHBOARD_VIEWS[homeView] || DASHBOARD_VIEWS['Classic View'];

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-zoho-text">
              Welcome back<span className="text-brand-500">.</span>
            </h1>
            <p className="text-xs text-zoho-muted mt-0.5">Your sales command center</p>
          </div>
          <select className="input w-36 py-1.5 text-xs" value={homeView} onChange={e => setHomeView(e.target.value)}>
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
              title="Total Leads"
              value={stats.leads.total}
              sub={`+${stats.leads.this_month} this month`}
              icon={UserGroupIcon}
              gradient="bg-gradient-to-br from-accent-teal to-brand-600"
            />
            <KpiCard
              title="Qualified Leads"
              value={stats.leads.qualified}
              sub="In qualified stage"
              icon={ChartBarIcon}
              gradient="bg-gradient-to-br from-brand-500 to-brand-700"
            />
            <KpiCard
              title="Top Accounts"
              value={stats.accounts.total}
              sub={fmt(stats.topAccountRevenue)}
              icon={BuildingOffice2Icon}
              gradient="bg-gradient-to-br from-accent-orange to-accent-pink"
            />
            <Link href="/proposals" className="col-span-12 sm:col-span-6 lg:col-span-3 block">
              <KpiCard
                title="Proposals"
                value="Open"
                sub="Manage proposal pipeline"
                icon={DocumentTextIcon}
                gradient="bg-gradient-to-br from-accent-pink to-brand-600"
              />
            </Link>

            {viewLayout.showLeadsChart && (
            <Widget title="My Leads by Status" className="col-span-12 lg:col-span-6">
              {stats.leadsByStatus?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart><Pie data={stats.leadsByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} label={({ status, count }) => `${status}: ${count}`}>
                    {stats.leadsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />)}
                  </Pie><Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5fb' }} /></PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-zoho-muted text-center py-8">No leads</p>}
            </Widget>
            )}

            {/* Recent Activities */}
            {viewLayout.showRecent && (
            <Widget title="Recent Updates" className="col-span-12 lg:col-span-6">
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {stats.recentActivities?.map(act => (
                  <div key={act.id} className="flex gap-3 text-sm py-2 px-2 -mx-2 rounded-lg hover:bg-brand-50/60 transition-colors">
                    <span className="w-2 h-2 rounded-full bg-brand-gradient mt-1.5 shrink-0 ring-4 ring-brand-100" />
                    <div><p className="text-zoho-text font-medium">{act.subject}</p><p className="text-[11px] text-zoho-muted">{act.type}</p></div>
                  </div>
                ))}
              </div>
            </Widget>
            )}

            {viewLayout.showTopAccounts && (
            <Widget title="Top Accounts by Revenue" className="col-span-12 lg:col-span-6">
              <div className="space-y-1">
                {stats.topAccounts?.map((a) => (
                  <div key={a.id || a.name} className="flex items-center justify-between text-sm py-2 px-2 -mx-2 rounded-lg hover:bg-brand-50/60 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-brand-gradient text-white text-[11px] font-bold flex items-center justify-center shrink-0">{a.name?.[0]}</span>
                      <span className="truncate">{a.name}</span>
                    </div>
                    <span className="text-brand-600 font-semibold shrink-0">{fmt(a.revenue)}</span>
                  </div>
                ))}
              </div>
            </Widget>
            )}

            {/* Quick Create */}
            {viewLayout.showQuickCreate && (
            <Widget title="Quick Create" className="col-span-12">
              <div className="flex flex-wrap gap-2">
                {QUICK_CREATE.map(q => (
                  <Link key={q.label} href={q.href} className="btn-secondary-sm">
                    + {q.label}
                  </Link>
                ))}
              </div>
            </Widget>
            )}
          </div>
        ) : <p className="text-zoho-muted">Failed to load dashboard</p>}
      </div>
    </CRMLayout>
  );
}
