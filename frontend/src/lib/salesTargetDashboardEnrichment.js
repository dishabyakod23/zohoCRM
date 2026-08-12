import { PIPELINE_PROPOSAL } from './pipelineHelpers.js';
import { normalizeRole } from './roles.js';
import { userDisplayName } from './userHelpers.js';
import { sumAmountsInInr } from './fxRates.js';
import * as leadsApi from './services/leads.js';
import { fetchUsers } from './services/lookups.js';

function leaderboardPipelineAmount(item = {}) {
  const value = item.actual_pipeline ?? item.pipeline_actual ?? item.pipeline_value ?? item.actuals?.actual_pipeline;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function leaderboardEmployeeId(item = {}) {
  return String(item.employee_id || item.id || item.user_id || '');
}

/** Sum open proposal deal sizes in INR, grouped by owner. */
export async function buildProposalPipelineInrByOwner(proposals = []) {
  const byOwner = new Map();
  for (const lead of proposals || []) {
    const ownerId = lead?.owner_id;
    if (!ownerId) continue;
    const key = String(ownerId);
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key).push(lead);
  }

  const totals = new Map();
  for (const [ownerId, rows] of byOwner) {
    const totalInr = await sumAmountsInInr(rows, {
      amountOf: (lead) => Number(lead.deal_size ?? lead.proposal_amount),
      currencyOf: (lead) => lead.currency || 'INR',
    });
    totals.set(ownerId, totalInr);
  }
  return totals;
}

/**
 * Fill BDE pipeline leaderboard from CRM proposals when the dashboard API
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
  const leaderboardMap = new Map();

  for (const item of summary.bde_leaderboard || []) {
    const id = leaderboardEmployeeId(item);
    if (id) leaderboardMap.set(id, { ...item });
  }

  for (const user of users) {
    if (normalizeRole(user.role) !== 'sales_rep') continue;
    const id = String(user.id);
    const crmPipeline = pipelineByOwner.get(id) || 0;
    const existing = leaderboardMap.get(id) || {};
    const apiPipeline = leaderboardPipelineAmount(existing);
    const actual = Math.max(apiPipeline, crmPipeline);

    leaderboardMap.set(id, {
      ...existing,
      employee_id: user.id,
      employee_name: existing.employee_name || existing.name || userDisplayName(user),
      actual_pipeline: String(actual),
      pipeline_actual: String(actual),
    });
  }

  // Keep API-only rows (e.g. inactive users) but still apply CRM totals when API is zero.
  for (const [ownerId, crmPipeline] of pipelineByOwner) {
    if (!leaderboardMap.has(ownerId)) {
      leaderboardMap.set(ownerId, {
        employee_id: ownerId,
        employee_name: users.find((u) => String(u.id) === ownerId)?.name || 'Unknown',
        actual_pipeline: String(crmPipeline),
        pipeline_actual: String(crmPipeline),
      });
    }
  }

  const bde_leaderboard = [...leaderboardMap.values()]
    .sort((a, b) => leaderboardPipelineAmount(b) - leaderboardPipelineAmount(a));

  const crmTotalPipeline = [...pipelineByOwner.values()].reduce((sum, value) => sum + value, 0);
  const apiMonthly = Number(summary.monthly_pipeline_actual || 0);

  return {
    ...summary,
    monthly_pipeline_actual: String(Math.max(apiMonthly, crmTotalPipeline)),
    bde_leaderboard,
  };
}
