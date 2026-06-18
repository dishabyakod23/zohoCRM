import { toApiLeadStatus } from './pipelineHelpers.js';

export function includesText(haystack, needle) {
  if (!needle) return true;
  return String(haystack || '').toLowerCase().includes(String(needle).toLowerCase().trim());
}

export function matchesOwner(record, ownerId) {
  if (!ownerId) return true;
  return String(record.owner_id || '') === String(ownerId);
}

export function matchesDateRange(value, from, to) {
  if (!from && !to) return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (from) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    if (date < start) return false;
  }
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (date > end) return false;
  }
  return true;
}

export function matchSource(lead, source) {
  if (!source) return true;
  const value = String(lead.source || lead.lead_source || '');
  return value.toLowerCase() === String(source).toLowerCase()
    || includesText(value, source);
}

export function matchLeadStatus(lead, status) {
  if (!status) return true;
  const raw = lead.lead_status ?? lead.status;
  const apiStatus = toApiLeadStatus(status) || status;
  return raw === apiStatus || raw === status;
}

export function applyLeadRecordFilters(leads, filters = {}) {
  if (!filters || !Object.values(filters).some(Boolean)) return leads || [];

  return (leads || []).filter((lead) => {
    if (!includesText(lead.company, filters.company)) return false;
    if (!matchSource(lead, filters.source)) return false;
    if (!matchLeadStatus(lead, filters.status)) return false;
    if (!matchesOwner(lead, filters.owner_id)) return false;
    if (filters.deal_status && lead.deal_status !== filters.deal_status) return false;
    if (!matchesDateRange(lead.proposal_date, filters.proposal_date_from, filters.proposal_date_to)) return false;
    if (!matchesDateRange(lead.closure_date, filters.closure_date_from, filters.closure_date_to)) return false;
    if (filters.deal_size_min !== '' && filters.deal_size_min != null) {
      const size = Number(lead.deal_size ?? lead.proposal_amount);
      if (Number.isNaN(size) || size < Number(filters.deal_size_min)) return false;
    }
    if (filters.deal_size_max !== '' && filters.deal_size_max != null) {
      const size = Number(lead.deal_size ?? lead.proposal_amount);
      if (Number.isNaN(size) || size > Number(filters.deal_size_max)) return false;
    }
    return true;
  });
}

export function applyContactRecordFilters(contacts, filters = {}) {
  if (!filters || !Object.values(filters).some(Boolean)) return contacts || [];

  return (contacts || []).filter((contact) => {
    if (!includesText(contact.account_name, filters.company)) return false;
    if (!matchesOwner(contact, filters.owner_id)) return false;
    return true;
  });
}

export function applyAccountRecordFilters(accounts, filters = {}) {
  if (!filters || !Object.values(filters).some(Boolean)) return accounts || [];

  return (accounts || []).filter((account) => {
    if (!includesText(account.industry, filters.industry)) return false;
    if (!includesText(account.website, filters.website)) return false;
    if (!includesText(account.email, filters.email)) return false;
    if (!includesText(account.city, filters.city)) return false;
    if (filters.status && String(account.account_type || '').toLowerCase() !== String(filters.status).toLowerCase()) return false;
    if (!matchesOwner(account, filters.owner_id)) return false;
    return true;
  });
}

export function hasLeadClientFilters(filters = {}) {
  return Boolean(
    filters.company || filters.source || filters.status || filters.deal_status
    || filters.proposal_date_from || filters.proposal_date_to
    || filters.closure_date_from || filters.closure_date_to
    || (filters.deal_size_min !== '' && filters.deal_size_min != null)
    || (filters.deal_size_max !== '' && filters.deal_size_max != null),
  );
}

export function hasContactClientFilters(filters = {}) {
  return Boolean(filters.company);
}

export function hasAccountClientFilters(filters = {}) {
  return Boolean(filters.industry || filters.website || filters.email || filters.status || filters.city);
}

export function countActiveFilters(filters = {}) {
  return Object.values(filters).filter((value) => value !== '' && value != null).length;
}

export const EMPTY_LEAD_FILTERS = {
  company: '',
  source: '',
  status: '',
  owner_id: '',
  deal_status: '',
  proposal_date_from: '',
  proposal_date_to: '',
  closure_date_from: '',
  closure_date_to: '',
  deal_size_min: '',
  deal_size_max: '',
};

export const EMPTY_CONTACT_FILTERS = {
  company: '',
  owner_id: '',
};

export const EMPTY_ACCOUNT_FILTERS = {
  industry: '',
  website: '',
  email: '',
  status: '',
  city: '',
  owner_id: '',
};
