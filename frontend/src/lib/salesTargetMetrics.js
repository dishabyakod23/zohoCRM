import { DEFAULT_CURRENCY } from './currencies.js';
import { formatTargetAmount, toSalesTargetPayload } from './salesTargetHelpers.js';

export const METRIC_TYPES = {
  count: 'count',
  currency: 'currency',
};

/** Built-in KPI metrics aligned with the weekly performance report. */
export const DEFAULT_KPI_METRICS = [
  { key: 'new_leads', label: 'New Leads Added', type: METRIC_TYPES.count, summaryKey: 'new_leads' },
  { key: 'prospects_contacted', label: 'Prospects Contacted', type: METRIC_TYPES.count, summaryKey: 'prospects_contacted' },
  { key: 'cold_calls', label: 'Cold Calls Completed', type: METRIC_TYPES.count, summaryKey: 'cold_calls' },
  { key: 'emails_sent', label: 'Emails Sent', type: METRIC_TYPES.count, summaryKey: 'emails_sent' },
  { key: 'linkedin_outreach', label: 'LinkedIn Outreach', type: METRIC_TYPES.count, summaryKey: 'linkedin_outreach' },
  { key: 'follow_ups', label: 'Follow-ups Completed', type: METRIC_TYPES.count, summaryKey: 'follow_ups' },
  { key: 'qualified_meetings', label: 'Qualified Meetings Booked', type: METRIC_TYPES.count, summaryKey: 'qualified_meetings', apiField: 'qualified_meetings_target' },
  { key: 'meetings_completed', label: 'Meetings Completed', type: METRIC_TYPES.count, summaryKey: 'meetings_completed' },
  { key: 'proposals_sent', label: 'Proposals Sent', type: METRIC_TYPES.count, summaryKey: 'proposals_sent', apiField: 'proposal_count_target' },
  { key: 'pipeline_value', label: 'Pipeline Value Added', type: METRIC_TYPES.currency, summaryKey: 'pipeline_value', apiField: 'pipeline_target' },
  { key: 'deals_closed', label: 'Deals Closed', type: METRIC_TYPES.currency, summaryKey: 'deals_closed_amount', apiField: 'revenue_target' },
  { key: 'revenue_collected', label: 'Revenue Collected', type: METRIC_TYPES.currency, summaryKey: 'revenue_collected', apiField: 'collection_target' },
];

const METRICS_JSON_MARKER = '---SALES_TARGET_METRICS---';

const API_FIELD_MAP = {
  pipeline_target: 'pipeline_value',
  revenue_target: 'deals_closed',
  collection_target: 'revenue_collected',
  proposal_count_target: 'proposals_sent',
  qualified_meetings_target: 'qualified_meetings',
  proposal_value_target: 'proposals_sent',
  deal_closure_count_target: 'deals_closed',
};

function metricId(metric) {
  return metric.id || metric.key;
}

export function createMetricRow(def = {}) {
  const base = DEFAULT_KPI_METRICS.find((m) => m.key === def.key) || {};
  return {
    id: def.id || `${def.key || 'custom'}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    key: def.key || '',
    label: def.label || '',
    type: def.type || METRIC_TYPES.count,
    summaryKey: def.summaryKey || def.key || '',
    target: def.target ?? '',
    enabled: def.enabled !== false,
    isCustom: def.isCustom ?? !base.key,
  };
}

export function defaultMetricRows() {
  return DEFAULT_KPI_METRICS.map((metric) => createMetricRow({ ...metric, target: '' }));
}

export function parseRemarksData(remarks) {
  if (!remarks) return { text: '', metrics: [] };
  const markerIndex = remarks.indexOf(METRICS_JSON_MARKER);
  if (markerIndex === -1) return { text: remarks, metrics: [] };
  const text = remarks.slice(0, markerIndex).trim();
  const jsonPart = remarks.slice(markerIndex + METRICS_JSON_MARKER.length).trim();
  try {
    const parsed = JSON.parse(jsonPart);
    return { text, metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [] };
  } catch {
    return { text: remarks, metrics: [] };
  }
}

export function serializeRemarksData(text, metrics) {
  const storedMetrics = (metrics || [])
    .filter((m) => m && (m.key || m.label))
    .map((m) => ({
      key: m.key,
      label: m.label,
      type: m.type,
      summaryKey: m.summaryKey || m.key,
      target: m.target,
      isCustom: Boolean(m.isCustom),
    }));
  if (!storedMetrics.length) return text || null;
  const payload = JSON.stringify({ metrics: storedMetrics });
  return `${text || ''}${text ? '\n\n' : ''}${METRICS_JSON_MARKER}${payload}`;
}

export function metricsFromTarget(target) {
  if (!target) return { metrics: defaultMetricRows(), remarksText: '' };

  const { text, metrics: customMetrics } = parseRemarksData(target.remarks);
  const kpiTargets = target.kpi_targets || {};
  const customByKey = Object.fromEntries(customMetrics.map((m) => [m.key, m]));
  const rows = [];

  for (const def of DEFAULT_KPI_METRICS) {
    let targetValue = '';
    if (def.apiField && target[def.apiField] != null && target[def.apiField] !== '') {
      targetValue = target[def.apiField];
    } else if (kpiTargets[def.key] != null && kpiTargets[def.key] !== '') {
      targetValue = kpiTargets[def.key];
    } else if (customByKey[def.key]) {
      targetValue = customByKey[def.key].target ?? '';
    }
    if (targetValue !== '') {
      rows.push(createMetricRow({ ...def, target: targetValue }));
    }
  }

  for (const custom of customMetrics) {
    if (!DEFAULT_KPI_METRICS.find((m) => m.key === custom.key)) {
      rows.push(createMetricRow({ ...custom, isCustom: true }));
    }
  }

  return {
    metrics: rows.length ? rows : defaultMetricRows(),
    remarksText: text,
  };
}

export function applyMetricsToForm(form, metrics) {
  const { remarksText, ...rest } = form;
  const next = { ...rest };

  for (const def of DEFAULT_KPI_METRICS) {
    if (def.apiField) next[def.apiField] = '';
  }

  const storedInRemarks = [];
  for (const metric of metrics) {
    if (!metric.enabled) continue;
    const def = DEFAULT_KPI_METRICS.find((m) => m.key === metric.key);
    if (def?.apiField) {
      next[def.apiField] = metric.target === '' ? '' : metric.target;
      continue;
    }
    storedInRemarks.push(metric);
  }

  next.remarks = serializeRemarksData(remarksText || '', storedInRemarks);
  delete next.remarksText;
  return next;
}

export function buildSalesTargetSavePayload(form, metrics, { partial = false } = {}) {
  const mappedForm = applyMetricsToForm(form, metrics);
  return toSalesTargetPayload(mappedForm, { partial });
}

export function achievementForMetric(actual, target) {
  const actualNum = Number(actual) || 0;
  const targetNum = Number(target);
  if (!target || target === '' || !Number.isFinite(targetNum) || targetNum <= 0) {
    return { pct: null, status: 'Target Missing' };
  }
  const pct = Math.round((actualNum / targetNum) * 100);
  if (pct >= 90) return { pct, status: 'On Track' };
  if (pct >= 70) return { pct, status: 'Needs Attention' };
  return { pct, status: 'Off Track' };
}

export function formatMetricTarget(metric, currency = DEFAULT_CURRENCY) {
  if (metric.target === '' || metric.target == null) return 'Not Configured';
  if (metric.type === METRIC_TYPES.currency) return formatTargetAmount(metric.target, currency);
  return String(metric.target);
}

export function formatMetricActual(metric, actuals = {}, currency = DEFAULT_CURRENCY) {
  const value = actuals[metric.summaryKey] ?? actuals[metric.key] ?? 0;
  if (metric.type === METRIC_TYPES.currency) return formatTargetAmount(value, currency);
  return String(value ?? 0);
}

export function buildPreviewRows(metrics, actuals = {}, currency = DEFAULT_CURRENCY) {
  return (metrics || [])
    .filter((m) => m.enabled !== false)
    .map((metric) => {
      const actual = actuals[metric.summaryKey] ?? actuals[metric.key] ?? 0;
      const { pct, status } = achievementForMetric(actual, metric.target);
      return {
        ...metric,
        displayTarget: formatMetricTarget(metric, currency),
        displayActual: formatMetricActual(metric, actuals, currency),
        achievementPct: pct == null ? 'Not Configured' : `${pct}%`,
        status,
      };
    });
}

export function availableMetricsToAdd(currentMetrics) {
  const usedKeys = new Set((currentMetrics || []).map((m) => m.key).filter(Boolean));
  return DEFAULT_KPI_METRICS.filter((m) => !usedKeys.has(m.key));
}

/** Map performance-report actuals to KPI summary keys used in preview tables. */
export function mapReportActualsForPreview(actuals = {}) {
  return {
    pipeline_value: actuals.actual_pipeline,
    deals_closed_amount: actuals.actual_revenue,
    revenue_collected: actuals.actual_collection,
    qualified_meetings: actuals.qualified_meetings,
    proposals_sent: actuals.proposals_sent,
    meetings_completed: actuals.meetings_completed ?? actuals.qualified_meetings,
    new_leads: actuals.new_leads,
    prospects_contacted: actuals.prospects_contacted,
    cold_calls: actuals.cold_calls,
    emails_sent: actuals.emails_sent,
    linkedin_outreach: actuals.linkedin_outreach,
    follow_ups: actuals.follow_ups,
  };
}

export function reportRowToMetrics(row) {
  if (!row) return [];
  const { metrics } = metricsFromTarget({
    pipeline_target: row.pipeline_target,
    revenue_target: row.revenue_target,
    collection_target: row.collection_target,
    proposal_count_target: row.proposal_count_target,
    qualified_meetings_target: row.qualified_meetings_target,
    deal_closure_count_target: row.deal_closure_count_target,
    proposal_value_target: row.proposal_value_target,
    kpi_targets: row.kpi_targets,
    remarks: row.remarks,
  });
  return metrics;
}

export function buildPreviewRowsFromReportRow(row) {
  const metrics = reportRowToMetrics(row);
  const actuals = mapReportActualsForPreview(row.actuals || {});
  return buildPreviewRows(metrics, actuals, row.currency);
}
