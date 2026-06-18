import { leadStatusLabel } from './leadHelpers.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function metricRow(label, value) {
  return `<tr>
    <td style="padding:10px 12px;border-bottom:1px solid #eee;">${escapeHtml(label)}</td>
    <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`;
}

function metricsTable(bodyRows) {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody>${bodyRows}</tbody></table>`;
}

export function getDefaultPerformancePeriod() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return {
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
  };
}

export function buildPerformanceReportHtml({
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
    .map((r) => metricRow(leadStatusLabel(r.label), r.count))
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
      <p style="margin:8px 0 0;font-size:13px;color:#d1d5db;">${escapeHtml(userEmail)} · ${escapeHtml(String(userRole || '').replace(/_/g, ' '))}</p>
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

function inDateRange(value, from, to) {
  if (!value || !from || !to) return false;
  const d = new Date(value);
  const start = new Date(from);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

function countByStatus(leads, from, to) {
  const map = new Map();
  for (const lead of leads) {
    if (!inDateRange(lead.created_at, from, to)) continue;
    const key = lead.lead_status || lead.status || 'none';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export async function buildPerformanceSummaryClientSide(userId, periodStart, periodEnd, {
  leads = [],
  contacts = [],
  accounts = [],
  deals = [],
  tasks = [],
  calls = [],
} = {}) {
  const ownedLeads = leads.filter((l) => String(l.owner_id) === String(userId));
  const periodLeads = ownedLeads.filter((l) => inDateRange(l.created_at, periodStart, periodEnd));
  const converted = periodLeads.filter((l) => l.converted || l.is_converted).length;
  const newLeads = periodLeads.length;
  const conversionRate = newLeads > 0 ? ((converted / newLeads) * 100).toFixed(1) : '0.0';

  const wonDeals = deals.filter((d) => {
    if (String(d.owner_id) !== String(userId)) return false;
    const stage = String(d.stage_value || d.stage || '').toLowerCase();
    return stage.includes('won') && inDateRange(d.updated_at || d.close_date, periodStart, periodEnd);
  });

  return {
    total_leads_owned: ownedLeads.length,
    new_leads: newLeads,
    leads_by_status: countByStatus(ownedLeads, periodStart, periodEnd),
    new_contacts: contacts.filter((c) => String(c.owner_id) === String(userId) && inDateRange(c.created_at, periodStart, periodEnd)).length,
    new_accounts: accounts.filter((a) => String(a.owner_id) === String(userId) && inDateRange(a.created_at, periodStart, periodEnd)).length,
    new_deals: deals.filter((d) => String(d.owner_id) === String(userId) && inDateRange(d.created_at, periodStart, periodEnd)).length,
    deals_won: wonDeals.length,
    deals_won_amount: wonDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
    deals_lost: deals.filter((d) => {
      if (String(d.owner_id) !== String(userId)) return false;
      const stage = String(d.stage_value || d.stage || '').toLowerCase();
      return stage.includes('lost') && inDateRange(d.updated_at || d.close_date, periodStart, periodEnd);
    }).length,
    converted_leads: converted,
    conversion_rate: conversionRate,
    tasks_completed: tasks.filter((t) => {
      const assignee = t.assigned_to || t.owner_id;
      const status = String(t.status || '').toLowerCase();
      return String(assignee) === String(userId) && status.includes('complet') && inDateRange(t.updated_at || t.due_date, periodStart, periodEnd);
    }).length,
    calls_logged: calls.filter((c) => String(c.owner_id || c.assigned_to) === String(userId) && inDateRange(c.created_at || c.start_time, periodStart, periodEnd)).length,
  };
}
