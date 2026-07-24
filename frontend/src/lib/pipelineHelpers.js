/** Sales pipeline stages — values must match API LeadStatus enum */

export const PIPELINE_RAW = 'raw_prospect';
export const PIPELINE_LEAD = 'contacted';
export const PIPELINE_QUALIFIED = 'qualified_lead';
/** Proposal is tracked as qualified_lead + lead_source marker (API has no proposal status) */
export const PIPELINE_PROPOSAL = 'proposal';
export const PROPOSAL_SOURCE = 'Proposal';

/** Deal status values shown on proposal records */
export const PROPOSAL_DEAL_STATUSES = [
  { value: 'active_proposal', label: 'Active Proposal' },
  { value: 'deal_lost', label: 'Deal Lost' },
];

export function proposalDealStatusLabel(status) {
  if (!status) return '—';
  const match = PROPOSAL_DEAL_STATUSES.find((s) => s.value === status);
  return match?.label || pipelineStageLabel(status);
}

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
  const source = String(lead?.lead_source || lead?.source || '').trim();
  if (source && source.toLowerCase() === PROPOSAL_SOURCE.toLowerCase()) return true;
  if (lead?.pipeline_stage === PIPELINE_PROPOSAL) return true;
  return false;
}

function isConvertedLead(lead) {
  return !!(lead?.is_converted || lead?.converted);
}

export function filterLeadsByPipelineStage(leads, stage) {
  const active = (leads || []).filter((l) => !isConvertedLead(l));

  if (stage === PIPELINE_PROPOSAL) {
    return active.filter(isProposalLead);
  }
  if (stage === PIPELINE_QUALIFIED) {
    return active.filter((l) => resolveLeadPipelineStage(l) === PIPELINE_QUALIFIED);
  }
  if (stage === PIPELINE_RAW) {
    return active.filter((l) => resolveLeadPipelineStage(l) === PIPELINE_RAW);
  }
  return active.filter((l) => resolveLeadPipelineStage(l) === stage);
}

function normalizedLeadStatus(lead) {
  const raw = lead?.lead_status ?? lead?.status;
  if (!raw) return null;
  const mapped = toApiLeadStatus(raw);
  if (mapped) return mapped;
  const key = String(raw).toLowerCase().trim().replace(/\s+/g, '_');
  return toApiLeadStatus(key) || key;
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

/** Convert menu targets */
export const CONVERT_TYPE = {
  STAGE: 'stage',
  ACCOUNT: 'account',
};

const CONVERT_REDIRECT = {
  [PIPELINE_LEAD]: (id) => `/leads/${id}`,
  [PIPELINE_QUALIFIED]: (id) => `/qualified-leads/${id}`,
  [PIPELINE_PROPOSAL]: (id) => `/proposals/${id}`,
  [PIPELINE_RAW]: (id) => `/raw-leads/${id}`,
};

export function getConvertRedirectPath(target, leadId) {
  const fn = CONVERT_REDIRECT[target];
  return fn ? fn(leadId) : `/leads/${leadId}`;
}

/** Detail URL for a lead based on pipeline stage (recent items, links). */
export function getLeadDetailPath(leadOrStage, leadId) {
  const stage = typeof leadOrStage === 'object' ? resolveLeadPipelineStage(leadOrStage) : leadOrStage;
  if (stage && CONVERT_REDIRECT[stage]) return CONVERT_REDIRECT[stage](leadId);
  return `/leads/${leadId}`;
}

/** Options for the unified Convert dropdown per pipeline stage */
export function getConvertOptions(stage, { isAdmin = false } = {}) {
  const opts = [];
  const add = (option) => {
    const disabled = option.adminOnly && !isAdmin;
    opts.push({ ...option, disabled });
  };

  if (stage === PIPELINE_LEAD) {
    add({ id: 'qualified_lead', label: 'Qualified Lead', type: CONVERT_TYPE.STAGE, target: PIPELINE_QUALIFIED });
    add({ id: 'proposal', label: 'Proposal', type: CONVERT_TYPE.STAGE, target: PIPELINE_PROPOSAL, proposal: true });
    add({ id: 'account', label: 'Account', type: CONVERT_TYPE.ACCOUNT });
  } else if (stage === PIPELINE_QUALIFIED) {
    add({ id: 'proposal', label: 'Proposal', type: CONVERT_TYPE.STAGE, target: PIPELINE_PROPOSAL, proposal: true });
    add({ id: 'account', label: 'Account', type: CONVERT_TYPE.ACCOUNT });
  } else if (stage === PIPELINE_PROPOSAL) {
    add({ id: 'account', label: 'Account', type: CONVERT_TYPE.ACCOUNT });
    add({ id: 'lead', label: 'Lead', type: CONVERT_TYPE.STAGE, target: PIPELINE_LEAD, clearProposal: true, adminOnly: true });
  } else if (stage === PIPELINE_RAW) {
    add({ id: 'lead', label: 'Lead', type: CONVERT_TYPE.STAGE, target: PIPELINE_LEAD });
    add({ id: 'qualified_lead', label: 'Qualified Lead', type: CONVERT_TYPE.STAGE, target: PIPELINE_QUALIFIED });
    add({ id: 'proposal', label: 'Proposal', type: CONVERT_TYPE.STAGE, target: PIPELINE_PROPOSAL, proposal: true });
    add({ id: 'account', label: 'Account', type: CONVERT_TYPE.ACCOUNT });
  }

  return opts;
}

export function resolveLeadPipelineStage(lead) {
  if (!lead) return null;
  if (isProposalLead(lead)) return PIPELINE_PROPOSAL;
  const status = normalizedLeadStatus(lead);
  if (status === 'qualified_lead') return PIPELINE_QUALIFIED;
  if (status === 'raw_prospect') return PIPELINE_RAW;
  if (status === 'contacted') return PIPELINE_LEAD;
  return status || null;
}

export const RAW_LEAD_CSV_HEADERS = [
  'first_name', 'last_name', 'company', 'email', 'phone', 'mobile',
  'title', 'lead_source', 'industry', 'description',
];
