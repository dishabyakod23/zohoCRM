import { pipelineStageLabel, PIPELINE_RAW, PIPELINE_LEAD, PIPELINE_QUALIFIED, PIPELINE_PROPOSAL, toApiLeadStatus, proposalDealStatusLabel } from './pipelineHelpers.js';
import { toDateOnly } from './activityHelpers.js';
import { DEFAULT_CURRENCY } from './currencies.js';

/** Map API snake_case lead_status to display label (fallback when lookups unavailable) */
const STATUS_LABELS = {
  none: 'None',
  attempted_to_contact: 'Attempted to Contact',
  contact_in_future: 'Contact in Future',
  contacted: 'Contacted',
  junk_lead: 'Junk Lead',
  lost_lead: 'Lost Lead',
  not_contacted: 'Not Contacted',
  pre_qualified: 'Pre-Qualified',
  not_qualified: 'Not Qualified',
  raw_prospect: 'Raw Lead',
  raw_lead: 'Raw Lead',
  lead: 'Lead',
  qualified_lead: 'Qualified Lead',
  proposal: 'Proposal',
  deal_lost: 'Deal Lost',
  [PIPELINE_RAW]: 'Raw Lead',
  [PIPELINE_LEAD]: 'Lead',
  [PIPELINE_QUALIFIED]: 'Qualified Lead',
  [PIPELINE_PROPOSAL]: 'Proposal',
};

const SNAKE_CASE_RE = /^[a-z][a-z0-9_]*$/;

export function leadStatusLabel(status, options = []) {
  if (!status) return '—';
  const lookupOptions = Array.isArray(options) ? options : [];
  const fromLookup = lookupOptions.find(o => o.value === status);
  if (fromLookup) return fromLookup.label;
  return STATUS_LABELS[status] || pipelineStageLabel(status) || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Ensure API receives valid LeadStatus enum value */
export function resolveLeadStatusForApi(status) {
  if (!status) return 'raw_prospect';
  if (status === PIPELINE_PROPOSAL) return 'qualified_lead';
  const mapped = toApiLeadStatus(status);
  if (mapped) return mapped;
  if (SNAKE_CASE_RE.test(status)) return status;
  const fromLabel = Object.entries(STATUS_LABELS).find(([, label]) => label === status);
  if (fromLabel) return toApiLeadStatus(fromLabel[0]) || fromLabel[0];
  return status.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
}

/** Normalize API lead for UI */
export function normalizeLead(lead, statusOptions = []) {
  if (!lead) return lead;
  const ownerName = lead.owner
    ? `${lead.owner.first_name || ''} ${lead.owner.last_name || ''}`.trim()
    : null;
  const rawStatus = lead.lead_status ?? lead.status;
  return {
    ...lead,
    status: leadStatusLabel(rawStatus, statusOptions),
    lead_status: rawStatus,
    source: lead.lead_source || lead.source,
    lead_source: lead.lead_source || lead.source,
    owner_name: ownerName || lead.owner_name,
    converted: lead.is_converted ?? lead.converted,
    employees: lead.no_of_employees || lead.employees,
    zip: lead.zip_code || lead.zip,
    proposal_date: lead.proposal_date || null,
    closure_date: lead.closure_date || null,
    deal_size: lead.deal_size ?? lead.proposal_amount ?? null,
    deal_status: lead.deal_status || null,
    deal_status_label: proposalDealStatusLabel(lead.deal_status),
    currency: lead.currency || DEFAULT_CURRENCY,
  };
}

/** Build LeadCreate / LeadUpdate payload — lead_status must be snake_case */
export function toLeadPayload(form, { partial = false } = {}) {
  const payload = {
    salutation: form.salutation || null,
    latitude: form.latitude != null && form.latitude !== '' ? Number(form.latitude) : null,
    longitude: form.longitude != null && form.longitude !== '' ? Number(form.longitude) : null,
    first_name: form.first_name || null,
    last_name: form.last_name,
    company: form.company,
    email: form.email,
    phone: form.phone,
    mobile: form.mobile || null,
    title: form.title || null,
    lead_source: form.source || form.lead_source || null,
    industry: form.industry || null,
    lead_status: resolveLeadStatusForApi(form.lead_status || form.status),
    description: form.description || null,
    website: form.website || null,
    annual_revenue: form.annual_revenue || null,
    fax: form.fax || null,
    skype_id: form.skype_id || null,
    secondary_email: form.secondary_email || null,
    twitter: form.twitter || null,
    email_opt_out: form.email_opt_out ?? false,
    street: [form.building, form.street].filter(Boolean).join(', ') || form.street || null,
    city: form.city || null,
    state: form.state || null,
    country: form.country || null,
    zip_code: form.zip || form.zip_code || null,
    no_of_employees: form.employees || form.no_of_employees || null,
    rating: form.rating || null,
    proposal_amount: form.deal_size || form.proposal_amount || null,
    deal_size: form.deal_size || form.proposal_amount || null,
    proposal_date: form.proposal_date ? toDateOnly(form.proposal_date) : null,
    closure_date: form.closure_date ? toDateOnly(form.closure_date) : null,
    deal_status: form.deal_status || null,
    currency: form.currency || DEFAULT_CURRENCY,
    owner_id: form.owner_id || null,
  };

  if (partial) {
    return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  }
  return payload;
}

export { STATUS_LABELS };
