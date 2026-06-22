const pool = require('../db/pool');
const { getMonthlyPlan, weeklyFromMonthly, achievementStatus, formatMoney } = require('./salesPlanTargets');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function kpiRow(metric, target, actual, owner) {
  const { pct, status } = achievementStatus(actual, target);
  const statusColor = status === 'On Track' ? '#166534' : status === 'At Risk' ? '#b45309' : '#b91c1c';
  return `<tr>
    <td style="padding:8px 10px;border:1px solid #d1d5db;font-weight:600;">${escapeHtml(metric)}</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:right;">${escapeHtml(target)}</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:right;font-weight:600;">${escapeHtml(actual)}</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;text-align:right;">${pct}%</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;color:${statusColor};font-weight:600;">${status}</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;">${escapeHtml(owner || '')}</td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;"></td>
    <td style="padding:8px 10px;border:1px solid #d1d5db;"></td>
  </tr>`;
}

function buildWeeklySalesStatusHtml({
  companyName = 'Origami Consulting LLC',
  userName,
  userEmail,
  userRole,
  periodStart,
  periodEnd,
  preparedBy,
  reportDate,
  kpis = {},
  monthlyPlan,
  currency = 'USD',
}) {
  const monthly = monthlyPlan || getMonthlyPlan(periodEnd || new Date());
  const weekly = weeklyFromMonthly(monthly);
  const monthLabel = periodEnd ? new Date(periodEnd).toLocaleString('en-US', { month: 'long', year: 'numeric' }) : '';
  const revenueMtd = Number(kpis.revenue_mtd || kpis.deals_won_amount || 0);
  const monthlyGap = Math.max(0, monthly.revenue - revenueMtd);

  const rows = [
    ['New Leads Added', weekly.newLeads, kpis.new_leads ?? 0],
    ['Prospects Contacted', weekly.prospects, kpis.prospects_contacted ?? 0],
    ['Cold Calls Completed', weekly.coldCalls, kpis.cold_calls ?? 0],
    ['Emails Sent', weekly.emails, kpis.emails_sent ?? 0],
    ['LinkedIn Outreach', weekly.linkedin, kpis.linkedin_outreach ?? 0],
    ['Follow-ups Completed', weekly.followups, kpis.follow_ups ?? 0],
    ['Qualified Meetings Booked', weekly.qualifiedMeetings, kpis.qualified_meetings ?? 0],
    ['Meetings Completed', weekly.qualifiedMeetings, kpis.meetings_completed ?? 0],
    ['Proposals Sent', weekly.proposals, kpis.proposals_sent ?? 0],
    ['Pipeline Value Added ($)', formatMoney(weekly.pipeline, currency), formatMoney(kpis.pipeline_value || 0, currency)],
    ['Deals Closed ($)', formatMoney(weekly.revenue, currency), formatMoney(kpis.deals_closed_amount || 0, currency)],
    ['Revenue Collected ($)', formatMoney(weekly.revenue, currency), formatMoney(kpis.revenue_collected || 0, currency)],
  ].map(([metric, target, actual]) => kpiRow(metric, target, actual, userName)).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>Weekly Sales Status — ${escapeHtml(userName)}</title></head>
<body style="margin:0;padding:20px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="max-width:980px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;">
    <div style="background:#1e293b;color:#fff;padding:18px 22px;">
      <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#fca5a5;">Weekly Business Development &amp; Sales Status Report</div>
      <h1 style="margin:8px 0 0;font-size:20px;">${escapeHtml(userName)}</h1>
      <p style="margin:6px 0 0;font-size:12px;color:#cbd5e1;">${escapeHtml(userEmail || '')} · ${escapeHtml(String(userRole || '').replace(/_/g, ' '))}</p>
    </div>
    <div style="padding:18px 22px;border-bottom:1px solid #e5e7eb;font-size:13px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 8px 4px 0;color:#64748b;width:140px;">Report Week Start</td><td style="padding:4px 8px;font-weight:600;">${escapeHtml(periodStart || '')}</td>
          <td style="padding:4px 8px 4px 0;color:#64748b;width:120px;">Report Week End</td><td style="padding:4px 8px;font-weight:600;">${escapeHtml(periodEnd || '')}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px 4px 0;color:#64748b;">Report Date</td><td style="padding:4px 8px;font-weight:600;">${escapeHtml(reportDate || new Date().toISOString().slice(0, 10))}</td>
          <td style="padding:4px 8px 4px 0;color:#64748b;">Prepared By</td><td style="padding:4px 8px;font-weight:600;">${escapeHtml(preparedBy || companyName)}</td>
        </tr>
      </table>
    </div>
    <div style="padding:18px 22px;border-bottom:1px solid #e5e7eb;font-size:13px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 8px 4px 0;color:#64748b;">Month</td><td style="padding:4px 8px;font-weight:600;">${escapeHtml(monthLabel)}</td>
          <td style="padding:4px 8px 4px 0;color:#64748b;">Monthly Revenue Target</td><td style="padding:4px 8px;font-weight:600;">${formatMoney(monthly.revenue, currency)}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px 4px 0;color:#64748b;">Revenue Achieved MTD</td><td style="padding:4px 8px;font-weight:600;">${formatMoney(revenueMtd, currency)}</td>
          <td style="padding:4px 8px 4px 0;color:#64748b;">Monthly Gap</td><td style="padding:4px 8px;font-weight:600;color:#b91c1c;">${formatMoney(monthlyGap, currency)}</td>
        </tr>
      </table>
    </div>
    <div style="padding:18px 22px;">
      <h2 style="margin:0 0 12px;font-size:15px;color:#b91c1c;">Weekly KPI Summary</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 10px;border:1px solid #d1d5db;text-align:left;">Metric</th>
            <th style="padding:8px 10px;border:1px solid #d1d5db;text-align:right;">Weekly Target</th>
            <th style="padding:8px 10px;border:1px solid #d1d5db;text-align:right;">Actual</th>
            <th style="padding:8px 10px;border:1px solid #d1d5db;text-align:right;">Achievement %</th>
            <th style="padding:8px 10px;border:1px solid #d1d5db;text-align:left;">Status</th>
            <th style="padding:8px 10px;border:1px solid #d1d5db;text-align:left;">Owner</th>
            <th style="padding:8px 10px;border:1px solid #d1d5db;text-align:left;">Remarks</th>
            <th style="padding:8px 10px;border:1px solid #d1d5db;text-align:left;">Management Notes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:12px 22px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:11px;color:#64748b;">
      ${escapeHtml(companyName)} CRM · Individual weekly performance report
    </div>
  </div>
</body>
</html>`;
}

function combineReportsHtml(reports, { title = 'Weekly Individual Performance Reports', companyName } = {}) {
  const sections = (reports || []).map((r) => r.html_body || '').join('<div style="height:24px;"></div>');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:20px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:980px;margin:0 auto 20px;padding:16px 20px;background:#111;color:#fff;border-radius:8px;">
    <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#fca5a5;">Management digest</div>
    <h1 style="margin:8px 0 0;font-size:20px;">${escapeHtml(title)}</h1>
    <p style="margin:6px 0 0;font-size:12px;color:#d1d5db;">${escapeHtml(companyName || 'Sales CRM')} · ${reports.length} team member report(s)</p>
  </div>
  ${sections}
</body></html>`;
}

async function fetchUserWeeklyKpis(userId, periodStart, periodEnd) {
  const dateParams = [periodStart, periodEnd];
  const periodCreated = `created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day')`;
  const periodUpdated = `updated_at >= $1::date AND updated_at < ($2::date + INTERVAL '1 day')`;
  const monthStart = periodEnd ? `${periodEnd.slice(0, 7)}-01` : new Date().toISOString().slice(0, 8) + '01';

  const [
    newLeads,
    prospects,
    coldCalls,
    linkedin,
    followUps,
    qualifiedMeetings,
    meetingsCompleted,
    proposals,
    pipelineValue,
    dealsClosed,
    revenueMtd,
  ] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS count FROM leads WHERE deleted_at IS NULL AND owner_id=$3 AND ${periodCreated}`,
      [...dateParams, userId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM leads WHERE deleted_at IS NULL AND owner_id=$3
       AND status IN ('contacted','attempted_to_contact','Attempted to Contact','Contacted')
       AND ${periodUpdated}`,
      [...dateParams, userId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM calls WHERE deleted_at IS NULL
       AND COALESCE(owner_id, assigned_to)=$3 AND LOWER(call_type) LIKE '%out%'
       AND ${periodCreated}`,
      [...dateParams, userId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM leads WHERE deleted_at IS NULL AND owner_id=$3
       AND (source ILIKE '%linkedin%' OR lead_source ILIKE '%linkedin%') AND ${periodCreated}`,
      [...dateParams, userId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM tasks WHERE deleted_at IS NULL AND assigned_to=$3
       AND status IN ('Completed','completed','done') AND ${periodUpdated}`,
      [...dateParams, userId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM leads WHERE deleted_at IS NULL AND owner_id=$3
       AND status IN ('qualified_lead','pre_qualified','Pre-Qualified') AND ${periodCreated}`,
      [...dateParams, userId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM meetings WHERE deleted_at IS NULL
       AND COALESCE(owner_id, host_id)=$3 AND ${periodCreated}`,
      [...dateParams, userId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM leads WHERE deleted_at IS NULL AND owner_id=$3
       AND (source ILIKE '%proposal%' OR lead_source ILIKE '%proposal%') AND ${periodCreated}`,
      [...dateParams, userId],
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount),0)::numeric AS total FROM deals
       WHERE deleted_at IS NULL AND owner_id=$3
         AND stage NOT IN ('closed_won','closed_lost','Closed Won','Closed Lost')
         AND ${periodCreated}`,
      [...dateParams, userId],
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount),0)::numeric AS total FROM deals
       WHERE deleted_at IS NULL AND owner_id=$3
         AND stage IN ('closed_won','Closed Won') AND ${periodUpdated}`,
      [...dateParams, userId],
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount),0)::numeric AS total FROM deals
       WHERE deleted_at IS NULL AND owner_id=$1
         AND stage IN ('closed_won','Closed Won')
         AND updated_at >= $2::date
         AND updated_at < (date_trunc('month', $2::date) + INTERVAL '1 month')`,
      [userId, monthStart],
    ),
  ]);

  const closedAmount = Number(dealsClosed.rows[0].total || 0);
  return {
    new_leads: newLeads.rows[0].count,
    prospects_contacted: prospects.rows[0].count,
    cold_calls: coldCalls.rows[0].count,
    emails_sent: 0,
    linkedin_outreach: linkedin.rows[0].count,
    follow_ups: followUps.rows[0].count,
    qualified_meetings: qualifiedMeetings.rows[0].count,
    meetings_completed: meetingsCompleted.rows[0].count,
    proposals_sent: proposals.rows[0].count,
    pipeline_value: Number(pipelineValue.rows[0].total || 0),
    deals_closed_amount: closedAmount,
    revenue_collected: closedAmount,
    revenue_mtd: Number(revenueMtd.rows[0].total || 0),
  };
}

async function getManagementRecipients() {
  const result = await pool.query(
    `SELECT id, name, email, role FROM users
     WHERE deleted_at IS NULL AND role IN ('super_admin', 'sales_manager')
       AND email IS NOT NULL AND email <> ''
     ORDER BY name`,
  );
  return result.rows;
}

async function listReportableTeamMembers() {
  const result = await pool.query(
    `SELECT id, name, email, role FROM users
     WHERE deleted_at IS NULL AND role NOT IN ('super_admin', 'viewer')
       AND email IS NOT NULL AND email <> ''
     ORDER BY name`,
  );
  return result.rows;
}

module.exports = {
  buildWeeklySalesStatusHtml,
  combineReportsHtml,
  fetchUserWeeklyKpis,
  getManagementRecipients,
  listReportableTeamMembers,
};
