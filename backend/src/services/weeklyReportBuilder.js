const pool = require('../db/pool');
const { SYSTEM_LEAD_STATUSES } = require('../utils/leadStatusStore');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusLabel(value, options = []) {
  const raw = value || 'none';
  const match = options.find((o) => o.value === raw);
  if (match) return match.label;
  const system = SYSTEM_LEAD_STATUSES.find((s) => s.value === raw);
  if (system) return system.label;
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeStatusRows(rows, statusOptions) {
  return (rows || [])
    .map((row) => {
      const raw = row.label ?? row.status ?? row.key ?? 'none';
      return {
        raw,
        label: statusLabel(raw, statusOptions),
        count: Number(row.count ?? 0),
      };
    })
    .sort((a, b) => b.count - a.count);
}

function totalCount(rows) {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

function statusTableHtml(rows, { emptyLabel = 'No leads' } = {}) {
  if (!rows.length) {
    return `<p style="margin:0;color:#666;font-size:13px;">${escapeHtml(emptyLabel)}</p>`;
  }

  const total = totalCount(rows);
  const body = rows.map((row) => {
    const pct = total > 0 ? ((row.count / total) * 100).toFixed(1) : '0.0';
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;">${escapeHtml(row.label)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${row.count}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;color:#666;">${pct}%</td>
    </tr>`;
  }).join('');

  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead>
      <tr style="background:#fafafa;">
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;">Status</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;">Count</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;">Share</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
    <tfoot>
      <tr style="background:#111;color:#fff;">
        <td style="padding:10px 12px;font-weight:600;">Total</td>
        <td style="padding:10px 12px;text-align:right;font-weight:600;">${total}</td>
        <td style="padding:10px 12px;text-align:right;">100%</td>
      </tr>
    </tfoot>
  </table>`;
}

function miniStat(label, value) {
  return `<td style="padding:8px 12px;text-align:center;">
    <div style="font-size:11px;color:#666;">${escapeHtml(label)}</div>
    <div style="font-size:18px;font-weight:700;margin-top:4px;">${escapeHtml(value ?? 0)}</div>
  </td>`;
}

function buildWeeklyReportHtml({
  companyName = 'Sales CRM',
  periodStart,
  periodEnd,
  leadsByStatusAll = [],
  newLeadsByStatus = [],
  summary = {},
}) {
  const allRows = normalizeStatusRows(leadsByStatusAll);
  const weekRows = normalizeStatusRows(newLeadsByStatus);
  const periodLabel = periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : 'Last 7 days';

  const highlights = [
    ['New leads', summary.new_leads_total ?? totalCount(weekRows)],
    ['Converted', summary.converted_leads ?? 0],
    ['Deals won', summary.deals_won_count ?? 0],
    ['Tasks done', summary.tasks_completed ?? 0],
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Weekly Lead Status Report</title>
</head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
    <div style="background:#111111;color:#ffffff;padding:22px 24px;">
      <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#fca5a5;">Weekly Report</div>
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">Leads by Status</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#d1d5db;">${escapeHtml(companyName)} · ${escapeHtml(periodLabel)}</p>
    </div>

    <div style="padding:24px;">
      <h2 style="margin:0 0 12px;font-size:16px;color:#b91c1c;">Current pipeline — all leads by status</h2>
      <p style="margin:0 0 14px;font-size:13px;color:#6b7280;">Total active leads grouped by their current status.</p>
      ${statusTableHtml(allRows, { emptyLabel: 'No leads in the pipeline.' })}

      <h2 style="margin:28px 0 12px;font-size:16px;color:#b91c1c;">This week — new leads by status</h2>
      <p style="margin:0 0 14px;font-size:13px;color:#6b7280;">Leads created during the reporting period, broken down by status.</p>
      ${statusTableHtml(weekRows, { emptyLabel: 'No new leads were created this week.' })}

      <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb;">
        <div style="font-size:12px;color:#6b7280;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;">Other highlights</div>
        <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:8px;">
          <tr>${highlights.map(([label, value]) => miniStat(label, value)).join('')}</tr>
        </table>
      </div>
    </div>

    <div style="padding:14px 24px;background:#fafafa;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
      Generated automatically by ${escapeHtml(companyName)} CRM.
    </div>
  </div>
</body>
</html>`;
}

function getReportPeriod() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  return {
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
  };
}

async function getWeeklyReportSettings() {
  const result = await pool.query(`SELECT value FROM settings WHERE key='weekly_report'`);
  return result.rows[0]?.value || {};
}

async function fetchWeeklyReportData(periodStart, periodEnd) {
  const weekFilter = `created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day')`;

  const [
    allByStatus,
    weekByStatus,
    converted,
    dealsWon,
    tasksDone,
  ] = await Promise.all([
    pool.query(
      `SELECT COALESCE(status, 'none') AS label, COUNT(*)::int AS count
       FROM leads WHERE deleted_at IS NULL
       GROUP BY status ORDER BY count DESC`
    ),
    pool.query(
      `SELECT COALESCE(status, 'none') AS label, COUNT(*)::int AS count
       FROM leads WHERE deleted_at IS NULL AND ${weekFilter}
       GROUP BY status ORDER BY count DESC`,
      [periodStart, periodEnd]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM leads
       WHERE converted = true AND deleted_at IS NULL
         AND converted_at >= $1::date AND converted_at < ($2::date + INTERVAL '1 day')`,
      [periodStart, periodEnd]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM deals
       WHERE stage = 'Closed Won' AND deleted_at IS NULL
         AND updated_at >= $1::date AND updated_at < ($2::date + INTERVAL '1 day')`,
      [periodStart, periodEnd]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM tasks
       WHERE status = 'Completed'
         AND updated_at >= $1::date AND updated_at < ($2::date + INTERVAL '1 day')`,
      [periodStart, periodEnd]
    ),
  ]);

  const leadsByStatusAll = allByStatus.rows;
  const newLeadsByStatus = weekByStatus.rows;

  return {
    leads_by_status: leadsByStatusAll,
    new_leads_by_status: newLeadsByStatus,
    new_leads_total: totalCount(newLeadsByStatus),
    total_leads: totalCount(leadsByStatusAll),
    converted_leads: converted.rows[0].count,
    deals_won_count: dealsWon.rows[0].count,
    tasks_completed: tasksDone.rows[0].count,
  };
}

async function buildWeeklyReportPreview() {
  const settings = await getWeeklyReportSettings();
  const companyName = settings.company_name || 'Sales CRM';
  const { period_start, period_end } = getReportPeriod();
  const reportData = await fetchWeeklyReportData(period_start, period_end);
  const summary = {
    leads_by_status: reportData.leads_by_status,
    new_leads_by_status: reportData.new_leads_by_status,
    new_leads_total: reportData.new_leads_total,
    total_leads: reportData.total_leads,
    converted_leads: reportData.converted_leads,
    deals_won_count: reportData.deals_won_count,
    tasks_completed: reportData.tasks_completed,
  };
  const html_body = buildWeeklyReportHtml({
    companyName,
    periodStart: period_start,
    periodEnd: period_end,
    leadsByStatusAll: reportData.leads_by_status,
    newLeadsByStatus: reportData.new_leads_by_status,
    summary,
  });

  return {
    period_start,
    period_end,
    company_name: companyName,
    html_body,
    summary,
  };
}

function isRecipientEligible(user, settings) {
  if (!user?.email || user.deleted_at) return false;
  const excluded = new Set(settings.excluded_user_ids || []);
  if (excluded.has(user.id)) return false;
  if (user.role === 'super_admin' && settings.super_admin_enabled !== false) return true;
  if (user.role === 'sales_manager' && settings.sales_manager_enabled !== false) return true;
  return false;
}

async function getWeeklyReportRecipients(settings) {
  const result = await pool.query(
    `SELECT id, email, name, role FROM users
     WHERE deleted_at IS NULL AND weekly_report_enabled = true
       AND role IN ('super_admin', 'sales_manager')
     ORDER BY name`
  );
  return result.rows.filter((user) => isRecipientEligible(user, settings));
}

async function logWeeklyReportDelivery({
  recipient,
  periodStart,
  periodEnd,
  status,
  triggerType,
  errorMessage = null,
}) {
  await pool.query(
    `INSERT INTO weekly_report_logs
      (recipient_email, recipient_id, status, report_period_start, report_period_end, trigger_type, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      recipient.email,
      recipient.id,
      status,
      periodStart,
      periodEnd,
      triggerType,
      errorMessage,
    ]
  );
}

async function sendWeeklyReport({ triggerType = 'manual' } = {}) {
  const settings = await getWeeklyReportSettings();
  if (settings.enabled === false) {
    return {
      sent_count: 0,
      failed_count: 0,
      message: 'Weekly reports are disabled in settings.',
    };
  }

  const preview = await buildWeeklyReportPreview();
  const recipients = await getWeeklyReportRecipients(settings);

  if (!recipients.length) {
    return {
      sent_count: 0,
      failed_count: 0,
      message: 'No eligible recipients found for the weekly report.',
    };
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    try {
      await logWeeklyReportDelivery({
        recipient,
        periodStart: preview.period_start,
        periodEnd: preview.period_end,
        status: 'sent',
        triggerType,
      });
      sentCount += 1;
    } catch (err) {
      failedCount += 1;
      await logWeeklyReportDelivery({
        recipient,
        periodStart: preview.period_start,
        periodEnd: preview.period_end,
        status: 'failed',
        triggerType,
        errorMessage: err.message,
      });
    }
  }

  const emails = recipients.map((u) => u.email).join(', ');
  return {
    sent_count: sentCount,
    failed_count: failedCount,
    message: `Weekly lead status report queued for ${sentCount} recipient(s): ${emails}`,
    html_body: preview.html_body,
    summary: preview.summary,
  };
}

module.exports = {
  buildWeeklyReportHtml,
  buildWeeklyReportPreview,
  sendWeeklyReport,
  fetchWeeklyReportData,
  getReportPeriod,
};
