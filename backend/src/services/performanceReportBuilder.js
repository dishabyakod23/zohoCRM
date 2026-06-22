const pool = require('../db/pool');
const { isAdmin, normalizeRole, ROLES } = require('../utils/helpers');
const { getMonthlyPlan } = require('./salesPlanTargets');
const {
  buildWeeklySalesStatusHtml,
  combineReportsHtml,
  fetchUserWeeklyKpis,
  getManagementRecipients,
  listReportableTeamMembers,
} = require('./weeklySalesStatusReport');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getDefaultPeriod() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return {
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
  };
}

function periodFilter(col, startIndex = 1) {
  return {
    clause: ` AND ${col} >= $${startIndex}::date AND ${col} < ($${startIndex + 1}::date + INTERVAL '1 day')`,
    params: [],
  };
}

function statusLabel(value) {
  const raw = value || 'none';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function metricRow(label, value) {
  return `<tr>
    <td style="padding:10px 12px;border-bottom:1px solid #eee;">${escapeHtml(label)}</td>
    <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`;
}

function metricsTable(rows) {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tbody>${rows.join('')}</tbody>
  </table>`;
}

function statusTableHtml(rows) {
  if (!rows.length) {
    return '<p style="margin:0;color:#666;font-size:13px;">No leads in this period.</p>';
  }
  const body = rows.map((row) => metricRow(statusLabel(row.label), row.count)).join('');
  return metricsTable(body);
}

function buildPerformanceReportHtml({
  companyName = 'Sales CRM',
  userName,
  userEmail,
  userRole,
  periodStart,
  periodEnd,
  summary = {},
}) {
  const periodLabel = periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : 'Last 30 days';
  const leadsByStatusRows = (summary.leads_by_status || [])
    .map((r) => metricRow(statusLabel(r.label), r.count))
    .join('');
  const highlights = [
    ['Leads owned', summary.total_leads_owned ?? 0],
    ['New leads', summary.new_leads ?? 0],
    ['Contacts', summary.new_contacts ?? 0],
    ['Accounts', summary.new_accounts ?? 0],
    ['Deals created', summary.new_deals ?? 0],
    ['Deals won', summary.deals_won ?? 0],
    ['Revenue won', summary.deals_won_amount != null ? `₹${Number(summary.deals_won_amount).toLocaleString('en-IN')}` : '0'],
    ['Tasks completed', summary.tasks_completed ?? 0],
    ['Calls logged', summary.calls_logged ?? 0],
    ['Conversion rate', summary.conversion_rate != null ? `${summary.conversion_rate}%` : '0%'],
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>Individual Performance Report</title></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
    <div style="background:#111;color:#fff;padding:22px 24px;">
      <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#fca5a5;">Performance Report</div>
      <h1 style="margin:8px 0 0;font-size:22px;">${escapeHtml(userName)}</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#d1d5db;">${escapeHtml(userEmail)} · ${escapeHtml(userRole?.replace(/_/g, ' ') || '')}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#d1d5db;">${escapeHtml(companyName)} · ${escapeHtml(periodLabel)}</p>
    </div>
    <div style="padding:24px;">
      <h2 style="margin:0 0 12px;font-size:16px;color:#b91c1c;">Activity summary</h2>
      <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:8px;margin-bottom:24px;">
        <tr>${highlights.map(([label, value]) => `<td style="padding:10px 8px;text-align:center;">
          <div style="font-size:11px;color:#666;">${escapeHtml(label)}</div>
          <div style="font-size:16px;font-weight:700;margin-top:4px;">${escapeHtml(value)}</div>
        </td>`).join('')}</tr>
      </table>
      <h2 style="margin:0 0 12px;font-size:16px;color:#b91c1c;">New leads by status</h2>
      ${leadsByStatusRows ? metricsTable(leadsByStatusRows) : '<p style="color:#666;font-size:13px;">No new leads.</p>'}
    </div>
    <div style="padding:14px 24px;background:#fafafa;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
      Individual performance report from ${escapeHtml(companyName)} CRM.
    </div>
  </div>
</body>
</html>`;
}

async function getCompanyName() {
  const result = await pool.query(`SELECT value FROM settings WHERE key='weekly_report'`);
  return result.rows[0]?.value?.company_name || 'Sales CRM';
}

async function canAccessUser(requester, targetUserId) {
  const role = normalizeRole(requester.role);
  if (role === ROLES.SUPER_ADMIN) return true;
  if (role === ROLES.SALES_MANAGER) {
    const team = await pool.query(
      `SELECT id FROM users WHERE deleted_at IS NULL AND (manager_id = $1 OR id = $1)`,
      [requester.id]
    );
    return team.rows.some((r) => String(r.id) === String(targetUserId));
  }
  return false;
}

async function listPerformanceUsers(requester) {
  const role = normalizeRole(requester.role);
  let result;
  if (isAdmin(role)) {
    result = await pool.query(
      `SELECT id, name, email, role, manager_id FROM users WHERE deleted_at IS NULL ORDER BY name`
    );
  } else if (role === ROLES.SALES_MANAGER) {
    result = await pool.query(
      `SELECT id, name, email, role, manager_id FROM users
       WHERE deleted_at IS NULL AND (manager_id = $1 OR id = $1)
       ORDER BY name`,
      [requester.id]
    );
  } else {
    return [];
  }
  return result.rows;
}

async function fetchUserPerformance(userId, periodStart, periodEnd) {
  const ownerId = userId;
  const dateParams = [periodStart, periodEnd];
  const periodCreated = `created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day')`;
  const periodUpdated = `updated_at >= $1::date AND updated_at < ($2::date + INTERVAL '1 day')`;

  const [
    userRow,
    totalLeads,
    newLeadsByStatus,
    newLeadsCount,
    converted,
    newContacts,
    newAccounts,
    newDeals,
    dealsWon,
    dealsLost,
    tasksDone,
    callsLogged,
  ] = await Promise.all([
    pool.query(`SELECT id, name, email, role FROM users WHERE id=$1 AND deleted_at IS NULL`, [ownerId]),
    pool.query(`SELECT COUNT(*)::int AS count FROM leads WHERE deleted_at IS NULL AND owner_id=$1`, [ownerId]),
    pool.query(
      `SELECT COALESCE(status, 'none') AS label, COUNT(*)::int AS count
       FROM leads WHERE deleted_at IS NULL AND owner_id=$3 AND ${periodCreated}
       GROUP BY status ORDER BY count DESC`,
      [...dateParams, ownerId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM leads WHERE deleted_at IS NULL AND owner_id=$3 AND ${periodCreated}`,
      [...dateParams, ownerId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM leads
       WHERE deleted_at IS NULL AND owner_id=$3 AND converted=true AND converted_at >= $1::date AND converted_at < ($2::date + INTERVAL '1 day')`,
      [...dateParams, ownerId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM contacts WHERE deleted_at IS NULL AND owner_id=$3 AND ${periodCreated}`,
      [...dateParams, ownerId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM accounts WHERE deleted_at IS NULL AND owner_id=$3 AND ${periodCreated}`,
      [...dateParams, ownerId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM deals WHERE deleted_at IS NULL AND owner_id=$3 AND ${periodCreated}`,
      [...dateParams, ownerId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount),0)::numeric AS total FROM deals
       WHERE deleted_at IS NULL AND owner_id=$3 AND stage IN ('closed_won','Closed Won')
         AND ${periodUpdated}`,
      [...dateParams, ownerId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM deals
       WHERE deleted_at IS NULL AND owner_id=$3 AND stage IN ('closed_lost','Closed Lost')
         AND ${periodUpdated}`,
      [...dateParams, ownerId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM tasks
       WHERE deleted_at IS NULL AND assigned_to=$3 AND status IN ('Completed','completed','done')
         AND ${periodUpdated}`,
      [...dateParams, ownerId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM calls
       WHERE deleted_at IS NULL AND COALESCE(owner_id, assigned_to)=$3 AND ${periodCreated}`,
      [...dateParams, ownerId]
    ),
  ]);

  const user = userRow.rows[0];
  if (!user) return null;

  const newLeads = newLeadsCount.rows[0].count;
  const convertedCount = converted.rows[0].count;
  const conversionRate = newLeads > 0 ? ((convertedCount / newLeads) * 100).toFixed(1) : '0.0';

  const summary = {
    total_leads_owned: totalLeads.rows[0].count,
    new_leads: newLeads,
    leads_by_status: newLeadsByStatus.rows,
    new_contacts: newContacts.rows[0].count,
    new_accounts: newAccounts.rows[0].count,
    new_deals: newDeals.rows[0].count,
    deals_won: dealsWon.rows[0].count,
    deals_won_amount: Number(dealsWon.rows[0].total || 0),
    deals_lost: dealsLost.rows[0].count,
    converted_leads: convertedCount,
    conversion_rate: conversionRate,
    tasks_completed: tasksDone.rows[0].count,
    calls_logged: callsLogged.rows[0].count,
  };

  return { user, summary };
}

async function buildPerformanceReportPreview(userId, periodStart, periodEnd, { preparedBy } = {}) {
  const start = periodStart || getDefaultPeriod().period_start;
  const end = periodEnd || getDefaultPeriod().period_end;
  const companyName = await getCompanyName();
  const data = await fetchUserPerformance(userId, start, end);
  if (!data) return null;

  const kpis = await fetchUserWeeklyKpis(userId, start, end);
  const summary = { ...data.summary, ...kpis };

  const html_body = buildWeeklySalesStatusHtml({
    companyName,
    userName: data.user.name,
    userEmail: data.user.email,
    userRole: data.user.role,
    periodStart: start,
    periodEnd: end,
    preparedBy: preparedBy || companyName,
    reportDate: new Date().toISOString().slice(0, 10),
    kpis: summary,
    monthlyPlan: getMonthlyPlan(end),
  });

  return {
    user: data.user,
    period_start: start,
    period_end: end,
    company_name: companyName,
    summary,
    html_body,
    recipients: await getManagementRecipients(),
  };
}

async function logPerformanceReport({
  userId,
  recipientEmail,
  sentById,
  periodStart,
  periodEnd,
  status,
  errorMessage = null,
}) {
  await pool.query(
    `INSERT INTO performance_report_logs
      (user_id, recipient_email, sent_by_id, report_period_start, report_period_end, status, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, recipientEmail, sentById, periodStart, periodEnd, status, errorMessage]
  );
}

async function sendPerformanceReport({ userId, periodStart, periodEnd, sentBy }) {
  const preview = await buildPerformanceReportPreview(userId, periodStart, periodEnd, {
    preparedBy: sentBy?.name || sentBy?.email,
  });
  if (!preview?.user) {
    return { sent_count: 0, failed_count: 1, message: 'User not found.' };
  }

  const recipients = await getManagementRecipients();
  if (!recipients.length) {
    return { sent_count: 0, failed_count: 1, message: 'No admin or sales manager recipients found.' };
  }

  let sentCount = 0;
  let failedCount = 0;
  const recipientEmails = [];

  for (const recipient of recipients) {
    try {
      await logPerformanceReport({
        userId: preview.user.id,
        recipientEmail: recipient.email,
        sentById: sentBy?.id || null,
        periodStart: preview.period_start,
        periodEnd: preview.period_end,
        status: 'sent',
      });
      sentCount += 1;
      recipientEmails.push(recipient.email);
    } catch (err) {
      failedCount += 1;
      await logPerformanceReport({
        userId: preview.user.id,
        recipientEmail: recipient.email,
        sentById: sentBy?.id || null,
        periodStart: preview.period_start,
        periodEnd: preview.period_end,
        status: 'failed',
        errorMessage: err.message,
      });
    }
  }

  return {
    sent_count: sentCount,
    failed_count: failedCount,
    message: `Performance report for ${preview.user.name} sent to ${recipientEmails.join(', ')}`,
    html_body: preview.html_body,
    summary: preview.summary,
    user: preview.user,
    recipients,
  };
}

module.exports = {
  buildPerformanceReportHtml,
  buildPerformanceReportPreview,
  sendPerformanceReport,
  listPerformanceUsers,
  canAccessUser,
  getDefaultPeriod,
  fetchUserPerformance,
  getManagementRecipients,
  listReportableTeamMembers,
};
