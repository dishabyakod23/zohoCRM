'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import { useToast } from '../../components/ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as dashboardApi from '../../lib/services/dashboard.js';
import * as leadsApi from '../../lib/services/leads.js';
import * as accountsApi from '../../lib/services/accounts.js';
import * as auditLogsApi from '../../lib/services/auditLogs.js';
import { buildAccountKindContext, isConfirmedAccount } from '../../lib/companyHelpers.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { QUICK_CREATE, DEFAULT_PAGE_SIZE } from '../../lib/constants.js';
import { pluralizeLeadStatusLabel } from '../../lib/leadHelpers.js';
import { formatCompactMoney, formatIndianRupees, DEFAULT_CURRENCY } from '../../lib/currencies.js';
import { avatarInitialClass } from '../../lib/tableStyles.js';
import {
  UserGroupIcon, BuildingOffice2Icon, DocumentTextIcon, ChartBarIcon,
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

function formatProposalKpi({ dealSize = 0, total = 0 } = {}) {
  return `${formatIndianRupees(dealSize)}(${total})`;
}

export default function DashboardPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { role } = usePermissions();
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    Promise.all([
      dashboardApi.getDashboardHome(),
      leadsApi.summarizePipelineDashboard().catch(() => ({
        leadsByPipeline: [],
        totalLeads: 0,
        qualifiedCount: 0,
        leadsThisMonth: 0,
        proposals: { total: 0, dealSize: 0 },
      })),
      buildAccountKindContext().catch(() => ({ dealAccountIds: new Set() })),
      auditLogsApi.listRecentActivityLogs(30, {
        user,
        canSeeAll: role === 'super_admin' || role === 'sales_manager',
        limit: DEFAULT_PAGE_SIZE,
        enrichPhones: false,
        cloudTalkLimit: 50,
      }).catch(() => []),
    ]).then(async ([home, pipelineSummary, accountKindContext, logs]) => {
      const accountsTotal = await accountsApi.countAccounts({
        recordKind: 'account',
        context: accountKindContext,
      }).catch(() => 0);
      const topAccountsRaw = (home.top_accounts || [])
        .filter((account) => isConfirmedAccount(account, accountKindContext));
      setAuditLogs(logs);
      setStats({
        leads: {
          total: pipelineSummary.totalLeads,
          this_month: pipelineSummary.leadsThisMonth ?? 0,
          qualified: pipelineSummary.qualifiedCount,
        },
        accounts: { total: accountsTotal },
        proposals: pipelineSummary.proposals,
        topAccounts: topAccountsRaw.map((a) => ({
          id: a.id,
          name: a.account_name || a.name,
          revenue: Number(a.annual_revenue ?? a.revenue) || 0,
          currency: a.currency || DEFAULT_CURRENCY,
        })),
        leadsByStatus: pipelineSummary.leadsByPipeline,
      });
      setLoading(false);
    }).catch((err) => {
      showToast(getApiError(err));
      setLoading(false);
    });
  }, [showToast, user?.id, role]);

  const fmt = (amount, currency) => formatCompactMoney(amount, currency);

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-zoho-text">
            Welcome back<span className="text-brand-500">.</span>
          </h1>
          <p className="text-xs text-zoho-muted mt-0.5">Your sales command center</p>
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
            <Link href="/qualified-leads" className="col-span-12 sm:col-span-6 lg:col-span-3 block">
              <KpiCard
                title="Qualified Leads"
                value={stats.leads.qualified}
                sub="In qualified stage"
                icon={ChartBarIcon}
                gradient="bg-gradient-to-br from-accent-yellow to-brand-600"
              />
            </Link>
            <Link href="/accounts" className="col-span-12 sm:col-span-6 lg:col-span-3 block">
              <KpiCard
                title="Accounts"
                value={stats.accounts.total}
                sub="Confirmed customers"
                icon={BuildingOffice2Icon}
                gradient="bg-gradient-to-br from-accent-orange to-accent-pink"
              />
            </Link>
            <Link href="/proposals" className="col-span-12 sm:col-span-6 lg:col-span-3 block">
              <KpiCard
                title="Proposals"
                value={formatProposalKpi(stats.proposals)}
                sub="In proposal pipeline"
                icon={DocumentTextIcon}
                gradient="bg-gradient-to-br from-accent-pink to-brand-600"
              />
            </Link>

            <Widget title="Leads by Pipeline" className="col-span-12 lg:col-span-6">
              {stats.leadsByStatus?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart><Pie data={stats.leadsByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} label={({ status, count }) => `${pluralizeLeadStatusLabel(status, count)}: ${count}`}>
                    {stats.leadsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />)}
                  </Pie><Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5fb' }} formatter={(value, _name, item) => [value, `${pluralizeLeadStatusLabel(item.payload.status, item.payload.count)}: ${item.payload.count}`]} /></PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-zoho-muted text-center py-8">No leads</p>}
            </Widget>

            <Widget title="Audit Logs" className="col-span-12 lg:col-span-6">
              <div className="flex justify-end -mt-1 mb-2">
                <button
                  type="button"
                  onClick={() => window.open('/audit-logs/', '_blank', 'noopener,noreferrer')}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
                >
                  View all (30 days) →
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {auditLogs.length > 0 ? auditLogs.map((log) => (
                  <div key={log.id} className="flex gap-3 text-sm py-2 px-2 -mx-2 rounded-lg hover:bg-brand-50/60 transition-colors">
                    <span className="w-2 h-2 rounded-full bg-brand-gradient mt-1.5 shrink-0 ring-4 ring-brand-100" />
                    <div>
                      <p className="text-zoho-text font-medium">{log.summary}</p>
                      <p className="text-[11px] text-zoho-muted">
                        {log.user_name || 'System'} · {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                      </p>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-zoho-muted text-center py-8">No audit logs found</p>
                )}
              </div>
            </Widget>

            <Widget title="Top Accounts by Revenue" className="col-span-12 lg:col-span-6">
              <div className="flex justify-end -mt-1 mb-2">
                <Link href="/accounts" className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline">
                  View accounts →
                </Link>
              </div>
              <div className="space-y-1">
                {stats.topAccounts?.length > 0 ? stats.topAccounts.map((a) => (
                  <div key={a.id || a.name} className="flex items-center justify-between text-sm py-2 px-2 -mx-2 rounded-lg hover:bg-brand-50/60 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={avatarInitialClass(a.name)}>{a.name?.[0]}</span>
                      <span className="truncate">{a.name}</span>
                    </div>
                    <span className="text-brand-600 font-semibold shrink-0">{fmt(a.revenue, a.currency)}</span>
                  </div>
                )) : (
                  <p className="text-sm text-zoho-muted text-center py-8">No confirmed accounts yet</p>
                )}
              </div>
            </Widget>

            <Widget title="Quick Create" className="col-span-12">
              <div className="flex flex-wrap gap-2">
                {QUICK_CREATE.map(q => (
                  <Link key={q.label} href={q.href} className="btn-secondary-sm">
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
