'use client';
import {
  normalizeWeeklyMemberRow,
  partitionWeeklyMembers,
  sumWeeklyMemberMetrics,
  weeklyReportRoleShort,
} from '../../lib/weeklyReportEmail.js';

function formatInr(value) {
  return `₹${(Number(value) || 0).toLocaleString('en-IN')}`;
}

function MemberTable({
  title,
  rows,
  includeRevenue = true,
  totalLabel = 'Total',
  totalRole = 'Team',
}) {
  const normalized = (rows || []).map(normalizeWeeklyMemberRow);
  const totals = sumWeeklyMemberMetrics(normalized);
  const colSpan = includeRevenue ? 11 : 10;

  return (
    <div className="card overflow-x-auto">
      <h3 className="font-semibold p-5 pb-3">{title}</h3>
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="table-th">Resource Name</th>
            <th className="table-th">Role</th>
            <th className="table-th text-right">Emails Sent</th>
            <th className="table-th text-right">Follow-ups Sent</th>
            <th className="table-th text-right">LinkedIn Connections</th>
            <th className="table-th text-right">Cold Leads</th>
            <th className="table-th text-right">Warm Leads</th>
            <th className="table-th text-right">Qualified Leads</th>
            <th className="table-th text-right">Meetings Scheduled</th>
            <th className="table-th text-right">Pipeline Created</th>
            {includeRevenue && <th className="table-th text-right">Revenue Generated</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {normalized.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="table-td text-center py-6 text-gray-400">
                No members in this section yet
              </td>
            </tr>
          ) : normalized.map((row) => (
            <tr key={row.user_id || `${row.name}-${row.role}`}>
              <td className="table-td font-medium">{row.name}</td>
              <td className="table-td">{row.role_short || weeklyReportRoleShort(row.role)}</td>
              <td className="table-td text-right">{row.emails_sent}</td>
              <td className="table-td text-right">{row.follow_up_emails_sent}</td>
              <td className="table-td text-right">{row.linkedin_connections_sent}</td>
              <td className="table-td text-right">{row.cold_leads}</td>
              <td className="table-td text-right">{row.warm_leads}</td>
              <td className="table-td text-right">{row.qualified_leads}</td>
              <td className="table-td text-right">{row.meetings_scheduled}</td>
              <td className="table-td text-right">{formatInr(row.pipeline_created)}</td>
              {includeRevenue && (
                <td className="table-td text-right">{formatInr(row.revenue_generated)}</td>
              )}
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <td className="table-td">{totalLabel}</td>
            <td className="table-td">{totalRole}</td>
            <td className="table-td text-right">{totals.emails_sent}</td>
            <td className="table-td text-right">{totals.follow_up_emails_sent}</td>
            <td className="table-td text-right">{totals.linkedin_connections_sent}</td>
            <td className="table-td text-right">{totals.cold_leads}</td>
            <td className="table-td text-right">{totals.warm_leads}</td>
            <td className="table-td text-right">{totals.qualified_leads}</td>
            <td className="table-td text-right">{totals.meetings_scheduled}</td>
            <td className="table-td text-right">{formatInr(totals.pipeline_created)}</td>
            {includeRevenue && (
              <td className="table-td text-right">{formatInr(totals.revenue_generated)}</td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function WeeklyTeamPerformancePreview({
  members = [],
  periodStart = '',
  periodEnd = '',
  teamLabel = '',
  generatedOn = '',
}) {
  const { all, bdes, bdms } = partitionWeeklyMembers(members);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-brand-700">Weekly Sales Performance Preview</h3>
        <p className="text-xs text-gray-500 mt-1">
          {teamLabel ? `${teamLabel} · ` : ''}
          Report period: {periodStart || '—'} to {periodEnd || '—'}
          {generatedOn ? ` · Generated ${generatedOn}` : ' · Generated from Origami CRM'}
        </p>
      </div>
      <MemberTable title="1. Weekly Team Summary" rows={all} includeRevenue totalLabel="Total" totalRole="Team" />
      <MemberTable title="2. BDE Summary" rows={bdes} includeRevenue={false} totalLabel="BDE Total" totalRole="BDE" />
      <MemberTable title="3. BDM Summary" rows={bdms} includeRevenue totalLabel="BDM Total" totalRole="BDM" />
    </div>
  );
}
