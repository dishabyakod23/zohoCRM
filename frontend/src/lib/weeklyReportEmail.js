import { leadStatusLabel } from './leadHelpers.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function normalizeStatusRows(rows) {
  return (rows || [])
    .map((row) => {
      const raw = row.label ?? row.status ?? row.key ?? 'none';
      const count = Number(row.count ?? 0);
      return {
        raw,
        label: leadStatusLabel(raw),
        count,
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

/** Build weekly report HTML with leads-by-status as the primary content. */
export function buildWeeklyReportHtml({
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
