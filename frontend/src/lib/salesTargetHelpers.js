import { DEFAULT_CURRENCY } from './currencies.js';

export const TARGET_PERIOD_TYPES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

export const TARGET_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'locked', label: 'Locked' },
  { value: 'archived', label: 'Archived' },
];

export const TARGET_ROLES = [
  { value: 'sales_rep', label: 'BDE' },
  { value: 'sales_manager', label: 'BDM' },
];

export const ACHIEVEMENT_STATUSES = {
  on_track: 'On Track',
  needs_attention: 'Needs Attention',
  off_track: 'Off Track',
  target_missing: 'Target Missing',
};

export const DEFAULT_FORECAST_WEIGHTS = {
  qualified_lead: 20,
  proposal_sent: 40,
  negotiation: 70,
  deal_won: 100,
  deal_lost: 0,
};

export const DEFAULT_ACHIEVEMENT_THRESHOLDS = {
  on_track: 90,
  needs_attention: 70,
};

export const DEFAULT_SALES_TARGET_SETTINGS = {
  year_format: 'calendar',
  default_currency: DEFAULT_CURRENCY,
  pipeline_owner_rule: 'current_owner',
  forecast_weights: DEFAULT_FORECAST_WEIGHTS,
  achievement_thresholds: DEFAULT_ACHIEVEMENT_THRESHOLDS,
};

function toNumber(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toAmountString(value) {
  if (value == null || value === '') return '0';
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : String(value);
}

export function targetPeriodLabel(periodType) {
  return TARGET_PERIOD_TYPES.find((item) => item.value === periodType)?.label || periodType || '—';
}

export function targetStatusLabel(status) {
  return TARGET_STATUSES.find((item) => item.value === status)?.label || status || '—';
}

export function targetRoleLabel(role) {
  return TARGET_ROLES.find((item) => item.value === role)?.label || role || '—';
}

export function achievementStatusLabel(status) {
  if (!status) return ACHIEVEMENT_STATUSES.target_missing;
  const normalized = String(status).toLowerCase().replace(/\s+/g, '_');
  if (normalized.includes('on_track')) return ACHIEVEMENT_STATUSES.on_track;
  if (normalized.includes('needs_attention')) return ACHIEVEMENT_STATUSES.needs_attention;
  if (normalized.includes('off_track')) return ACHIEVEMENT_STATUSES.off_track;
  return status;
}

export function formatTargetAmount(value, currency = DEFAULT_CURRENCY) {
  const amount = toNumber(value);
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-IN')}`;
  }
}

export function formatAchievementPct(value) {
  if (value == null || value === '') return 'Not Configured';
  const num = Number(value);
  if (!Number.isFinite(num)) return 'Not Configured';
  return `${num.toFixed(1)}%`;
}

export function normalizeSalesTargetSettings(settings = {}) {
  return {
    ...DEFAULT_SALES_TARGET_SETTINGS,
    ...settings,
    forecast_weights: {
      ...DEFAULT_FORECAST_WEIGHTS,
      ...(settings.forecast_weights || {}),
    },
    achievement_thresholds: {
      ...DEFAULT_ACHIEVEMENT_THRESHOLDS,
      ...(settings.achievement_thresholds || {}),
    },
  };
}

export function normalizeSalesTarget(target) {
  if (!target) return target;
  return {
    ...target,
    currency: target.currency || DEFAULT_CURRENCY,
    pipeline_target: toAmountString(target.pipeline_target),
    revenue_target: toAmountString(target.revenue_target),
    collection_target: target.collection_target != null ? toAmountString(target.collection_target) : null,
    proposal_value_target: target.proposal_value_target != null ? toAmountString(target.proposal_value_target) : null,
    calculated_pipeline_target: target.calculated_pipeline_target != null
      ? toAmountString(target.calculated_pipeline_target)
      : null,
    calculated_revenue_target: target.calculated_revenue_target != null
      ? toAmountString(target.calculated_revenue_target)
      : null,
    period_type_label: targetPeriodLabel(target.period_type),
    status_label: targetStatusLabel(target.status),
    role_label: targetRoleLabel(target.role),
    target_source_label: target.is_manual_override ? 'Manually configured' : 'Auto-calculated',
  };
}

export function normalizeSalesTargetReportRow(row) {
  if (!row) return row;
  const achievement = row.achievement || {};
  return {
    ...row,
    currency: row.currency || DEFAULT_CURRENCY,
    pipeline_target: row.pipeline_target != null ? toAmountString(row.pipeline_target) : null,
    revenue_target: row.revenue_target != null ? toAmountString(row.revenue_target) : null,
    collection_target: row.collection_target != null ? toAmountString(row.collection_target) : null,
    proposal_value_target: row.proposal_value_target != null ? toAmountString(row.proposal_value_target) : null,
    actuals: {
      actual_pipeline: toAmountString(row.actuals?.actual_pipeline),
      actual_revenue: toAmountString(row.actuals?.actual_revenue),
      actual_collection: toAmountString(row.actuals?.actual_collection),
      qualified_meetings: Number(row.actuals?.qualified_meetings || 0),
      proposals_sent: Number(row.actuals?.proposals_sent || 0),
      proposals_value: toAmountString(row.actuals?.proposals_value),
      deals_won: Number(row.actuals?.deals_won || 0),
      deals_lost: Number(row.actuals?.deals_lost || 0),
      weighted_forecast: toAmountString(row.actuals?.weighted_forecast),
    },
    achievement: {
      pipeline_achievement_pct: achievement.pipeline_achievement_pct ?? null,
      revenue_achievement_pct: achievement.revenue_achievement_pct ?? null,
      collection_achievement_pct: achievement.collection_achievement_pct ?? null,
      status: achievementStatusLabel(achievement.status),
      pipeline_status: achievementStatusLabel(achievement.pipeline_status),
      revenue_status: achievementStatusLabel(achievement.revenue_status),
    },
    period_type_label: targetPeriodLabel(row.period_type),
    role_label: targetRoleLabel(row.role),
  };
}

export function normalizeSalesTargetDashboard(summary = {}) {
  return {
    monthly_pipeline_target: toAmountString(summary.monthly_pipeline_target),
    monthly_pipeline_actual: toAmountString(summary.monthly_pipeline_actual),
    monthly_revenue_target: toAmountString(summary.monthly_revenue_target),
    monthly_revenue_actual: toAmountString(summary.monthly_revenue_actual),
    off_track_users: summary.off_track_users || [],
    bde_leaderboard: summary.bde_leaderboard || [],
    bdm_team_summary: summary.bdm_team_summary || [],
    yearly_target_progress: summary.yearly_target_progress || {},
  };
}

function optionalAmount(value) {
  if (value == null || value === '') return null;
  return Number(value);
}

function optionalInteger(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.trunc(num)) : null;
}

export function toSalesTargetPayload(form, { partial = false } = {}) {
  const payload = {
    period_type: form.period_type,
    period_name: form.period_name,
    start_date: form.start_date,
    end_date: form.end_date,
    employee_id: form.employee_id,
    role: form.role,
    reporting_manager_id: form.reporting_manager_id || null,
    currency: form.currency || DEFAULT_CURRENCY,
    pipeline_target: optionalAmount(form.pipeline_target) ?? 0,
    revenue_target: optionalAmount(form.revenue_target) ?? 0,
    collection_target: optionalAmount(form.collection_target),
    proposal_value_target: optionalAmount(form.proposal_value_target),
    proposal_count_target: optionalInteger(form.proposal_count_target),
    qualified_meetings_target: optionalInteger(form.qualified_meetings_target),
    deal_closure_count_target: optionalInteger(form.deal_closure_count_target),
    status: form.status || 'draft',
    is_manual_override: Boolean(form.is_manual_override),
    override_reason: form.override_reason || null,
    remarks: form.remarks || null,
  };

  if (partial) {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    );
  }

  return payload;
}

export function toSalesTargetUpdatePayload(form) {
  return toSalesTargetPayload(form, { partial: true });
}

export function toSalesTargetCopyPayload(form) {
  return {
    source_target_id: form.source_target_id,
    period_type: form.period_type,
    period_name: form.period_name,
    start_date: form.start_date,
    end_date: form.end_date,
    employee_id: form.employee_id || null,
    status: form.status || 'draft',
  };
}

export function toSalesTargetRollupPayload(form) {
  return {
    employee_id: form.employee_id,
    period_type: form.period_type,
    period_name: form.period_name,
    start_date: form.start_date,
    end_date: form.end_date,
    status: form.status || 'draft',
    is_manual_override: Boolean(form.is_manual_override),
    override_reason: form.override_reason || null,
  };
}

export function toSalesTargetSettingsPayload(form) {
  return {
    year_format: form.year_format,
    default_currency: form.default_currency,
    pipeline_owner_rule: form.pipeline_owner_rule,
    forecast_weights: form.forecast_weights,
    achievement_thresholds: form.achievement_thresholds,
  };
}

export function toSalesTargetReportRemarkPayload(form) {
  return {
    employee_id: form.employee_id,
    period_start: form.period_start,
    period_end: form.period_end,
    remarks: form.remarks,
  };
}

export function buildSalesTargetListParams({
  period_type,
  year,
  quarter,
  month,
  week,
  employee_id,
  reporting_manager_id,
  role,
  status,
  target_category,
  page,
  page_size,
} = {}) {
  const params = {};
  if (period_type) params.period_type = period_type;
  if (year != null) params.year = year;
  if (quarter != null) params.quarter = quarter;
  if (month != null) params.month = month;
  if (week != null) params.week = week;
  if (employee_id) params.employee_id = employee_id;
  if (reporting_manager_id) params.reporting_manager_id = reporting_manager_id;
  if (role) params.role = role;
  if (status) params.status = status;
  if (target_category) params.target_category = target_category;
  if (page != null) params.page = page;
  if (page_size != null) params.page_size = page_size;
  return params;
}

export function buildSalesTargetReportParams({
  period_type = 'weekly',
  date_from,
  date_to,
  employee_id,
  reporting_manager_id,
  role,
  campaign_source,
  lead_source,
  region,
} = {}) {
  const params = { period_type };
  if (date_from) params.date_from = date_from;
  if (date_to) params.date_to = date_to;
  if (employee_id) params.employee_id = employee_id;
  if (reporting_manager_id) params.reporting_manager_id = reporting_manager_id;
  if (role) params.role = role;
  if (campaign_source) params.campaign_source = campaign_source;
  if (lead_source) params.lead_source = lead_source;
  if (region) params.region = region;
  return params;
}
