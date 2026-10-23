import { PIPELINE_PROPOSAL } from './pipelineHelpers.js';
import { normalizeRole } from './roles.js';
import { userDisplayName } from './userHelpers.js';
import { convertToInr, FALLBACK_RATES_TO_INR } from './fxRates.js';
import { matchesDateRange } from './listRecordFilters.js';
import * as leadsApi from './services/leads.js';
import { fetchUsers } from './services/lookups.js';

/** Roles shown on the dashboard pipeline leaderboard: BDE = sales_rep, BDM = sales_manager. */
export const PIPELINE_LEADERBOARD_ROLES = {
  sales_rep: 'BDE',
  sales_manager: 'BDM',
};

function isInactive(record) {
  return record?.is_active === false || String(record?.status || '').toLowerCase() === 'inactive';
}

function leaderboardPipelineAmount(item = {}) {
  const value = item.actual_pipeline ?? item.pipeline_actual ?? item.pipeline_value ?? item.actuals?.actual_pipeline;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function leaderboardEmployeeId(item = {}) {
  return String(item.employee_id || item.id || item.user_id || '');
}

function roleShortLabel(role) {
  const key = normalizeRole(role);
  return PIPELINE_LEADERBOARD_ROLES[key] || null;
}

function isPipelineLeaderboardRole(role) {
  return Boolean(roleShortLabel(role));
}

function sortLeaderboard(rows = []) {
  return [...rows].sort((a, b) => leaderboardPipelineAmount(b) - leaderboardPipelineAmount(a));
}

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function calendarMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

export function currentMonthProposalsHref(now = new Date()) {
  const { from, to } = calendarMonthRange(now);
  return `/proposals?proposal_date_from=${from}&proposal_date_to=${to}`;
}

function proposalMonthDate(lead) {
  return lead?.proposal_date || lead?.created_at || '';
}

export function filterProposalsInCalendarMonth(proposals = [], now = new Date()) {
  const { from, to } = calendarMonthRange(now);
  return (proposals || []).filter((lead) => matchesDateRange(proposalMonthDate(lead), from, to));
}

function targetCoversDate(target, now = new Date()) {
  const start = target?.start_date ? new Date(target.start_date) : null;
  const end = target?.end_date ? new Date(target.end_date) : null;
  if (start && Number.isNaN(start.getTime())) return false;
  if (end && Number.isNaN(end.getTime())) return false;
  if (start && start > now) return false;
  if (end) {
    const endDay = new Date(end);
    endDay.setHours(23, 59, 59, 999);
    if (now > endDay) return false;
  }
  return true;
}

export function pipelineAchievementStatus(pct, target) {
  const targetNum = Number(target) || 0;
  if (targetNum <= 0) return { label: 'No Target', tone: 'muted' };
  if (pct >= 100) return { label: 'Over Target', tone: 'over' };
  if (pct >= 40) return { label: 'Below Target', tone: 'warn' };
  return { label: 'Below Target', tone: 'under' };
}

export function buildPipelineAchievementRows(leaderboard = [], {
  monthPipelineByOwner,
  targetsByEmployeeId = {},
} = {}) {
  const rows = (leaderboard || []).map((row) => {
    const id = String(row.employee_id || row.id || '');
    const actual = monthPipelineByOwner
      ? Number(monthPipelineByOwner.get(id) || 0)
      : Number(row.actual_pipeline || row.pipeline_actual || 0);
    const target = Number(
      targetsByEmployeeId[id]?.pipeline_target
      ?? row.pipeline_target
      ?? 0
    );
    const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
    const status = pipelineAchievementStatus(pct, target);
    const role = normalizeRole(row.role) || 'sales_rep';
    return {
      employee_id: id,
      employee_name: row.employee_name || row.name || '—',
      role,
      role_label: row.role_label || roleShortLabel(role) || 'BDE',
      achieved_pipeline: Math.round(actual),
      pipeline_target: Math.round(target),
      achievement_pct: pct,
      status_label: status.label,
      status_tone: status.tone,
    };
  });
  return rows.sort((a, b) => {
    const roleDelta = Number(a.role === 'sales_manager') - Number(b.role === 'sales_manager');
    if (roleDelta !== 0) return roleDelta;
    return b.achieved_pipeline - a.achieved_pipeline;
  });
}

function indexMonthlyTargets(monthlyTargets = [], now = new Date()) {
  const byEmployee = {};
  for (const target of monthlyTargets || []) {
    const id = String(target.employee_id || '');
    if (!id || !targetCoversDate(target, now)) continue;
    const period = String(target.period_type || 'monthly').toLowerCase();
    if (period && period !== 'monthly') continue;
    const next = Number(target.pipeline_target || 0);
    const current = Number(byEmployee[id]?.pipeline_target || 0);
    if (next >= current) byEmployee[id] = target;
  }
  return byEmployee;
}

/** Sum open proposal deal sizes in INR, grouped by owner. */
export async function buildProposalPipelineInrByOwner(proposals = []) {
  const totals = new Map();
  for (const lead of proposals || []) {
    const ownerId = lead?.owner_id;
    if (!ownerId) continue;
    const key = String(ownerId);
    const amount = Number(lead.deal_size ?? lead.proposal_amount);
    const currency = lead.currency || 'INR';
    // Company book rate — live FX differs per browser/network and made dashboards disagree.
    const inr = convertToInr(amount, currency, FALLBACK_RATES_TO_INR);
    totals.set(key, (totals.get(key) || 0) + inr);
  }
  return totals;
}

/**
 * Fill BDE + BDM pipeline leaderboard from CRM proposals when the dashboard API
 * returns zero (common for USD proposals before backend FX conversion).
 */
export async function enrichSalesTargetDashboard(summary = {}, {
  listProposals = () => leadsApi.listAllLeads({ pipeline_stage: PIPELINE_PROPOSAL }, []),
  loadUsers = fetchUsers,
  monthlyTargets = [],
  now = new Date(),
} = {}) {
  const [{ data: proposals = [] }, users] = await Promise.all([
    listProposals().catch(() => ({ data: [] })),
    loadUsers().catch(() => []),
  ]);

  const pipelineByOwner = await buildProposalPipelineInrByOwner(proposals);
  const usersById = new Map((users || []).map((u) => [String(u.id), u]));
  const haveUsers = usersById.size > 0;
  const leaderboardMap = new Map();

  for (const item of summary.bde_leaderboard || summary.pipeline_leaderboard || []) {
    const id = leaderboardEmployeeId(item);
    if (!id || isInactive(item)) continue;
    const user = usersById.get(id);
    // Users missing from /lookups/users are inactive or deleted.
    if (haveUsers && !user) continue;
    if (user && (isInactive(user) || !isPipelineLeaderboardRole(user.role))) continue;
    const role = normalizeRole(user?.role || item.role || 'sales_rep');
    if (!isPipelineLeaderboardRole(role)) continue;
    leaderboardMap.set(id, {
      ...item,
      employee_id: id,
      role,
      role_label: roleShortLabel(role),
    });
  }

  for (const user of users) {
    if (isInactive(user) || !isPipelineLeaderboardRole(user.role)) continue;
    const id = String(user.id);
    const crmPipeline = pipelineByOwner.get(id) || 0;
    const existing = leaderboardMap.get(id) || {};
    const apiPipeline = leaderboardPipelineAmount(existing);
    const actual = crmPipeline > 0 ? crmPipeline : apiPipeline;
    const role = normalizeRole(user.role);

    leaderboardMap.set(id, {
      ...existing,
      employee_id: user.id,
      employee_name: existing.employee_name || existing.name || userDisplayName(user),
      role,
      role_label: roleShortLabel(role),
      actual_pipeline: String(Math.round(actual)),
      pipeline_actual: String(Math.round(actual)),
    });
  }

  // Users list unavailable: still rank proposal owners as BDE rather than dropping the panel.
  if (!haveUsers) {
    for (const [ownerId, crmPipeline] of pipelineByOwner) {
      if (leaderboardMap.has(ownerId)) continue;
      leaderboardMap.set(ownerId, {
        employee_id: ownerId,
        employee_name: 'Unknown',
        role: 'sales_rep',
        role_label: 'BDE',
        actual_pipeline: String(Math.round(crmPipeline)),
        pipeline_actual: String(Math.round(crmPipeline)),
      });
    }
  }

  const pipeline_leaderboard = sortLeaderboard([...leaderboardMap.values()]);
  const bde_leaderboard = pipeline_leaderboard.filter((row) => normalizeRole(row.role) === 'sales_rep');
  const bdm_leaderboard = pipeline_leaderboard.filter((row) => normalizeRole(row.role) === 'sales_manager');

  const crmTotalPipeline = [...pipelineByOwner.values()].reduce((sum, value) => sum + value, 0);
  const monthProposals = filterProposalsInCalendarMonth(proposals, now);
  const monthByOwner = await buildProposalPipelineInrByOwner(monthProposals);
  const crmMonthPipeline = [...monthByOwner.values()].reduce((sum, value) => sum + value, 0);
  const apiMonthly = Number(summary.monthly_pipeline_actual || 0);
  const targetsByEmployeeId = indexMonthlyTargets(monthlyTargets, now);
  const pipeline_achievement = buildPipelineAchievementRows(pipeline_leaderboard, {
    monthPipelineByOwner: monthByOwner,
    targetsByEmployeeId,
  });

  return {
    ...summary,
    overall_pipeline_actual: String(Math.round(crmTotalPipeline)),
    monthly_pipeline_actual: String(Math.round(crmMonthPipeline || (crmTotalPipeline > 0 ? 0 : apiMonthly))),
    pipeline_month_label: now.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
    current_month_proposals_href: currentMonthProposalsHref(now),
    pipeline_achievement,
    // Keep legacy key for callers; includes active BDE + BDM sorted by pipeline.
    bde_leaderboard: pipeline_leaderboard,
    pipeline_leaderboard,
    bde_only_leaderboard: bde_leaderboard,
    bdm_leaderboard,
  };
}
