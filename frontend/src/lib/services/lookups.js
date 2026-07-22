import api from '../api.js';
import { leadStatusLabel } from '../leadHelpers.js';
import { dealStageLabel, FALLBACK_DEAL_STAGES } from '../dealHelpers.js';
import { parseLookupOptions } from '../recordHelpers.js';
import { INDUSTRIES, RATINGS } from '../constants.js';

/** Fallback when lookups API is unavailable */
export const FALLBACK_LEAD_STATUSES = [
  { value: 'raw_prospect', label: 'Raw Prospect' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified_lead', label: 'Qualified Lead' },
  { value: 'deal_lost', label: 'Deal Lost' },
  { value: 'not_contacted', label: 'Not Contacted' },
  { value: 'attempted_to_contact', label: 'Attempted to Contact' },
  { value: 'pre_qualified', label: 'Pre-Qualified' },
  { value: 'not_qualified', label: 'Not Qualified' },
  { value: 'junk_lead', label: 'Junk Lead' },
  { value: 'lost_lead', label: 'Lost Lead' },
];

/** Normalize GET /lookups/lead-statuses → { value, label }[] */
export function parseLeadStatusLookups(data) {
  if (!Array.isArray(data) || data.length === 0) return FALLBACK_LEAD_STATUSES;

  return data.map((item) => {
    if (typeof item === 'string') {
      return { value: item, label: leadStatusLabel(item) };
    }
    const value = item.value ?? item.key ?? item.code ?? item.id ?? item.status;
    const label = item.label ?? item.name ?? item.display_name ?? item.title ?? leadStatusLabel(value);
    return { value, label };
  }).filter((item) => item.value);
}

export async function fetchLeadStatuses() {
  try {
    const res = await api.get('/lookups/lead-statuses');
    const options = parseLeadStatusLookups(res.data.data);
    return options.length ? options : FALLBACK_LEAD_STATUSES;
  } catch {
    return FALLBACK_LEAD_STATUSES;
  }
}

export async function fetchUsers() {
  const res = await api.get('/lookups/users');
  return (res.data.data || []).map(u => ({
    ...u,
    name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
  }));
}

export async function fetchDealStages() {
  const res = await api.get('/lookups/deal-stages');
  const options = parseLookupOptions(res.data.data, dealStageLabel);
  return options.length ? options : FALLBACK_DEAL_STAGES;
}

export async function fetchAccountLookups() {
  const res = await api.get('/lookups/accounts');
  return parseLookupOptions(res.data.data).map(a => ({ ...a, name: a.label }));
}

export async function fetchContactLookups() {
  const res = await api.get('/lookups/contacts');
  return (res.data.data || []).map((c) => ({
    value: c.value ?? c.id,
    label: (c.label ?? `${c.first_name || ''} ${c.last_name || ''}`.trim()) || c.email || c.value,
    email: c.email,
  })).filter((c) => c.value);
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

function formatLookupLabel(value) {
  if (!value) return '—';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const MASS_UPDATE_FIELD_LOOKUPS = {
  lead_status: '/lookups/lead-statuses',
  status: '/lookups/lead-statuses',
  source: '/lookups/lead-sources',
  lead_source: '/lookups/lead-sources',
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

/** Remove owner field from mass-update list when user cannot reassign leads. */
export function filterLeadMassUpdateFields(fields, { canChangeOwner = false } = {}) {
  if (canChangeOwner) return fields || [];
  return (fields || []).filter((f) => !isLeadOwnerMassUpdateField(f));
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
  const res = await api.get('/lookups/lead-sources');
  return parseLookupOptions(res.data.data);
}

export async function fetchLeadMassUpdateFields({ canChangeOwner = false } = {}) {
  const res = await api.get('/lookups/lead-mass-update-fields');
  const fields = (res.data.data || []).map(normalizeMassUpdateField);
  return filterLeadMassUpdateFields(fields, { canChangeOwner });
}

/** Hide Deal from mass-update convert target dropdowns. */
export function filterPipelineConvertTargets(options = []) {
  return (options || []).filter((option) => {
    const value = String(option?.value ?? '').toLowerCase().trim();
    const label = String(option?.label ?? '').toLowerCase().trim();
    return value !== 'deal' && label !== 'deal';
  });
}

export async function fetchPipelineConvertTargets() {
  const res = await api.get('/lookups/pipeline-convert-targets');
  return filterPipelineConvertTargets(parseLookupOptions(res.data.data));
}

export async function fetchLostReasons() {
  try {
    const res = await api.get('/lookups/lost-reasons');
    return parseLookupOptions(res.data.data);
  } catch {
    return [];
  }
}

export const fetchCampaignMemberStatuses = () => fetchLookup('/lookups/campaign-member-statuses', formatLookupLabel);

/** Load dropdown options for a mass-update field from its lookup API (or embedded options). */
export async function fetchMassUpdateFieldOptions(fieldDef) {
  const field = normalizeMassUpdateField(fieldDef);

  if (isConvertMassUpdateField(field)) {
    return fetchPipelineConvertTargets();
  }

  if (Array.isArray(field.options) && field.options.length) {
    return parseLookupOptions(field.options, field.value === 'lead_status' || field.value === 'status' ? leadStatusLabel : undefined);
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

  if (field.value === 'industry') {
    return INDUSTRIES.map((v) => ({ value: v, label: v }));
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
