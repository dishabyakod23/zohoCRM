import api from '../api.js';
import { DEFAULT_CURRENCY } from '../currencies.js';
import * as accountsApi from './accounts.js';
import { pipelineStageLabel, PIPELINE_MODULE_PERMISSION } from '../pipelineHelpers.js';

function topAccountRows(home) {
  return home.top_accounts || home.topAccounts || [];
}

/** Dashboard home omits account currency — load it from each account record. */
async function enrichTopAccountsCurrency(rows) {
  const enriched = await Promise.all(rows.map(async (row) => {
    if (row.currency) return row;
    if (!row.id) return { ...row, currency: DEFAULT_CURRENCY };
    try {
      const account = await accountsApi.getAccount(row.id);
      return { ...row, currency: account.currency || DEFAULT_CURRENCY };
    } catch {
      return { ...row, currency: DEFAULT_CURRENCY };
    }
  }));
  return enriched;
}

/**
 * Pipeline KPIs from GET /dashboard/home, in the shape the dashboard expects
 * (same as leadsApi.summarizePipelineDashboard). Returns null when the response has no counts.
 */
export function pipelineFromDashboardHome(home) {
  const rows = home?.pipeline_counts;
  if (!Array.isArray(rows)) return null;
  const leadsByPipeline = rows
    .map((row) => ({
      status: row.label || pipelineStageLabel(row.stage),
      count: Number(row.count) || 0,
      permissionKey: PIPELINE_MODULE_PERMISSION[row.stage],
    }))
    .filter((row) => row.count > 0);
  return {
    leadsByPipeline,
    totalLeads: leadsByPipeline.reduce((sum, row) => sum + row.count, 0),
    qualifiedCount: Number(home.qualified_count) || 0,
    leadsThisMonth: Number(home.leads_this_month) || 0,
    proposals: {
      total: Number(home.proposals?.count) || 0,
      dealSize: Number(home.proposals?.deal_size_inr) || 0,
    },
  };
}

export async function getDashboardHome() {
  const res = await api.get('/dashboard/home');
  const home = res.data.data;
  const topAccounts = await enrichTopAccountsCurrency(topAccountRows(home));
  return { ...home, top_accounts: topAccounts };
}
