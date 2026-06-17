/** Sales pipeline stages — values must match API LeadStatus enum */

export const PIPELINE_RAW = 'raw_prospect';
export const PIPELINE_LEAD = 'contacted';
export const PIPELINE_QUALIFIED = 'qualified_lead';
/** Proposal is tracked as qualified_lead + lead_source marker (API has no proposal status) */
export const PIPELINE_PROPOSAL = 'proposal';
export const PROPOSAL_SOURCE = 'Proposal';

export const PIPELINE_STAGE_ORDER = [
  PIPELINE_RAW,
  PIPELINE_LEAD,
  PIPELINE_QUALIFIED,
  PIPELINE_PROPOSAL,
];

export const PIPELINE_STAGE_LABELS = {
  [PIPELINE_RAW]: 'Raw Lead',
  [PIPELINE_LEAD]: 'Lead',
  [PIPELINE_QUALIFIED]: 'Qualified Lead',
  [PIPELINE_PROPOSAL]: 'Proposal',
  deal_lost: 'Deal Lost',
};

/** Map UI / legacy status strings to API LeadStatus enum */
export const STATUS_TO_API = {
  raw_lead: 'raw_prospect',
  raw_prospect: 'raw_prospect',
  lead: 'contacted',
  contacted: 'contacted',
  qualified_lead: 'qualified_lead',
  proposal: 'qualified_lead',
  deal_lost: 'deal_lost',
};

export function toApiLeadStatus(status) {
  if (!status) return null;
  return STATUS_TO_API[status] || status;
}

export function isProposalLead(lead) {
  const source = lead?.lead_source || lead?.source || '';
  return source === PROPOSAL_SOURCE || lead?.pipeline_stage === PIPELINE_PROPOSAL;
}

export function filterLeadsByPipelineStage(leads, stage) {
  if (stage === PIPELINE_PROPOSAL) {
    return leads.filter(isProposalLead);
  }
  if (stage === PIPELINE_QUALIFIED) {
    return leads.filter((l) => l.lead_status === 'qualified_lead' && !isProposalLead(l));
  }
  return leads;
}

export const PIPELINE_STAGE_CONFIG = {
  [PIPELINE_RAW]: {
    listPath: '/raw-leads',
    detailPath: (id) => `/raw-leads/${id}`,
    listTitle: 'Raw Leads',
    apiStatus: PIPELINE_RAW,
    convertTo: { status: PIPELINE_LEAD, label: 'Lead', redirectPath: '/leads' },
    allowAssign: true,
    allowUpload: true,
  },
  [PIPELINE_QUALIFIED]: {
    listPath: '/qualified-leads',
    detailPath: (id) => `/qualified-leads/${id}`,
    listTitle: 'Qualified Leads',
    apiStatus: PIPELINE_QUALIFIED,
    convertTo: { status: PIPELINE_PROPOSAL, label: 'Proposal', redirectPath: '/proposals', proposal: true },
    allowAssign: false,
    allowUpload: false,
  },
  [PIPELINE_PROPOSAL]: {
    listPath: '/proposals',
    detailPath: (id) => `/proposals/${id}`,
    listTitle: 'Proposals',
    apiStatus: PIPELINE_QUALIFIED,
    convertTo: null,
    allowAssign: false,
    allowUpload: false,
  },
};

export function getPipelineConfig(stage) {
  if (stage === PIPELINE_PROPOSAL) return PIPELINE_STAGE_CONFIG[PIPELINE_PROPOSAL];
  return PIPELINE_STAGE_CONFIG[stage] || null;
}

export function isPipelineStage(status) {
  return [PIPELINE_RAW, PIPELINE_LEAD, PIPELINE_QUALIFIED, PIPELINE_PROPOSAL].includes(status)
    || Object.keys(STATUS_TO_API).includes(status);
}

export function pipelineStageLabel(status) {
  return PIPELINE_STAGE_LABELS[status] || status?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';
}

export const LEAD_MODULE_STATUSES = [PIPELINE_LEAD];

export const RAW_LEAD_CSV_HEADERS = [
  'first_name', 'last_name', 'company', 'email', 'phone', 'mobile',
  'title', 'lead_source', 'industry', 'description',
];
