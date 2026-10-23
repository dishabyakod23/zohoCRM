import { PIPELINE_PROPOSAL } from './pipelineHelpers.js';
import { normalizeRole } from './roles.js';
import { userDisplayName } from './userHelpers.js';
import { convertToInr, FALLBACK_RATES_TO_INR } from './fxRates.js';
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
  const apiMonthly = Number(summary.monthly_pipeline_actual || 0);

  return {
    ...summary,
    monthly_pipeline_actual: String(crmTotalPipeline > 0 ? Math.round(crmTotalPipeline) : apiMonthly),
    // Keep legacy key for callers; includes active BDE + BDM sorted by pipeline.
    bde_leaderboard: pipeline_leaderboard,
    pipeline_leaderboard,
    bde_only_leaderboard: bde_leaderboard,
    bdm_leaderboard,
  };
}
