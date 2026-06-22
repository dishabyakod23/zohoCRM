const MONTHLY_PLAN = {
  '2026-06': { revenue: 10000, pipeline: 60000, newLeads: 250, prospects: 150, coldCalls: 75, emails: 150, linkedin: 60, followups: 80, qualifiedMeetings: 5, proposals: 2 },
  '2026-07': { revenue: 20000, pipeline: 100000, newLeads: 800, prospects: 500, coldCalls: 600, emails: 1000, linkedin: 300, followups: 400, qualifiedMeetings: 16, proposals: 5 },
  '2026-08': { revenue: 40000, pipeline: 180000, newLeads: 1800, prospects: 1200, coldCalls: 1800, emails: 3000, linkedin: 900, followups: 1200, qualifiedMeetings: 32, proposals: 10 },
  '2026-09': { revenue: 55000, pipeline: 230000, newLeads: 2100, prospects: 1450, coldCalls: 2100, emails: 3500, linkedin: 1050, followups: 1500, qualifiedMeetings: 40, proposals: 13 },
  '2026-10': { revenue: 65000, pipeline: 270000, newLeads: 2400, prospects: 1650, coldCalls: 2400, emails: 4000, linkedin: 1200, followups: 1750, qualifiedMeetings: 45, proposals: 15 },
  '2026-11': { revenue: 70000, pipeline: 300000, newLeads: 2600, prospects: 1800, coldCalls: 2600, emails: 4300, linkedin: 1300, followups: 1900, qualifiedMeetings: 50, proposals: 16 },
  '2026-12': { revenue: 75000, pipeline: 320000, newLeads: 2600, prospects: 1750, coldCalls: 2400, emails: 4000, linkedin: 1200, followups: 1800, qualifiedMeetings: 50, proposals: 16 },
  '2027-01': { revenue: 80000, pipeline: 340000, newLeads: 2800, prospects: 1900, coldCalls: 2800, emails: 4600, linkedin: 1400, followups: 2000, qualifiedMeetings: 55, proposals: 18 },
  '2027-02': { revenue: 90000, pipeline: 380000, newLeads: 3000, prospects: 2050, coldCalls: 3000, emails: 5000, linkedin: 1500, followups: 2200, qualifiedMeetings: 60, proposals: 20 },
  '2027-03': { revenue: 110000, pipeline: 450000, newLeads: 3300, prospects: 2300, coldCalls: 3300, emails: 5500, linkedin: 1650, followups: 2500, qualifiedMeetings: 70, proposals: 24 },
  '2027-04': { revenue: 135000, pipeline: 540000, newLeads: 3600, prospects: 2500, coldCalls: 3600, emails: 6000, linkedin: 1800, followups: 2800, qualifiedMeetings: 80, proposals: 28 },
};

const DEFAULT_MONTHLY = {
  revenue: 20000, pipeline: 100000, newLeads: 200, prospects: 120, coldCalls: 100, emails: 200, linkedin: 75, followups: 100, qualifiedMeetings: 8, proposals: 3,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getMonthlyPlan(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return MONTHLY_PLAN[key] || DEFAULT_MONTHLY;
}

function weeklyFromMonthly(monthly) {
  const divisor = 4;
  return {
    revenue: Math.round(monthly.revenue / divisor),
    pipeline: Math.round(monthly.pipeline / divisor),
    newLeads: Math.round(monthly.newLeads / divisor),
    prospects: Math.round(monthly.prospects / divisor),
    coldCalls: Math.round(monthly.coldCalls / divisor),
    emails: Math.round(monthly.emails / divisor),
    linkedin: Math.round(monthly.linkedin / divisor),
    followups: Math.round(monthly.followups / divisor),
    qualifiedMeetings: Math.round(monthly.qualifiedMeetings / divisor),
    proposals: Math.round(monthly.proposals / divisor),
  };
}

function achievementStatus(actual, target) {
  const pct = target > 0 ? (Number(actual) / Number(target)) * 100 : (Number(actual) > 0 ? 100 : 0);
  if (pct >= 80) return { pct: Math.round(pct), status: 'On Track' };
  if (pct >= 50) return { pct: Math.round(pct), status: 'At Risk' };
  return { pct: Math.round(pct), status: 'Off Track' };
}

function formatMoney(value, currency = 'USD') {
  const n = Number(value) || 0;
  if (currency === 'INR') return `₹${n.toLocaleString('en-IN')}`;
  return `$${n.toLocaleString('en-US')}`;
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

export function getDefaultPerformancePeriod() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  return {
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
  };
}

export function buildPerformanceReportHtml({
  companyName = 'Origami Consulting LLC',
  userName,
  userEmail,
  userRole,
  periodStart,
  periodEnd,
  preparedBy,
  reportDate,
  summary = {},
  currency = 'USD',
}) {
  const monthly = getMonthlyPlan(periodEnd || new Date());
  const weekly = weeklyFromMonthly(monthly);
  const monthLabel = periodEnd ? new Date(periodEnd).toLocaleString('en-US', { month: 'long', year: 'numeric' }) : '';
  const revenueMtd = Number(summary.revenue_mtd || summary.deals_won_amount || 0);
  const monthlyGap = Math.max(0, monthly.revenue - revenueMtd);

  const rows = [
    ['New Leads Added', weekly.newLeads, summary.new_leads ?? 0],
    ['Prospects Contacted', weekly.prospects, summary.prospects_contacted ?? 0],
    ['Cold Calls Completed', weekly.coldCalls, summary.cold_calls ?? summary.calls_logged ?? 0],
    ['Emails Sent', weekly.emails, summary.emails_sent ?? 0],
    ['LinkedIn Outreach', weekly.linkedin, summary.linkedin_outreach ?? 0],
    ['Follow-ups Completed', weekly.followups, summary.follow_ups ?? summary.tasks_completed ?? 0],
    ['Qualified Meetings Booked', weekly.qualifiedMeetings, summary.qualified_meetings ?? 0],
    ['Meetings Completed', weekly.qualifiedMeetings, summary.meetings_completed ?? 0],
    ['Proposals Sent', weekly.proposals, summary.proposals_sent ?? 0],
    ['Pipeline Value Added ($)', formatMoney(weekly.pipeline, currency), formatMoney(summary.pipeline_value || 0, currency)],
    ['Deals Closed ($)', formatMoney(weekly.revenue, currency), formatMoney(summary.deals_closed_amount || summary.deals_won_amount || 0, currency)],
    ['Revenue Collected ($)', formatMoney(weekly.revenue, currency), formatMoney(summary.revenue_collected || summary.deals_won_amount || 0, currency)],
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

function inDateRange(value, from, to) {
  if (!value || !from || !to) return false;
  const d = new Date(value);
  const start = new Date(from);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
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

  const outboundCalls = calls.filter((c) => {
    if (String(c.owner_id || c.assigned_to) !== String(userId)) return false;
    return String(c.call_type || '').toLowerCase().includes('out') && inDateRange(c.created_at || c.start_time, periodStart, periodEnd);
  });

  const linkedinLeads = periodLeads.filter((l) => String(l.source || l.lead_source || '').toLowerCase().includes('linkedin'));
  const proposals = periodLeads.filter((l) => String(l.source || l.lead_source || '').toLowerCase().includes('proposal'));
  const qualified = periodLeads.filter((l) => String(l.lead_status || l.status || '').toLowerCase().includes('qualified'));
  const contacted = ownedLeads.filter((l) => {
    const st = String(l.lead_status || l.status || '').toLowerCase();
    return (st.includes('contact') || st.includes('attempt')) && inDateRange(l.updated_at || l.created_at, periodStart, periodEnd);
  });

  const tasksDone = tasks.filter((t) => {
    const assignee = t.assigned_to || t.owner_id;
    const status = String(t.status || '').toLowerCase();
    return String(assignee) === String(userId) && status.includes('complet') && inDateRange(t.updated_at || t.due_date, periodStart, periodEnd);
  });

  const pipelineDeals = deals.filter((d) => {
    if (String(d.owner_id) !== String(userId)) return false;
    const stage = String(d.stage_value || d.stage || '').toLowerCase();
    return !stage.includes('won') && !stage.includes('lost') && inDateRange(d.created_at, periodStart, periodEnd);
  });

  const wonAmount = wonDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return {
    total_leads_owned: ownedLeads.length,
    new_leads: newLeads,
    prospects_contacted: contacted.length,
    cold_calls: outboundCalls.length,
    emails_sent: 0,
    linkedin_outreach: linkedinLeads.length,
    follow_ups: tasksDone.length,
    qualified_meetings: qualified.length,
    meetings_completed: 0,
    proposals_sent: proposals.length,
    pipeline_value: pipelineDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
    deals_closed_amount: wonAmount,
    revenue_collected: wonAmount,
    revenue_mtd: wonAmount,
    new_contacts: contacts.filter((c) => String(c.owner_id) === String(userId) && inDateRange(c.created_at, periodStart, periodEnd)).length,
    new_accounts: accounts.filter((a) => String(a.owner_id) === String(userId) && inDateRange(a.created_at, periodStart, periodEnd)).length,
    new_deals: deals.filter((d) => String(d.owner_id) === String(userId) && inDateRange(d.created_at, periodStart, periodEnd)).length,
    deals_won: wonDeals.length,
    deals_won_amount: wonAmount,
    converted_leads: converted,
    conversion_rate: conversionRate,
    tasks_completed: tasksDone.length,
    calls_logged: outboundCalls.length,
  };
}
