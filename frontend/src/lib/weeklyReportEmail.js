import { normalizeRole, roleLabel } from './roles.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Recommended schedule for the Friday sales review pack. */
export const RECOMMENDED_WEEKLY_REPORT_SCHEDULE = {
  day_of_week: 4, // Friday (Monday=0)
  hour: 15,
  minute: 30,
  timezone: 'Asia/Kolkata',
};

export function weeklyReportRoleShort(role) {
  const key = normalizeRole(role);
  if (key === 'sales_rep') return 'BDE';
  if (key === 'sales_manager') return 'BDM';
  if (key === 'super_admin') return 'Admin';
  return roleLabel(role) || '—';
}

function pickNumber(row, keys, fallback = 0) {
  for (const key of keys) {
    if (row?.[key] != null && row[key] !== '') return Number(row[key]) || 0;
  }
  return fallback;
}

function pickMoney(row, keys) {
  return pickNumber(row, keys, 0);
}

/** Normalize one team member row from weekly preview / trigger payload. */
export function normalizeWeeklyMemberRow(row = {}) {
  return {
    user_id: row.user_id || row.id || null,
    name: row.user_name || row.name || row.full_name || '—',
    role: row.role || row.user_role || '',
    role_short: weeklyReportRoleShort(row.role || row.user_role),
    emails_sent: pickNumber(row, ['emails_sent', 'total_emails_sent', 'email_count']),
    follow_up_emails_sent: pickNumber(row, [
      'follow_up_emails_sent',
      'followups_sent',
      'follow_ups_sent',
      'follow_ups',
      'followups',
    ]),
    linkedin_connections_sent: pickNumber(row, [
      'linkedin_connections_sent',
      'linkedin_outreach',
      'linkedin_connections',
      'linkedin',
    ]),
    cold_leads: pickNumber(row, ['cold_leads', 'cold_leads_generated', 'raw_leads', 'raw_prospects']),
    warm_leads: pickNumber(row, ['warm_leads', 'warm_leads_generated', 'contacted_leads']),
    qualified_leads: pickNumber(row, ['qualified_leads', 'qualified_leads_generated']),
    meetings_scheduled: pickNumber(row, [
      'meetings_scheduled',
      'meetings_booked',
      'qualified_meetings',
      'meetings',
    ]),
    pipeline_created: pickMoney(row, ['pipeline_created', 'pipeline_value', 'pipeline']),
    revenue_generated: pickMoney(row, [
      'revenue_generated',
      'revenue_collected',
      'deals_won_amount',
      'deals_closed_amount',
      'revenue',
    ]),
  };
}

export function sumWeeklyMemberMetrics(rows = []) {
  return rows.reduce((acc, row) => {
    const r = normalizeWeeklyMemberRow(row);
    acc.emails_sent += r.emails_sent;
    acc.follow_up_emails_sent += r.follow_up_emails_sent;
    acc.linkedin_connections_sent += r.linkedin_connections_sent;
    acc.cold_leads += r.cold_leads;
    acc.warm_leads += r.warm_leads;
    acc.qualified_leads += r.qualified_leads;
    acc.meetings_scheduled += r.meetings_scheduled;
    acc.pipeline_created += r.pipeline_created;
    acc.revenue_generated += r.revenue_generated;
    return acc;
  }, {
    emails_sent: 0,
    follow_up_emails_sent: 0,
    linkedin_connections_sent: 0,
    cold_leads: 0,
    warm_leads: 0,
    qualified_leads: 0,
    meetings_scheduled: 0,
    pipeline_created: 0,
    revenue_generated: 0,
  });
}

export function partitionWeeklyMembers(members = []) {
  const rows = (members || []).map(normalizeWeeklyMemberRow);
  const bdes = rows.filter((r) => normalizeRole(r.role) === 'sales_rep');
  const bdms = rows.filter((r) => normalizeRole(r.role) === 'sales_manager');
  const others = rows.filter((r) => {
    const key = normalizeRole(r.role);
    return key !== 'sales_rep' && key !== 'sales_manager';
  });
  return { all: rows, bdes, bdms, others };
}

function formatInr(value) {
  const n = Number(value) || 0;
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatCount(value) {
  return String(Number(value) || 0);
}

function th(label, align = 'left') {
  return `<th style="padding:8px 10px;border:1px solid #d1d5db;text-align:${align};font-size:11px;background:#f8fafc;white-space:nowrap;">${escapeHtml(label)}</th>`;
}

function td(value, { align = 'left', bold = false, money = false } = {}) {
  const display = money ? formatInr(value) : formatCount(value);
  return `<td style="padding:8px 10px;border:1px solid #d1d5db;text-align:${align};${bold ? 'font-weight:700;' : ''}">${escapeHtml(display)}</td>`;
}

function nameCell(name, role) {
  return `<td style="padding:8px 10px;border:1px solid #d1d5db;">${escapeHtml(name)}</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;">${escapeHtml(role)}</td>`;
}

function teamRowHtml(row, { includeRevenue = true, bold = false } = {}) {
  const cells = [
    nameCell(row.name, row.role_short || weeklyReportRoleShort(row.role)),
    td(row.emails_sent, { align: 'right', bold }),
    td(row.follow_up_emails_sent, { align: 'right', bold }),
    td(row.linkedin_connections_sent, { align: 'right', bold }),
    td(row.cold_leads, { align: 'right', bold }),
    td(row.warm_leads, { align: 'right', bold }),
    td(row.qualified_leads, { align: 'right', bold }),
    td(row.meetings_scheduled, { align: 'right', bold }),
    td(row.pipeline_created, { align: 'right', bold, money: true }),
  ];
  if (includeRevenue) {
    cells.push(td(row.revenue_generated, { align: 'right', bold, money: true }));
  }
  return `<tr>${cells.join('')}</tr>`;
}

function totalsAsRow(totals, label, roleLabelText, { includeRevenue = true } = {}) {
  return teamRowHtml({
    name: label,
    role_short: roleLabelText,
    ...totals,
  }, { includeRevenue, bold: true });
}

function sectionTableHtml({
  title,
  rows,
  includeRevenue = true,
  totalLabel = 'Total',
  totalRole = 'Team',
}) {
  const normalized = rows.map(normalizeWeeklyMemberRow);
  const totals = sumWeeklyMemberMetrics(normalized);
  const headers = [
    th('Resource Name'),
    th('Role'),
    th('Total Emails Sent', 'right'),
    th('Follow-up Emails Sent', 'right'),
    th('LinkedIn Connections Sent', 'right'),
    th('Cold Leads Generated', 'right'),
    th('Warm Leads Generated', 'right'),
    th('Qualified Leads Generated', 'right'),
    th('Meetings Scheduled', 'right'),
    th('Pipeline Created', 'right'),
  ];
  if (includeRevenue) headers.push(th('Revenue Generated', 'right'));

  const body = normalized.length
    ? normalized.map((row) => teamRowHtml(row, { includeRevenue })).join('')
    : `<tr><td colspan="${headers.length}" style="padding:14px 10px;border:1px solid #d1d5db;text-align:center;color:#6b7280;">No team members in this section.</td></tr>`;

  return `
    <h2 style="margin:28px 0 12px;font-size:15px;color:#b91c1c;">${escapeHtml(title)}</h2>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:900px;">
        <thead><tr>${headers.join('')}</tr></thead>
        <tbody>
          ${body}
          ${totalsAsRow(totals, totalLabel, totalRole, { includeRevenue })}
        </tbody>
      </table>
    </div>`;
}

export function buildWeeklyReportIntroText({ periodStart, periodEnd } = {}) {
  const periodLabel = periodStart && periodEnd
    ? `${periodStart} to ${periodEnd}`
    : 'this week';
  return [
    'Hi Team,',
    '',
    `Please find below the weekly sales performance report generated from Origami CRM for the period ${periodLabel}.`,
    '',
    'The report includes activity performance for all BDEs and BDMs covering emails sent, follow-up emails, LinkedIn connections, cold leads, warm leads, qualified leads, meetings scheduled, pipeline created, and revenue generated.',
    '',
    'Kindly review the numbers before the weekly sales review meeting.',
    '',
    'Regards,',
    'Origami CRM',
  ].join('\n');
}

/**
 * Team weekly sales performance email HTML (BDE + BDM tables).
 * Backend should prefer this shape for /admin/reports/weekly preview + trigger.
 */
export function buildWeeklyReportHtml({
  companyName = 'Origami CRM',
  periodStart,
  periodEnd,
  generatedOn,
  members = [],
  summary = {},
} = {}) {
  const memberRows = (members.length
    ? members
    : (summary.reports || summary.members || summary.team || [])
  );
  const { all, bdes, bdms, others } = partitionWeeklyMembers(memberRows);
  const periodLabel = periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : 'Current week (Mon–Fri)';
  const generatedLabel = generatedOn
    || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const bdeCount = bdes.length;
  const bdmCount = bdms.length;
  const teamLabel = [
    bdeCount ? `${bdeCount} BDE${bdeCount === 1 ? '' : 's'}` : null,
    bdmCount ? `${bdmCount} BDM${bdmCount === 1 ? '' : 's'}` : null,
    others.length ? `${others.length} other` : null,
  ].filter(Boolean).join(' + ') || `${all.length} team member(s)`;

  const introHtml = buildWeeklyReportIntroText({ periodStart, periodEnd })
    .split('\n')
    .map((line) => (line
      ? `<p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#111827;">${escapeHtml(line)}</p>`
      : '<div style="height:8px;"></div>'))
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Weekly Sales Performance Report</title>
</head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="max-width:1100px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
    <div style="background:#111111;color:#ffffff;padding:22px 24px;">
      <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#fca5a5;">Weekly Sales Performance Report</div>
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">Team Activity Summary</h1>
      <p style="margin:10px 0 0;font-size:13px;color:#d1d5db;">
        Report Period: ${escapeHtml(periodLabel)}<br />
        Generated From: ${escapeHtml(companyName)}<br />
        Generated On: ${escapeHtml(generatedLabel)}<br />
        Team: ${escapeHtml(teamLabel)}
      </p>
    </div>

    <div style="padding:24px;">
      ${introHtml}

      ${sectionTableHtml({
        title: '1. Weekly Team Summary',
        rows: all,
        includeRevenue: true,
        totalLabel: 'Total',
        totalRole: 'Team',
      })}

      ${sectionTableHtml({
        title: '2. BDE Summary',
        rows: bdes,
        includeRevenue: false,
        totalLabel: 'BDE Total',
        totalRole: 'BDE',
      })}

      ${sectionTableHtml({
        title: '3. BDM Summary',
        rows: bdms.length ? bdms : others.filter((r) => normalizeRole(r.role) === 'sales_manager'),
        includeRevenue: true,
        totalLabel: 'BDM Total',
        totalRole: 'BDM',
      })}
    </div>

    <div style="padding:14px 24px;background:#fafafa;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
      Generated automatically by ${escapeHtml(companyName)}. Recommended schedule: Friday 3:30 PM IST (Asia/Kolkata), Monday–Friday period.
    </div>
  </div>
</body>
</html>`;
}
