/** Sales pipeline stages — values must match API pipeline_stage enum */

export const PIPELINE_RAW = 'raw_prospect';
export const PIPELINE_LEAD = 'contacted';
export const PIPELINE_QUALIFIED = 'qualified_lead';
/** Proposal module is pipeline_stage=proposal (not a lead_source marker). */
export const PIPELINE_PROPOSAL = 'proposal';
/** Default outreach lead_status when creating a Proposal. */
export const PROPOSAL_DEFAULT_LEAD_STATUS = 'proposal_required';
/** @deprecated Never use "Proposal" as lead_source — convert/module uses pipeline_stage. */
export const PROPOSAL_SOURCE = 'Proposal';

/** Deal status values shown on proposal records */
export const PROPOSAL_DEAL_STATUSES = [
  { value: 'active_proposal', label: 'Active Proposal' },
  { value: 'deal_lost', label: 'Deal Lost' },
];

/** Proposal type values on proposal records */
export const PROPOSAL_TYPES = [
  { value: 'fixed_cost', label: 'Fixed Cost' },
  { value: 'time_and_material', label: 'Time & Material' },
];

export function proposalDealStatusLabel(status) {
  if (!status) return '—';
  const match = PROPOSAL_DEAL_STATUSES.find((s) => s.value === status);
  return match?.label || pipelineStageLabel(status);
}

export function proposalTypeLabel(type) {
  if (!type) return '—';
  const match = PROPOSAL_TYPES.find((t) => t.value === type);
  if (match) return match.label;
  if (type === 'time_&_material') return 'Time & Material';
  return String(type).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const PIPELINE_STAGE_ORDER = [
  PIPELINE_RAW,
  PIPELINE_LEAD,
  PIPELINE_QUALIFIED,
  PIPELINE_PROPOSAL,
];

export const PIPELINE_STAGE_LABELS = {
  [PIPELINE_RAW]: 'Cold Lead',
  [PIPELINE_LEAD]: 'Warm Lead',
  [PIPELINE_QUALIFIED]: 'Qualified Lead',
  [PIPELINE_PROPOSAL]: 'Proposal',
  deal_lost: 'Deal Lost',
};

export const PIPELINE_MODULE_PERMISSION = {
  [PIPELINE_RAW]: 'raw_leads',
  [PIPELINE_LEAD]: 'leads',
  [PIPELINE_QUALIFIED]: 'qualified_leads',
  [PIPELINE_PROPOSAL]: 'proposals',
};

export const CONVERT_TARGET_PERMISSION = {
  contact: 'contacts',
  lead: 'leads',
  contacted: 'leads',
  cold_lead: 'raw_leads',
  raw_prospect: 'raw_leads',
  qualified_lead: 'qualified_leads',
  qualified: 'qualified_leads',
  proposal: 'proposals',
  account: 'accounts',
};

/** Options for the unified Convert dropdown per pipeline stage */
export function getConvertOptions(stage, { isAdmin = false, can } = {}) {
  const allTargets = [
    { id: 'contact', label: 'Contact', type: CONVERT_TYPE.CONTACT, permissionKey: 'contacts' },
    {
      id: 'cold_lead',
      label: 'Cold Lead',
      type: CONVERT_TYPE.STAGE,
      target: PIPELINE_RAW,
      clearProposal: true,
      permissionKey: 'raw_leads',
    },
    {
      id: 'lead',
      label: 'Warm Lead',
      type: CONVERT_TYPE.STAGE,
      target: PIPELINE_LEAD,
      clearProposal: true,
      permissionKey: 'leads',
    },
    {
      id: 'qualified_lead',
      label: 'Qualified Lead',
      type: CONVERT_TYPE.STAGE,
      target: PIPELINE_QUALIFIED,
      clearProposal: true,
      permissionKey: 'qualified_leads',
    },
    {
      id: 'proposal',
      label: 'Proposal',
      type: CONVERT_TYPE.STAGE,
      target: PIPELINE_PROPOSAL,
      proposal: true,
      permissionKey: 'proposals',
    },
    { id: 'account', label: 'Account', type: CONVERT_TYPE.ACCOUNT, permissionKey: 'accounts' },
  ];

  const opts = allTargets
    .filter((option) => !(option.type === CONVERT_TYPE.STAGE && option.target === stage))
    .map((option) => ({
      ...option,
      disabled: !!(option.adminOnly && !isAdmin),
    }));

  if (typeof can !== 'function') return opts;
  return opts.filter((option) => {
    if (option.disabled) return false;
    const key = option.permissionKey
      || CONVERT_TARGET_PERMISSION[option.id]
      || CONVERT_TARGET_PERMISSION[option.target];
    return !key || can(key, 'view');
  });
}

/** Values that represent pipeline stage, not a selectable outreach Lead Status. */
const PIPELINE_STAGE_STATUS_VALUES = new Set([
  PIPELINE_RAW,
  PIPELINE_LEAD,
  PIPELINE_QUALIFIED,
  PIPELINE_PROPOSAL,
  'raw_prospect',
  'raw_lead',
  'cold_lead',
  'lead',
  'warm_lead',
  'contacted',
  'qualified_lead',
  'proposal',
]);

export function isPipelineStageStatus(value) {
  if (!value) return false;
  return PIPELINE_STAGE_STATUS_VALUES.has(String(value).trim().toLowerCase());
}

/** Lead Status dropdowns: outreach values only, not Cold/Warm/Qualified/Proposal. */
export function outreachLeadStatusOptions(options = []) {
  return (options || []).filter((option) => option?.value && !isPipelineStageStatus(option.value));
}

/** Map UI / legacy status strings to API lead_status values (never map proposal → qualified_lead). */
export const STATUS_TO_API = {
  raw_lead: 'raw_prospect',
  raw_prospect: 'raw_prospect',
  cold_lead: 'raw_prospect',
  lead: 'contacted',
  contacted: 'contacted',
  warm_lead: 'contacted',
  qualified_lead: 'qualified_lead',
  deal_lost: 'deal_lost',
};

export function toApiLeadStatus(status) {
  if (!status) return null;
  return STATUS_TO_API[status] || status;
}

/** True when a lead belongs in the Proposals module (pipeline_stage owns the module). */
export function isProposalLead(lead) {
  if (!lead) return false;

  const stage = String(lead.pipeline_stage || '').toLowerCase().trim();
  if (stage === PIPELINE_PROPOSAL || stage === 'proposal') return true;

  const currentStatus = String(lead.current_status || '').toLowerCase().trim();
  if (currentStatus === 'proposal') return true;

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

/** Outreach lead_status values that belong to the Raw Leads pipeline when pipeline_stage is unset. */
export const RAW_LEAD_OUTREACH_STATUSES = new Set([
  'not_contacted',
  'attempted_to_contact',
  'contact_in_future',
  'none',
  'junk_lead',
  'lost_lead',
  'pre_qualified',
  'not_qualified',
]);

/** Statuses that move a record out of the Raw Leads pipeline module. */
export const LEAD_PIPELINE_PROMOTION_STATUSES = new Set([
  'contacted',
  'qualified_lead',
  'deal_lost',
]);

export function isLeadPipelinePromotionStatus(status) {
  if (!status) return false;
  return LEAD_PIPELINE_PROMOTION_STATUSES.has(String(status).toLowerCase());
}

function resolvePipelineStageFromField(lead) {
  const stage = lead?.pipeline_stage;
  if (!stage) return null;
  const normalized = toApiLeadStatus(stage) || String(stage).toLowerCase().trim();
  if (normalized === PIPELINE_RAW || normalized === 'raw_prospect') return PIPELINE_RAW;
  if (normalized === PIPELINE_QUALIFIED || normalized === 'qualified_lead') return PIPELINE_QUALIFIED;
  if (normalized === PIPELINE_LEAD || normalized === 'contacted') return PIPELINE_LEAD;
  if (normalized === PIPELINE_PROPOSAL || normalized === 'proposal') return PIPELINE_PROPOSAL;
  return null;
}

export const PIPELINE_STAGE_CONFIG = {
  [PIPELINE_RAW]: {
    listPath: '/raw-leads',
    detailPath: (id) => `/raw-leads/${id}`,
    listTitle: 'Cold Leads',
    apiStatus: PIPELINE_RAW,
    convertTo: { status: PIPELINE_LEAD, label: 'Warm Lead', redirectPath: '/leads' },
    allowAssign: true,
    allowUpload: true,
  },
  [PIPELINE_QUALIFIED]: {
    listPath: '/qualified-leads',
    detailPath: (id) => `/qualified-leads/${id}`,
    listTitle: 'Qualified Leads',
    apiStatus: null,
    convertTo: { status: PIPELINE_PROPOSAL, label: 'Proposal', redirectPath: '/proposals', proposal: true },
    allowAssign: false,
    allowUpload: false,
  },
  [PIPELINE_PROPOSAL]: {
    listPath: '/proposals',
    detailPath: (id) => `/proposals/${id}`,
    listTitle: 'Proposals',
    apiStatus: null,
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
  CONTACT: 'contact',
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

export function convertOptionsToLookup(options = []) {
  return options.map((option) => ({
    value: option.type === CONVERT_TYPE.ACCOUNT
      ? 'account'
      : option.type === CONVERT_TYPE.CONTACT
        ? 'contact'
        : (option.target || option.id),
    label: option.label,
    permissionKey: option.permissionKey,
  }));
}

export function filterConvertLookupOptions(options = [], can) {
  if (typeof can !== 'function') return options;
  return (options || []).filter((option) => {
    const value = String(option?.value || option?.id || '').toLowerCase();
    const key = option?.permissionKey || CONVERT_TARGET_PERMISSION[value];
    return !key || can(key, 'view');
  });
}

export function resolveLeadPipelineStage(lead) {
  if (!lead) return null;
  if (isProposalLead(lead)) return PIPELINE_PROPOSAL;

  const fromPipelineField = resolvePipelineStageFromField(lead);
  if (fromPipelineField) return fromPipelineField;

  const status = normalizedLeadStatus(lead);
  if (status === 'qualified_lead') return PIPELINE_QUALIFIED;
  if (status === 'raw_prospect') return PIPELINE_RAW;
  if (status === 'contacted') return PIPELINE_LEAD;
  if (RAW_LEAD_OUTREACH_STATUSES.has(status)) return PIPELINE_RAW;
  if (status && !isLeadPipelinePromotionStatus(status)) return PIPELINE_RAW;
  return status || null;
}

export const RAW_LEAD_CSV_HEADERS = [
  'first_name', 'last_name', 'company', 'email', 'phone', 'mobile',
  'title', 'lead_source', 'industry', 'description', 'campaign_name',
];
