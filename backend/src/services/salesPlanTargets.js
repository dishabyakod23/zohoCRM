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

function monthKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthlyPlan(date = new Date()) {
  return MONTHLY_PLAN[monthKey(date)] || DEFAULT_MONTHLY;
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

module.exports = {
  MONTHLY_PLAN,
  getMonthlyPlan,
  weeklyFromMonthly,
  achievementStatus,
  formatMoney,
  monthKey,
};
