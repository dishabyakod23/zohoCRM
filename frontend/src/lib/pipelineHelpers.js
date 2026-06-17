/** Sales pipeline stages stored in lead_status */

export const PIPELINE_RAW = 'raw_lead';
export const PIPELINE_LEAD = 'lead';
export const PIPELINE_QUALIFIED = 'qualified_lead';
export const PIPELINE_PROPOSAL = 'proposal';

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
};

export const PIPELINE_STAGE_CONFIG = {
  [PIPELINE_RAW]: {
    listPath: '/raw-leads',
    detailPath: (id) => `/raw-leads/${id}`,
    listTitle: 'Raw Leads',
    convertTo: { status: PIPELINE_LEAD, label: 'Lead', redirectPath: '/leads' },
    allowAssign: true,
    allowUpload: true,
  },
  [PIPELINE_QUALIFIED]: {
    listPath: '/qualified-leads',
    detailPath: (id) => `/qualified-leads/${id}`,
    listTitle: 'Qualified Leads',
    convertTo: { status: PIPELINE_PROPOSAL, label: 'Proposal', redirectPath: '/proposals' },
    allowAssign: false,
    allowUpload: false,
  },
  [PIPELINE_PROPOSAL]: {
    listPath: '/proposals',
    detailPath: (id) => `/proposals/${id}`,
    listTitle: 'Proposals',
    convertTo: null,
    allowAssign: false,
    allowUpload: false,
  },
};

export function isPipelineStage(status) {
  return PIPELINE_STAGE_ORDER.includes(status);
}

export function pipelineStageLabel(status) {
  return PIPELINE_STAGE_LABELS[status] || status?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';
}

export function getPipelineConfig(status) {
  return PIPELINE_STAGE_CONFIG[status] || null;
}

/** Statuses shown on the main Leads module (working leads, not other pipeline buckets) */
export const LEAD_MODULE_STATUSES = [PIPELINE_LEAD];

export const RAW_LEAD_CSV_HEADERS = [
  'first_name', 'last_name', 'company', 'email', 'phone', 'mobile',
  'title', 'lead_source', 'industry', 'description',
];
