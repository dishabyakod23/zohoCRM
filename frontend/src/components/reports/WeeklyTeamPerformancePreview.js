'use client';
import {
  formatWeeklyRate,
  normalizeWeeklyMemberRow,
  partitionWeeklyMembers,
  sumWeeklyMemberMetrics,
  weeklyReportRoleShort,
} from '../../lib/weeklyReportEmail.js';

function formatInr(value) {
  return `₹${(Number(value) || 0).toLocaleString('en-IN')}`;
}

function SnapshotTable({ title, rows, totalLabel = 'Total', totalRole = 'Team' }) {
  const normalized = (rows || []).map(normalizeWeeklyMemberRow);
  const totals = sumWeeklyMemberMetrics(normalized);
  const colSpan = 11;

  return (
    <div className="card overflow-x-auto">
      <h3 className="font-semibold p-5 pb-1">{title}</h3>
      <p className="text-xs text-gray-500 px-5 pb-3">
        Cold / Warm / Qualified are current open module counts. Activity metrics cover the report period.
      </p>
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="table-th">Resource Name</th>
            <th className="table-th">Role</th>
            <th className="table-th text-right">Emails Sent</th>
            <th className="table-th text-right">Follow-ups Sent</th>
            <th className="table-th text-right">LinkedIn Connections</th>
            <th className="table-th text-right">Cold (module now)</th>
            <th className="table-th text-right">Warm (module now)</th>
            <th className="table-th text-right">Qualified (module now)</th>
            <th className="table-th text-right">Meetings Scheduled</th>
            <th className="table-th text-right">Pipeline Created</th>
            <th className="table-th text-right">Revenue Generated</th>
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
              <td className="table-td">{row.role_short || weeklyReportRoleShort(row.role_key || row.role)}</td>
              <td className="table-td text-right">{row.emails_sent}</td>
              <td className="table-td text-right">{row.follow_up_emails_sent}</td>
              <td className="table-td text-right">{row.linkedin_connections_sent}</td>
              <td className="table-td text-right">{row.cold_leads}</td>
              <td className="table-td text-right">{row.warm_leads}</td>
              <td className="table-td text-right">{row.qualified_leads}</td>
              <td className="table-td text-right">{row.meetings_scheduled}</td>
              <td className="table-td text-right">{formatInr(row.pipeline_created)}</td>
              <td className="table-td text-right">{formatInr(row.revenue_generated)}</td>
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
            <td className="table-td text-right">{formatInr(totals.revenue_generated)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ConversionTable({ title, rows, totalLabel = 'Total', totalRole = 'Team' }) {
  const normalized = (rows || []).map(normalizeWeeklyMemberRow);
  const totals = sumWeeklyMemberMetrics(normalized);
  const colSpan = 7;

  return (
    <div className="card overflow-x-auto">
      <h3 className="font-semibold p-5 pb-1">{title}</h3>
      <p className="text-xs text-gray-500 px-5 pb-3">
        New cold leads and Warm / Qualified entries in the Saturday–Friday window (mid-week previews end today).
      </p>
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="table-th">Resource Name</th>
            <th className="table-th">Role</th>
            <th className="table-th text-right">Cold Created (week)</th>
            <th className="table-th text-right">→ Warm (week)</th>
            <th className="table-th text-right">→ Qualified (week)</th>
            <th className="table-th text-right">Cold→Warm %</th>
            <th className="table-th text-right">Warm→Qualified %</th>
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
            <tr key={`conv-${row.user_id || `${row.name}-${row.role}`}`}>
              <td className="table-td font-medium">{row.name}</td>
              <td className="table-td">{row.role_short || weeklyReportRoleShort(row.role_key || row.role)}</td>
              <td className="table-td text-right">{row.cold_leads_created}</td>
              <td className="table-td text-right">{row.warm_conversions}</td>
              <td className="table-td text-right">{row.qualified_conversions}</td>
              <td className="table-td text-right">{formatWeeklyRate(row.cold_to_warm_rate)}</td>
              <td className="table-td text-right">{formatWeeklyRate(row.warm_to_qualified_rate)}</td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <td className="table-td">{totalLabel}</td>
            <td className="table-td">{totalRole}</td>
            <td className="table-td text-right">{totals.cold_leads_created}</td>
            <td className="table-td text-right">{totals.warm_conversions}</td>
            <td className="table-td text-right">{totals.qualified_conversions}</td>
            <td className="table-td text-right">{formatWeeklyRate(totals.cold_to_warm_rate)}</td>
            <td className="table-td text-right">{formatWeeklyRate(totals.warm_to_qualified_rate)}</td>
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
  const { all } = partitionWeeklyMembers(members);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-brand-700">Weekly team digest preview</h3>
        <p className="text-xs text-gray-500 mt-1">
          {teamLabel ? `${teamLabel} · ` : ''}
          Saturday–Friday period: {periodStart || '—'} to {periodEnd || '—'}
          {generatedOn ? ` · Generated ${generatedOn}` : ' · Generated from Origami CRM'}
          {' · Built from '}
          <code className="text-[11px]">member_rows</code>
        </p>
      </div>
      <SnapshotTable title="1. Module snapshot + activity" rows={all} />
      <ConversionTable title="2. Weekly conversions (Saturday–Friday)" rows={all} />
    </div>
  );
}
