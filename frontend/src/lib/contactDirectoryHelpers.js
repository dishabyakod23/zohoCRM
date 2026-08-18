import {
  getLeadDetailPath,
  resolveLeadPipelineStage,
  pipelineStageLabel,
  isPipelineStageStatus,
  PIPELINE_PROPOSAL,
  PIPELINE_QUALIFIED,
  PIPELINE_LEAD,
  PIPELINE_RAW,
} from './pipelineHelpers.js';
import { includesText, matchLeadStatus, matchesRecordTimestampFilters } from './listRecordFilters.js';
import { leadStatusLabel } from './leadHelpers.js';

export const DIRECTORY_STATUS_OPTIONS = [
  { value: 'Contact', label: 'Contact' },
  { value: 'Cold Lead', label: 'Cold Lead' },
  { value: 'Warm Lead', label: 'Warm Lead' },
  { value: 'Qualified Lead', label: 'Qualified Lead' },
  { value: 'Proposal', label: 'Proposal' },
  { value: 'Deal', label: 'Deal' },
  { value: 'Account', label: 'Account' },
];

const STATUS_PRIORITY = {
  Account: 700,
  Deal: 650,
  Proposal: 500,
  'Qualified Lead': 400,
  'Warm Lead': 300,
  Lead: 300,
  'Cold Lead': 200,
  'Raw Lead': 200,
  Contact: 100,
};

const LEGACY_DIRECTORY_STATUS = {
  'Raw Lead': 'Cold Lead',
  Lead: 'Warm Lead',
};

const DIRECTORY_STATUS_ALIASES = {
  contact: 'Contact',
  'cold lead': 'Cold Lead',
  'raw lead': 'Cold Lead',
  'raw prospect': 'Cold Lead',
  lead: 'Warm Lead',
  'warm lead': 'Warm Lead',
  'qualified lead': 'Qualified Lead',
  proposal: 'Proposal',
  deal: 'Deal',
  account: 'Account',
};

export function normalizeDirectoryStatusLabel(label) {
  if (label == null || label === '') return label;
  const trimmed = String(label).trim();
  if (LEGACY_DIRECTORY_STATUS[trimmed]) return LEGACY_DIRECTORY_STATUS[trimmed];
  return DIRECTORY_STATUS_ALIASES[trimmed.toLowerCase()] || trimmed;
}

/** Pipeline place only — never treat outreach lead_status as Current Status. */
function directoryPipelineStage(record) {
  const fromField = resolveLeadPipelineStage({
    pipeline_stage: record?.pipeline_stage,
    lead_source: record?.lead_source,
    source: record?.source,
  });
  if (fromField) return fromField;

  const entityType = String(
    record?.entity_type || record?._entityType || record?.record_type || '',
  ).toLowerCase();
  if (entityType === 'raw_lead') return PIPELINE_RAW;
  if (entityType === 'qualified_lead') return PIPELINE_QUALIFIED;
  if (entityType === 'proposal') return PIPELINE_PROPOSAL;

  const status = record?.lead_status ?? record?.status;
  if (isPipelineStageStatus(status)) {
    return resolveLeadPipelineStage({
      lead_status: status,
      pipeline_stage: record?.pipeline_stage,
    });
  }
  const statusLabel = normalizeDirectoryStatusLabel(status);
  if (statusLabel === 'Cold Lead') return PIPELINE_RAW;
  if (statusLabel === 'Warm Lead') return PIPELINE_LEAD;
  if (statusLabel === 'Qualified Lead') return PIPELINE_QUALIFIED;
  if (statusLabel === 'Proposal') return PIPELINE_PROPOSAL;
  return null;
}

function normEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function statusPriorityForLabel(label) {
  return STATUS_PRIORITY[label] ?? 0;
}

export function isConvertedToAccount(record) {
  return !!(record?.is_converted || record?.converted || record?.converted_to_account);
}

/**
 * Pipeline status for the unified Contacts list.
 * Current Status = where the person sits in the CRM (Cold Lead, Warm Lead, Contact, …).
 * Lead Status is a separate outreach field and is never copied into Current Status.
 */
export function resolveDirectoryCurrentStatus(record) {
  if (isConvertedToAccount(record)) return 'Account';

  const entityType = String(
    record?.entity_type || record?._entityType || record?.record_type || 'contact',
  ).toLowerCase();

  const stage = directoryPipelineStage(record);
  const stageLabel = stage ? pipelineStageLabel(stage) : null;
  const fromApi = normalizeDirectoryStatusLabel(record?.current_status);

  if (entityType === 'deal') return 'Deal';
  if (entityType === 'account') return 'Account';
  if (entityType === 'raw_lead') return 'Cold Lead';
  if (entityType === 'qualified_lead') return 'Qualified Lead';
  if (entityType === 'proposal') return 'Proposal';

  if (entityType === 'lead') {
    return stageLabel || fromApi || 'Warm Lead';
  }

  if (stageLabel && stageLabel !== '—' && (!fromApi || fromApi === 'Contact')) {
    return stageLabel;
  }

  if (fromApi) {
    if (entityType === 'contact' && fromApi === 'Account' && !isConvertedToAccount(record)) {
      return 'Contact';
    }
    return fromApi;
  }

  if (stageLabel && stageLabel !== '—') return stageLabel;
  return 'Contact';
}

/** Outreach Lead Status only — pipeline values like raw_prospect stay blank. */
export function directoryLeadStatusValue(record) {
  const raw = record?.lead_status ?? record?.status;
  if (!raw) return null;
  if (isPipelineStageStatus(raw)) return null;
  const label = String(raw).trim();
  if (!label || label === '—' || label.toLowerCase() === 'none') return null;
  const normalizedLabel = normalizeDirectoryStatusLabel(label);
  if (['Cold Lead', 'Warm Lead', 'Qualified Lead', 'Proposal', 'Contact', 'Account', 'Deal'].includes(normalizedLabel)) {
    return null;
  }
  return raw;
}

export function leadToDirectoryRow(lead, statusOptions = []) {
  const stage = resolveLeadPipelineStage(lead);
  const isConverted = !!(lead?.is_converted || lead?.converted);
  const current_status = isConverted
    ? 'Account'
    : (pipelineStageLabel(stage) || 'Cold Lead');
  const lead_status = directoryLeadStatusValue(lead);

  return {
    id: lead.id,
    _entityType: 'lead',
    _detailHref: getLeadDetailPath(lead, lead.id),
    first_name: lead.first_name,
    last_name: lead.last_name,
    title: lead.title,
    email: lead.email,
    phone: lead.phone,
    mobile: lead.mobile,
    account_name: lead.company || lead.account_name,
    campaign_id: lead.campaign_id,
    campaign_name: lead.campaign_name,
    owner_id: lead.owner_id,
    owner_name: lead.owner_name,
    lead_status,
    lead_status_label: lead_status ? (leadStatusLabel(lead_status, statusOptions) || lead_status) : '—',
    current_status,
    _statusPriority: statusPriorityForLabel(current_status),
    updated_at: lead.updated_at,
    created_at: lead.created_at,
  };
}

export function contactToDirectoryRow(contact) {
  const current_status = resolveDirectoryCurrentStatus({ ...contact, entity_type: 'contact' });
  const lead_status = directoryLeadStatusValue(contact);

  return {
    ...contact,
    _entityType: 'contact',
    _detailHref: `/contacts/${contact.id}`,
    lead_status,
    lead_status_label: lead_status ? (leadStatusLabel(lead_status) || lead_status) : '—',
    current_status,
    _statusPriority: statusPriorityForLabel(current_status),
  };
}

export function dealToDirectoryRow(deal, contactLookup = {}) {
  if (!deal?.contact_id) return null;
  const linked = contactLookup[deal.contact_id];
  const current_status = 'Deal';
  return {
    id: deal.contact_id,
    _entityType: 'contact',
    _detailHref: `/contacts/${deal.contact_id}`,
    first_name: linked?.first_name || deal.contact_name?.split(' ')?.[0] || '',
    last_name: linked?.last_name || deal.contact_name?.split(' ')?.slice(1).join(' ') || '',
    title: linked?.title || deal.contact_role || null,
    email: linked?.email || null,
    phone: linked?.phone || null,
    mobile: linked?.mobile || null,
    account_name: deal.account_name || linked?.account_name,
    campaign_id: linked?.campaign_id,
    campaign_name: linked?.campaign_name,
    owner_id: deal.owner_id || linked?.owner_id,
    owner_name: deal.owner_name || linked?.owner_name,
    current_status,
    _statusPriority: statusPriorityForLabel(current_status),
    updated_at: deal.updated_at || linked?.updated_at,
    created_at: deal.created_at || linked?.created_at,
  };
}

function directoryDedupeKey(row) {
  const email = normEmail(row.email);
  if (email) return `email:${email}`;
  const phone = normPhone(row.phone || row.mobile);
  if (phone) return `phone:${phone}`;
  const name = `${String(row.first_name || '').trim()}|${String(row.last_name || '').trim()}`.toLowerCase();
  const company = String(row.account_name || '').trim().toLowerCase();
  if (name.replace('|', '')) return `name:${name}|${company}`;
  return `id:${row._entityType}:${row.id}`;
}

function mergeRowFields(primary, secondary) {
  return {
    ...secondary,
    ...primary,
    title: primary.title || secondary.title,
    email: primary.email || secondary.email,
    phone: primary.phone || secondary.phone,
    mobile: primary.mobile || secondary.mobile,
    account_name: primary.account_name || secondary.account_name,
    campaign_id: primary.campaign_id || secondary.campaign_id,
    campaign_name: primary.campaign_name || secondary.campaign_name,
    owner_id: primary.owner_id || secondary.owner_id,
    owner_name: primary.owner_name || secondary.owner_name,
    _detailHref: primary._detailHref || secondary._detailHref,
    _entityType: primary._entityType || secondary._entityType,
    current_status: primary.current_status,
    lead_status: primary.lead_status ?? secondary.lead_status,
    _statusPriority: primary._statusPriority,
  };
}

function pickPreferredRow(existing, candidate) {
  const existingPri = existing._statusPriority ?? statusPriorityForLabel(existing.current_status);
  const candidatePri = candidate._statusPriority ?? statusPriorityForLabel(candidate.current_status);
  if (candidatePri > existingPri) return mergeRowFields(candidate, existing);
  if (candidatePri < existingPri) return mergeRowFields(existing, candidate);
  const existingUpdated = new Date(existing.updated_at || 0).getTime();
  const candidateUpdated = new Date(candidate.updated_at || 0).getTime();
  return candidateUpdated >= existingUpdated
    ? mergeRowFields(candidate, existing)
    : mergeRowFields(existing, candidate);
}

/** Merge rows from every CRM source and keep one row per person with the highest pipeline status. */
export function dedupeDirectoryRows(rows = []) {
  const map = new Map();
  for (const row of rows) {
    if (!row) continue;
    const key = directoryDedupeKey(row);
    const existing = map.get(key);
    map.set(key, existing ? pickPreferredRow(existing, row) : row);
  }
  return [...map.values()];
}

export function buildDirectoryRows({
  contacts = [],
  leads = [],
  deals = [],
  statusOptions = [],
} = {}) {
  const contactLookup = Object.fromEntries(contacts.map((c) => [String(c.id), c]));
  const rows = [
    ...contacts.map(contactToDirectoryRow),
    ...leads.map((lead) => leadToDirectoryRow(lead, statusOptions)),
    ...deals.map((deal) => dealToDirectoryRow(deal, contactLookup)).filter(Boolean),
  ];
  return dedupeDirectoryRows(rows);
}

/** @deprecated Use buildDirectoryRows + dedupeDirectoryRows */
export function mergeContactDirectoryRows(contacts = [], leads = [], statusOptions = []) {
  return buildDirectoryRows({ contacts, leads, statusOptions });
}

export function applyContactDirectoryFilters(rows = [], filters = {}) {
  return (rows || []).filter((row) => {
    if (!includesText(row.account_name, filters.company)) return false;
    if (!includesText(row.title, filters.designation)) return false;
    if (filters.current_status && row.current_status !== filters.current_status) return false;
    if (filters.lead_status && !matchLeadStatus(row, filters.lead_status)) return false;
    if (!matchesRecordTimestampFilters(row, filters)) return false;
    return true;
  });
}

export function inferLeadStatusLabel(stage) {
  switch (stage) {
    case PIPELINE_RAW: return 'Cold Lead';
    case PIPELINE_LEAD: return 'Warm Lead';
    case PIPELINE_QUALIFIED: return 'Qualified Lead';
    case PIPELINE_PROPOSAL: return 'Proposal';
    default: return pipelineStageLabel(stage) || 'Warm Lead';
  }
}
