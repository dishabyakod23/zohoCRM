import { buildPerformanceSummaryClientSide } from './performanceReportEmail.js';
import { buildOutreachActivityIndex } from './outreachActivity.js';
import { BULK_FETCH_PAGE_SIZE } from './constants.js';
import * as leadsApi from './services/leads.js';
import * as contactsApi from './services/contacts.js';
import * as accountsApi from './services/accounts.js';
import * as dealsApi from './services/deals.js';
import * as tasksApi from './services/tasks.js';
import * as callsApi from './services/calls.js';
import * as meetingsApi from './services/meetings.js';
import { mapReportActualsForPreview } from './salesTargetMetrics.js';

/** KPI keys the backend is expected to compute in SalesTargetActuals. */
export const BACKEND_TRACKED_ACTUAL_KEYS = [
  'pipeline_value',
  'deals_closed_amount',
  'revenue_collected',
  'qualified_meetings',
  'proposals_sent',
  'proposals_value',
  'deals_won',
  'meetings_completed',
  'new_leads',
  'prospects_contacted',
  'cold_calls',
  'emails_sent',
  'linkedin_outreach',
  'follow_ups',
];

function flattenOutreachEvents() {
  const index = buildOutreachActivityIndex();
  const events = [];
  for (const contactEvents of Object.values(index)) {
    for (const event of contactEvents || []) {
      events.push(event);
    }
  }
  return events;
}

/** Load CRM activity totals for a target period (same rules as Individual Performance reports). */
export async function fetchKpiActualsForEmployee(employeeId, periodStart, periodEnd) {
  if (!employeeId || !periodStart || !periodEnd) return {};

  const pageSize = BULK_FETCH_PAGE_SIZE;
  const [leadsRes, contactsRes, accountsRes, dealsRes, tasksRes, callsRes, meetingsRes] = await Promise.all([
    leadsApi.listAllLeads({ owner_id: employeeId }, []).catch(() => ({ data: [] })),
    contactsApi.listAllContacts({ owner_id: employeeId }, {}).catch(() => ({ data: [] })),
    accountsApi.listAccounts({ owner_id: employeeId, page_size: pageSize }).catch(() => ({ data: [] })),
    dealsApi.listAllDeals({ owner_id: employeeId }, {}).catch(() => ({ data: [] })),
    tasksApi.listTasks({ page_size: pageSize }).catch(() => ({ data: [] })),
    callsApi.listCalls({ page_size: pageSize }).catch(() => ({ data: [] })),
    meetingsApi.listMeetings({ page_size: pageSize }).catch(() => ({ data: [] })),
  ]);

  return buildPerformanceSummaryClientSide(employeeId, periodStart, periodEnd, {
    leads: leadsRes.data || [],
    contacts: contactsRes.data || [],
    accounts: accountsRes.data || [],
    deals: dealsRes.data || [],
    tasks: tasksRes.data || [],
    calls: callsRes.data || [],
    meetings: meetingsRes.data || [],
    outreachEvents: flattenOutreachEvents(),
  });
}

function pickApiOrCrm(apiValue, crmValue) {
  if (apiValue != null && apiValue !== '') return apiValue;
  return crmValue ?? 0;
}

/** Prefer API performance actuals when present; fill outreach KPIs from CRM summary. */
export function mergePreviewActuals(apiActuals = {}, crmSummary = {}) {
  const fromApi = mapReportActualsForPreview(apiActuals);

  return {
    new_leads: pickApiOrCrm(fromApi.new_leads, crmSummary.new_leads),
    prospects_contacted: pickApiOrCrm(fromApi.prospects_contacted, crmSummary.prospects_contacted),
    cold_calls: pickApiOrCrm(fromApi.cold_calls, crmSummary.cold_calls),
    emails_sent: pickApiOrCrm(fromApi.emails_sent, crmSummary.emails_sent),
    linkedin_outreach: pickApiOrCrm(fromApi.linkedin_outreach, crmSummary.linkedin_outreach),
    follow_ups: pickApiOrCrm(fromApi.follow_ups, crmSummary.follow_ups),
    qualified_meetings: pickApiOrCrm(fromApi.qualified_meetings, crmSummary.qualified_meetings),
    meetings_completed: pickApiOrCrm(fromApi.meetings_completed, crmSummary.meetings_completed),
    proposals_sent: pickApiOrCrm(fromApi.proposals_sent, crmSummary.proposals_sent),
    proposals_value: pickApiOrCrm(fromApi.proposals_value, crmSummary.proposals_value),
    deals_won: pickApiOrCrm(fromApi.deals_won, crmSummary.deals_won),
    pipeline_value: pickApiOrCrm(fromApi.pipeline_value, crmSummary.pipeline_value),
    deals_closed_amount: pickApiOrCrm(fromApi.deals_closed_amount, crmSummary.deals_closed_amount),
    revenue_collected: pickApiOrCrm(fromApi.revenue_collected, crmSummary.revenue_collected),
  };
}

export async function fetchMergedActualsForPeriod({
  employee_id,
  start_date,
  end_date,
  apiActuals = {},
}) {
  if (!employee_id || !start_date || !end_date) {
    return mapReportActualsForPreview(apiActuals);
  }
  const crmSummary = await fetchKpiActualsForEmployee(employee_id, start_date, end_date);
  return mergePreviewActuals(apiActuals, crmSummary);
}

export async function fetchPreviewActualsForReportRow(row) {
  if (!row?.employee_id || !row?.period_start || !row?.period_end) {
    return mapReportActualsForPreview(row?.actuals || {});
  }
  return fetchMergedActualsForPeriod({
    employee_id: row.employee_id,
    start_date: row.period_start,
    end_date: row.period_end,
    apiActuals: row.actuals || {},
  });
}

export async function fetchPreviewActualsForTargetForm({
  employee_id,
  start_date,
  end_date,
  apiActuals = {},
}) {
  return fetchMergedActualsForPeriod({ employee_id, start_date, end_date, apiActuals });
}
