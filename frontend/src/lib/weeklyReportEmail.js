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

/** Map display labels (BDE/BDM) and role_key onto canonical roles for partitioning. */
export function weeklyRoleCanonical(role) {
  const key = normalizeRole(role);
  if (key === 'bde') return 'sales_rep';
  if (key === 'bdm') return 'sales_manager';
  return key;
}

export function weeklyReportRoleShort(role) {
  const key = weeklyRoleCanonical(role);
  if (key === 'sales_rep') return 'BDE';
  if (key === 'sales_manager') return 'BDM';
  if (key === 'super_admin') return 'Admin';
  const raw = String(role || '').trim().toUpperCase();
  if (raw === 'BDE' || raw === 'BDM') return raw;
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

function conversionRate(numerator, denominator) {
  const n = Number(numerator) || 0;
  const d = Number(denominator) || 0;
  if (!d) return 0;
  return (n / d) * 100;
}

/** Normalize one team member row from weekly preview / trigger payload. */
export function normalizeWeeklyMemberRow(row = {}) {
  const roleRaw = row.role || row.user_role || '';
  const roleKey = row.role_key || roleRaw;
  const coldCreated = pickNumber(row, ['cold_leads_created', 'cold_leads_generated']);
  const warmConv = pickNumber(row, ['warm_conversions', 'warm_entered']);
  const qualifiedConv = pickNumber(row, ['qualified_conversions', 'qualified_entered']);
  const coldToWarm = row.cold_to_warm_rate != null && row.cold_to_warm_rate !== ''
    ? Number(row.cold_to_warm_rate) || 0
    : conversionRate(warmConv, coldCreated);
  const warmToQualified = row.warm_to_qualified_rate != null && row.warm_to_qualified_rate !== ''
    ? Number(row.warm_to_qualified_rate) || 0
    : conversionRate(qualifiedConv, warmConv);

  return {
    user_id: row.user_id || row.id || null,
    name: row.name || row.user_name || row.full_name || '—',
    role: roleRaw,
    role_key: roleKey,
    role_short: weeklyReportRoleShort(roleKey || roleRaw),
    // Section 1 — current module snapshot + activity in period
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
    // Open leads in Cold / Warm / Qualified modules (not “created this week”)
    cold_leads: pickNumber(row, ['cold_leads', 'raw_leads', 'raw_prospects']),
    warm_leads: pickNumber(row, ['warm_leads', 'contacted_leads']),
    qualified_leads: pickNumber(row, ['qualified_leads']),
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
    // Section 2 — weekly conversions (Sat–Fri)
    cold_leads_created: coldCreated,
    warm_conversions: warmConv,
    qualified_conversions: qualifiedConv,
    cold_to_warm_rate: coldToWarm,
    warm_to_qualified_rate: warmToQualified,
  };
}

export function sumWeeklyMemberMetrics(rows = []) {
  const totals = (rows || []).reduce((acc, row) => {
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
    acc.cold_leads_created += r.cold_leads_created;
    acc.warm_conversions += r.warm_conversions;
    acc.qualified_conversions += r.qualified_conversions;
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
    cold_leads_created: 0,
    warm_conversions: 0,
    qualified_conversions: 0,
    cold_to_warm_rate: 0,
    warm_to_qualified_rate: 0,
  });

  totals.cold_to_warm_rate = conversionRate(totals.warm_conversions, totals.cold_leads_created);
  totals.warm_to_qualified_rate = conversionRate(totals.qualified_conversions, totals.warm_conversions);
  return totals;
}

export function partitionWeeklyMembers(members = []) {
  const rows = (members || []).map(normalizeWeeklyMemberRow);
  const bdes = rows.filter((r) => weeklyRoleCanonical(r.role_key || r.role) === 'sales_rep');
  const bdms = rows.filter((r) => weeklyRoleCanonical(r.role_key || r.role) === 'sales_manager');
  const others = rows.filter((r) => {
    const key = weeklyRoleCanonical(r.role_key || r.role);
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

export function formatWeeklyRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

function th(label, align = 'left') {
  return `<th style="padding:8px 10px;border:1px solid #d1d5db;text-align:${align};font-size:11px;background:#f8fafc;white-space:nowrap;">${escapeHtml(label)}</th>`;
}

function td(value, { align = 'left', bold = false, money = false, rate = false } = {}) {
  let display;
  if (rate) display = formatWeeklyRate(value);
  else if (money) display = formatInr(value);
  else display = formatCount(value);
  return `<td style="padding:8px 10px;border:1px solid #d1d5db;text-align:${align};${bold ? 'font-weight:700;' : ''}">${escapeHtml(display)}</td>`;
}

function nameCell(name, role) {
  return `<td style="padding:8px 10px;border:1px solid #d1d5db;">${escapeHtml(name)}</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;">${escapeHtml(role)}</td>`;
}

function snapshotRowHtml(row, { bold = false } = {}) {
  return `<tr>${[
    nameCell(row.name, row.role_short || weeklyReportRoleShort(row.role_key || row.role)),
    td(row.emails_sent, { align: 'right', bold }),
    td(row.follow_up_emails_sent, { align: 'right', bold }),
    td(row.linkedin_connections_sent, { align: 'right', bold }),
    td(row.cold_leads, { align: 'right', bold }),
    td(row.warm_leads, { align: 'right', bold }),
    td(row.qualified_leads, { align: 'right', bold }),
    td(row.meetings_scheduled, { align: 'right', bold }),
    td(row.pipeline_created, { align: 'right', bold, money: true }),
    td(row.revenue_generated, { align: 'right', bold, money: true }),
  ].join('')}</tr>`;
}

function conversionRowHtml(row, { bold = false } = {}) {
  return `<tr>${[
    nameCell(row.name, row.role_short || weeklyReportRoleShort(row.role_key || row.role)),
    td(row.cold_leads_created, { align: 'right', bold }),
    td(row.warm_conversions, { align: 'right', bold }),
    td(row.qualified_conversions, { align: 'right', bold }),
    td(row.cold_to_warm_rate, { align: 'right', bold, rate: true }),
    td(row.warm_to_qualified_rate, { align: 'right', bold, rate: true }),
  ].join('')}</tr>`;
}

function snapshotSectionHtml({ title, rows, totalLabel = 'Total', totalRole = 'Team' }) {
  const normalized = rows.map(normalizeWeeklyMemberRow);
  const totals = sumWeeklyMemberMetrics(normalized);
  const headers = [
    th('Resource Name'),
    th('Role'),
    th('Emails Sent', 'right'),
    th('Follow-ups Sent', 'right'),
    th('LinkedIn Connections', 'right'),
    th('Cold (module now)', 'right'),
    th('Warm (module now)', 'right'),
    th('Qualified (module now)', 'right'),
    th('Meetings Scheduled', 'right'),
    th('Pipeline Created', 'right'),
    th('Revenue Generated', 'right'),
  ];
  const body = normalized.length
    ? normalized.map((row) => snapshotRowHtml(row)).join('')
    : `<tr><td colspan="${headers.length}" style="padding:14px 10px;border:1px solid #d1d5db;text-align:center;color:#6b7280;">No team members in this section.</td></tr>`;

  return `
    <h2 style="margin:28px 0 12px;font-size:15px;color:#b91c1c;">${escapeHtml(title)}</h2>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:900px;">
        <thead><tr>${headers.join('')}</tr></thead>
        <tbody>
          ${body}
          ${snapshotRowHtml({ name: totalLabel, role_short: totalRole, ...totals }, { bold: true })}
        </tbody>
      </table>
    </div>`;
}

function conversionSectionHtml({ title, rows, totalLabel = 'Total', totalRole = 'Team' }) {
  const normalized = rows.map(normalizeWeeklyMemberRow);
  const totals = sumWeeklyMemberMetrics(normalized);
  const headers = [
    th('Resource Name'),
    th('Role'),
    th('Cold Created (week)', 'right'),
    th('→ Warm (week)', 'right'),
    th('→ Qualified (week)', 'right'),
    th('Cold→Warm %', 'right'),
    th('Warm→Qualified %', 'right'),
  ];
  const body = normalized.length
    ? normalized.map((row) => conversionRowHtml(row)).join('')
    : `<tr><td colspan="${headers.length}" style="padding:14px 10px;border:1px solid #d1d5db;text-align:center;color:#6b7280;">No team members in this section.</td></tr>`;

  return `
    <h2 style="margin:28px 0 12px;font-size:15px;color:#b91c1c;">${escapeHtml(title)}</h2>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:720px;">
        <thead><tr>${headers.join('')}</tr></thead>
        <tbody>
          ${body}
          ${conversionRowHtml({ name: totalLabel, role_short: totalRole, ...totals }, { bold: true })}
        </tbody>
      </table>
    </div>`;
}

export function buildWeeklyReportIntroText({ periodStart, periodEnd } = {}) {
  const periodLabel = periodStart && periodEnd
    ? `${periodStart} to ${periodEnd}`
    : 'this week (Saturday–Friday)';
  return [
    'Hi Team,',
    '',
    `Please find below the weekly sales performance report generated from Origami CRM for the period ${periodLabel}.`,
    '',
    'Section 1 shows current Cold / Warm / Qualified module counts plus activity in the period (emails, LinkedIn, meetings, pipeline, revenue). Section 2 shows weekly conversions (cold created, warm / qualified entries, and conversion rates).',
    '',
    'Kindly review the numbers before the weekly sales review meeting.',
    '',
    'Regards,',
    'Origami CRM',
  ].join('\n');
}

/**
 * Team weekly digest HTML built from member_rows (fallback when API html_body is absent).
 * Two sections: module snapshot + activity, then Sat–Fri conversions.
 */
export function buildWeeklyReportHtml({
  companyName = 'Origami CRM',
  periodStart,
  periodEnd,
  generatedOn,
  teamLabel: teamLabelOverride,
  members = [],
  summary = {},
} = {}) {
  const memberRows = members.length ? members : [];
  const { all, bdes, bdms, others } = partitionWeeklyMembers(memberRows);
  const periodLabel = periodStart && periodEnd
    ? `${periodStart} to ${periodEnd}`
    : 'Current week (Saturday–Friday)';
  const generatedLabel = generatedOn
    || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const bdeCount = bdes.length;
  const bdmCount = bdms.length;
  const teamLabel = teamLabelOverride
    || summary?.team_label
    || [
      bdeCount ? `${bdeCount} BDE${bdeCount === 1 ? '' : 's'}` : null,
      bdmCount ? `${bdmCount} BDM${bdmCount === 1 ? '' : 's'}` : null,
      others.length ? `${others.length} other` : null,
    ].filter(Boolean).join(' + ')
    || `${all.length} team member(s)`;

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
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">Team Digest</h1>
      <p style="margin:10px 0 0;font-size:13px;color:#d1d5db;">
        Report Period (Saturday–Friday): ${escapeHtml(periodLabel)}<br />
        Generated From: ${escapeHtml(companyName)}<br />
        Generated On: ${escapeHtml(generatedLabel)}<br />
        Team: ${escapeHtml(teamLabel)}
      </p>
    </div>

    <div style="padding:24px;">
      ${introHtml}

      ${snapshotSectionHtml({
        title: '1. Module snapshot + activity',
        rows: all,
        totalLabel: 'Total',
        totalRole: 'Team',
      })}

      ${conversionSectionHtml({
        title: '2. Weekly conversions (Saturday–Friday)',
        rows: all,
        totalLabel: 'Total',
        totalRole: 'Team',
      })}
    </div>

    <div style="padding:14px 24px;background:#fafafa;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
      Generated automatically by ${escapeHtml(companyName)}. Recommended schedule: Friday 3:30 PM IST (Asia/Kolkata), Saturday–Friday period.
    </div>
  </div>
</body>
</html>`;
}
