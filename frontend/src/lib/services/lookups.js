import api from '../api.js';
import { leadStatusLabel } from '../leadHelpers.js';
import { dealStageLabel, FALLBACK_DEAL_STAGES } from '../dealHelpers.js';
import { parseLookupOptions } from '../recordHelpers.js';

/** Fallback when lookups API is unavailable */
export const FALLBACK_LEAD_STATUSES = [
  { value: 'none', label: 'None' },
  { value: 'attempted_to_contact', label: 'Attempted to Contact' },
  { value: 'contact_in_future', label: 'Contact in Future' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'junk_lead', label: 'Junk Lead' },
  { value: 'lost_lead', label: 'Lost Lead' },
  { value: 'not_contacted', label: 'Not Contacted' },
  { value: 'pre_qualified', label: 'Pre-Qualified' },
  { value: 'not_qualified', label: 'Not Qualified' },
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
  const res = await api.get('/lookups/lead-statuses');
  return parseLeadStatusLookups(res.data.data);
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

/** Build { [accountId]: { value, label, name } } map for list normalization */
export function accountMapFromLookups(accounts = []) {
  return Object.fromEntries(accounts.map(a => [a.value, a]));
}
