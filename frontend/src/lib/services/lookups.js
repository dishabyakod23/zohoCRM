import api from '../api.js';
import { leadStatusLabel } from '../leadHelpers.js';
import { dealStageLabel, FALLBACK_DEAL_STAGES } from '../dealHelpers.js';
import { parseLookupOptions } from '../recordHelpers.js';
import { LEAD_SOURCES, RATINGS } from '../constants.js';
import { PIPELINE_RAW } from '../pipelineHelpers.js';
import { cachedLookup } from '../lookupCache.js';
import { fetchCampaignLookups } from '../campaignRecordHelpers.js';
import { mergeStoredProfileImage } from '../profileImageHelpers.js';
import { FALLBACK_LOST_REASONS } from '../statusHelpers.js';

/** Fallback when GET /lookups/lead-sources is unavailable */
export const FALLBACK_LEAD_SOURCES = LEAD_SOURCES.map((source) => ({
  value: source,
  label: source,
}));

/** Fallback when lookups API is unavailable */
export const FALLBACK_LEAD_STATUSES = [
  { value: 'raw_prospect', label: 'Cold Lead' },
  { value: 'contacted', label: 'Warm Lead' },
  { value: 'qualified_lead', label: 'Qualified Lead' },
  { value: 'deal_lost', label: 'Deal Lost' },
  { value: 'not_contacted', label: 'Not Contacted' },
  { value: 'attempted_to_contact', label: 'Attempted to Contact' },
  { value: 'pre_qualified', label: 'Pre-Qualified' },
  { value: 'not_qualified', label: 'Not Qualified' },
  { value: 'junk_lead', label: 'Junk Lead' },
  { value: 'lost_lead', label: 'Lost Lead' },
  { value: 'proposal_required', label: 'Proposal Required' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'negotiation', label: 'Negotiation' },
];

/** Normalize GET /lookups/lead-statuses → { value, label }[] */
export function parseLeadStatusLookups(data) {
  if (!Array.isArray(data) || data.length === 0) return FALLBACK_LEAD_STATUSES;

  return data.map((item) => {
    if (typeof item === 'string') {
      return { value: item, label: leadStatusLabel(item) };
    }
    const value = item.value ?? item.key ?? item.code ?? item.id ?? item.status;
    let label = item.label ?? item.name ?? item.display_name ?? item.title ?? leadStatusLabel(value);
    if (value === 'raw_prospect' || value === 'raw_lead') label = 'Cold Lead';
    if (value === 'contacted' || value === 'lead') label = 'Warm Lead';
    if (label === 'Raw Lead' || label === 'Raw Prospect') label = 'Cold Lead';
    if (label === 'Lead' && (value === 'contacted' || value === 'lead')) label = 'Warm Lead';
    return { value, label };
  }).filter((item) => item.value);
}

export async function fetchLeadStatuses() {
  return cachedLookup('lead-statuses', async () => {
    try {
      const res = await api.get('/lookups/lead-statuses');
      const options = parseLeadStatusLookups(res.data.data);
      return options.length ? options : FALLBACK_LEAD_STATUSES;
    } catch {
      return FALLBACK_LEAD_STATUSES;
    }
  });
}

export async function fetchUsers() {
  return cachedLookup('users', async () => {
    const res = await api.get('/lookups/users');
    return (res.data.data || []).map((u) => mergeStoredProfileImage({
      ...u,
      name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
    }));
  });
}

export async function fetchDealStages() {
  return cachedLookup('deal-stages', async () => {
    const res = await api.get('/lookups/deal-stages');
    const options = parseLookupOptions(res.data.data, dealStageLabel);
    return options.length ? options : FALLBACK_DEAL_STAGES;
  });
}

export async function fetchAccountLookups() {
  return cachedLookup('accounts', async () => {
    const res = await api.get('/lookups/accounts');
    return parseLookupOptions(res.data.data).map(a => ({ ...a, name: a.label }));
  });
}

export async function fetchCompanyLookups() {
  return cachedLookup('companies', async () => {
    const res = await api.get('/lookups/companies');
    return parseLookupOptions(res.data.data).map((company) => ({
      ...company,
      name: company.label,
    }));
  });
}

export async function fetchContactLookups() {
  return cachedLookup('contacts', async () => {
    const res = await api.get('/lookups/contacts');
    return (res.data.data || []).map((c) => ({
      value: c.value ?? c.id,
      label: (c.label ?? `${c.first_name || ''} ${c.last_name || ''}`.trim()) || c.email || c.value,
      email: c.email,
    })).filter((c) => c.value);
  });
}

async function fetchLookup(path, labelFn) {
  const res = await api.get(path);
  return parseLookupOptions(res.data.data, labelFn);
}

export const fetchTaskStatuses = () => fetchLookup('/lookups/task-statuses', formatLookupLabel);
export const fetchTaskPriorities = () => fetchLookup('/lookups/task-priorities', formatLookupLabel);
export const fetchCallTypes = () => fetchLookup('/lookups/call-types', formatLookupLabel);
export const fetchCampaignTypes = () => fetchLookup('/lookups/campaign-types', formatLookupLabel);
export const fetchCampaignStatuses = () => fetchLookup('/lookups/campaign-statuses', formatLookupLabel);
export const fetchProjectStatuses = () => fetchLookup('/lookups/project-statuses', formatLookupLabel);
export const fetchVisitStatuses = () => fetchLookup('/lookups/visit-statuses', formatLookupLabel);

/** GET /lookups/industries → { value, label }[] */
export async function fetchIndustries() {
  return cachedLookup('industries', async () => {
    const res = await api.get('/lookups/industries');
    return parseLookupOptions(res.data.data);
  });
}

/** GET /lookups/countries → { value, label }[] */
export async function fetchCountries() {
  return cachedLookup('countries', async () => {
    const res = await api.get('/lookups/countries');
    return parseLookupOptions(res.data.data);
  });
}

/** GET /lookups/states?country={country} → { value, label }[] */
export async function fetchStates(country) {
  const key = String(country || '').trim();
  if (!key) return [];
  return cachedLookup(`states:${key}`, async () => {
    const res = await api.get('/lookups/states', { params: { country: key } });
    return parseLookupOptions(res.data.data);
  });
}

function formatLookupLabel(value) {
  if (!value) return '—';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const MASS_UPDATE_FIELD_LOOKUPS = {
  lead_status: '/lookups/lead-statuses',
  status: '/lookups/lead-statuses',
  source: '/lookups/lead-sources',
  lead_source: '/lookups/lead-sources',
  industry: '/lookups/industries',
  convert: '/lookups/pipeline-convert-targets',
  owner_id: '/lookups/users',
  owner: '/lookups/users',
  lead_owner: '/lookups/users',
};

export function isLeadOwnerMassUpdateField(fieldDef) {
  if (!fieldDef) return false;
  const field = normalizeMassUpdateField(fieldDef);
  const value = String(field.value || '').toLowerCase();
  const label = String(field.label || '').toLowerCase();
  return value === 'owner_id'
    || value === 'owner'
    || value === 'lead_owner'
    || label === 'owner'
    || label === 'lead owner'
    || label.includes('lead owner');
}

/** Proposal-only mass-update fields — hide on Raw Leads, Leads, and Qualified Leads. */
export const PROPOSAL_ONLY_MASS_UPDATE_FIELDS = new Set([
  'proposal_type',
  'amc_it_support',
  'amc_currency',
]);

export function isProposalOnlyMassUpdateField(fieldDef) {
  if (!fieldDef) return false;
  const value = String(normalizeMassUpdateField(fieldDef).value || '').toLowerCase();
  return PROPOSAL_ONLY_MASS_UPDATE_FIELDS.has(value);
}

export function isProposalMassUpdateModule({ moduleKey, pipelineStage } = {}) {
  const module = String(moduleKey || '').toLowerCase();
  const stage = String(pipelineStage || '').toLowerCase();
  return module === 'proposals' || stage === 'proposal';
}

/** Filter mass-update fields by permission and module/stage. */
export function filterLeadMassUpdateFields(fields, {
  canChangeOwner = false,
  moduleKey,
  pipelineStage,
} = {}) {
  const showProposalFields = isProposalMassUpdateModule({ moduleKey, pipelineStage });
  return (fields || []).filter((f) => {
    if (!canChangeOwner && isLeadOwnerMassUpdateField(f)) return false;
    if (!showProposalFields && isProposalOnlyMassUpdateField(f)) return false;
    return true;
  });
}

export function isConvertMassUpdateField(fieldDef) {
  if (!fieldDef) return false;
  const field = normalizeMassUpdateField(fieldDef);
  const value = String(field.value || '').toLowerCase();
  const label = String(field.label || '').toLowerCase();
  const lookup = String(field.lookup || '').toLowerCase();
  return field.type === 'convert'
    || value === 'convert'
    || value === 'pipeline_convert'
    || value === 'pipeline_convert_target'
    || label === 'convert'
    || lookup.includes('pipeline-convert-targets')
    || lookup.includes('convert-target');
}

export function normalizeMassUpdateField(raw = {}) {
  const value = raw.value ?? raw.field ?? raw.key;
  const lookup = raw.lookup ?? raw.lookup_path ?? raw.options_endpoint ?? raw.options_url ?? null;
  return {
    value,
    label: raw.label ?? raw.name ?? value,
    type: raw.type ?? (String(value || '').toLowerCase() === 'convert' ? 'convert' : 'select'),
    lookup,
    options: raw.options,
  };
}

export async function fetchLeadSources() {
  return cachedLookup('lead-sources', async () => {
    const res = await api.get('/lookups/lead-sources');
    // Never treat "Proposal" as a lead source — module membership is pipeline_stage.
    return parseLookupOptions(res.data.data).filter((option) => (
      String(option.value || '').toLowerCase() !== 'proposal'
      && String(option.label || '').toLowerCase() !== 'proposal'
    ));
  });
}

export async function fetchLeadMassUpdateFields({
  canChangeOwner = false,
  moduleKey,
  pipelineStage,
} = {}) {
  const res = await api.get('/lookups/lead-mass-update-fields');
  const fields = (res.data.data || []).map(normalizeMassUpdateField);
  return filterLeadMassUpdateFields(fields, { canChangeOwner, moduleKey, pipelineStage });
}

/** Hide Deal from mass-update convert target dropdowns. */
export function filterPipelineConvertTargets(options = []) {
  return (options || []).filter((option) => {
    const value = String(option?.value ?? '').toLowerCase().trim();
    const label = String(option?.label ?? '').toLowerCase().trim();
    return value !== 'deal' && label !== 'deal';
  });
}

/** Remap legacy convert-target labels to Cold/Warm Lead for mass-update Convert. */
export function remapPipelineConvertTargetLabels(options = []) {
  return (options || []).map((option) => {
    if (!option) return option;
    const value = String(option.value ?? '').toLowerCase().trim();
    const label = String(option.label ?? '').trim();
    const labelLower = label.toLowerCase();

    let nextLabel = label;
    if (
      labelLower === 'raw lead'
      || labelLower === 'raw prospect'
      || value === 'raw_prospect'
      || value === 'raw_lead'
      || value === 'cold_lead'
    ) {
      nextLabel = 'Cold Lead';
    } else if (
      label === 'Lead'
      || labelLower === 'lead'
      || value === 'contacted'
      || value === 'lead'
      || value === 'warm_lead'
    ) {
      // Exact "Lead" only — do not remap "Qualified Lead"
      if (labelLower !== 'qualified lead' && value !== 'qualified_lead') {
        nextLabel = 'Warm Lead';
      }
    }

    return nextLabel === label ? option : { ...option, label: nextLabel };
  });
}

export const CONTACT_CONVERT_TARGET = { value: 'contact', label: 'Contact' };

/** Cold leads can be moved back to the Contacts pool. */
export function mergeContactConvertTarget(options = [], { moduleKey, pipelineStage } = {}) {
  const stage = String(pipelineStage || '').toLowerCase();
  const isColdLeadsModule = moduleKey === 'raw-leads'
    || stage === 'raw_prospect'
    || stage === PIPELINE_RAW;
  if (!isColdLeadsModule) return options;

  const hasContact = (options || []).some(
    (option) => String(option?.value ?? '').toLowerCase() === 'contact',
  );
  if (hasContact) return options;
  return [CONTACT_CONVERT_TARGET, ...(options || [])];
}

export async function fetchPipelineConvertTargets({ moduleKey, pipelineStage } = {}) {
  const baseOptions = await cachedLookup('pipeline-convert-targets', async () => {
    try {
      const res = await api.get('/lookups/pipeline-convert-targets');
      return remapPipelineConvertTargetLabels(
        filterPipelineConvertTargets(parseLookupOptions(res.data.data)),
      );
    } catch {
      return [];
    }
  });
  return mergeContactConvertTarget(baseOptions, { moduleKey, pipelineStage });
}

export async function fetchLostReasons() {
  try {
    const res = await api.get('/lookups/lost-reasons');
    const options = parseLookupOptions(res.data.data).map((o) => ({
      ...o,
      value: String(o.value),
    }));
    return options.length ? options : FALLBACK_LOST_REASONS;
  } catch {
    return FALLBACK_LOST_REASONS;
  }
}

export const fetchCampaignMemberStatuses = () => fetchLookup('/lookups/campaign-member-statuses', formatLookupLabel);

function isLeadStatusMassUpdateField(field) {
  const value = String(field?.value || '').toLowerCase();
  return value === 'lead_status' || value === 'status';
}

/** Load dropdown options for a mass-update field from its lookup API (or embedded options). */
export async function fetchMassUpdateFieldOptions(fieldDef) {
  const field = normalizeMassUpdateField(fieldDef);

  if (isConvertMassUpdateField(field)) {
    return fetchPipelineConvertTargets();
  }

  if (String(field.value || '').toLowerCase() === 'campaign') {
    return fetchCampaignLookups();
  }

  // Always load full lead status list (includes admin custom statuses).
  if (isLeadStatusMassUpdateField(field)) {
    return fetchLeadStatuses();
  }

  if (Array.isArray(field.options) && field.options.length) {
    return parseLookupOptions(field.options);
  }

  let lookupPath = field.lookup || MASS_UPDATE_FIELD_LOOKUPS[field.value];
  if (lookupPath) {
    if (lookupPath.startsWith('/api/v1/')) lookupPath = lookupPath.replace('/api/v1', '');
    if (!lookupPath.startsWith('/')) lookupPath = `/lookups/${lookupPath.replace(/^\/lookups\//, '')}`;
    try {
      const res = await api.get(lookupPath);
      const labelFn = lookupPath.includes('lead-status') ? leadStatusLabel : undefined;
      const options = parseLookupOptions(res.data.data, labelFn);
      if (options.length) return options;
      if (lookupPath.includes('lead-status')) return FALLBACK_LEAD_STATUSES;
    } catch {
      if (lookupPath.includes('lead-status')) return FALLBACK_LEAD_STATUSES;
    }
  }

  if (field.value === 'rating') {
    return RATINGS.map((v) => ({ value: v, label: v }));
  }

  return [];
}

/** Build { [accountId]: { value, label, name } } map for list normalization */
export function accountMapFromLookups(accounts = []) {
  return Object.fromEntries(accounts.map(a => [a.value, a]));
}
