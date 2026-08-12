import { toApiLeadStatus } from './pipelineHelpers.js';
import { normalizeRole } from './roles.js';

/** Default owner filter: reps and managers default to self; super admin and viewer see all owners. */
export function defaultOwnerFilterId(user) {
  if (!user?.id) return '';
  const role = normalizeRole(user.role);
  if (role === 'sales_manager' || role === 'sales_rep') return String(user.id);
  return '';
}

export function withDefaultOwnerFilters(emptyFilters, user) {
  return { ...emptyFilters, owner_id: defaultOwnerFilterId(user) };
}

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

export const TIMESTAMP_FILTER_KEYS = {
  created_from: '',
  created_to: '',
  updated_from: '',
  updated_to: '',
};

export function hasTimestampFilters(filters = {}) {
  return Boolean(
    filters.created_from || filters.created_to
    || filters.updated_from || filters.updated_to,
  );
}

export function matchesRecordTimestampFilters(record, filters = {}) {
  if (!hasTimestampFilters(filters)) return true;
  if (!matchesDateRange(record.created_at, filters.created_from, filters.created_to)) return false;
  if (!matchesDateRange(record.updated_at, filters.updated_from, filters.updated_to)) return false;
  return true;
}

export function matchSource(lead, source) {
  if (!source) return true;
  const value = String(lead.source || lead.lead_source || '');
  return value.toLowerCase() === String(source).toLowerCase()
    || includesText(value, source);
}

export function matchLeadStatus(record, status) {
  if (!status) return true;
  const raw = record?.lead_status ?? record?.status;
  const label = record?.lead_status_label;
  const apiStatus = toApiLeadStatus(status) || status;
  const filter = String(status).trim();
  const filterNorm = filter.toLowerCase().replace(/\s+/g, '_');
  const rawNorm = String(raw || '').toLowerCase();

  if (raw === apiStatus || raw === status) return true;
  if (rawNorm && (rawNorm === filterNorm || rawNorm === String(apiStatus).toLowerCase())) return true;
  if (label && String(label).toLowerCase() === filter.toLowerCase()) return true;
  if (label && filterNorm === String(label).toLowerCase().replace(/\s+/g, '_')) return true;
  return false;
}

export function applyLeadRecordFilters(leads, filters = {}, { campaignMemberIds } = {}) {
  if (!filters || !Object.values(filters).some(Boolean)) return leads || [];

  return (leads || []).filter((lead) => {
    if (!includesText(lead.company, filters.company)) return false;
    if (!matchSource(lead, filters.source)) return false;
    if (!matchLeadStatus(lead, filters.status)) return false;
    if (!matchesOwner(lead, filters.owner_id)) return false;
    if (filters.campaign_id && campaignMemberIds && !campaignMemberIds.has(String(lead.id))) return false;
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
    if (!matchesRecordTimestampFilters(lead, filters)) return false;
    return true;
  });
}

export function applyContactRecordFilters(contacts, filters = {}, { campaignMemberIds } = {}) {
  if (!filters || !Object.values(filters).some(Boolean)) return contacts || [];

  return (contacts || []).filter((contact) => {
    if (!includesText(contact.account_name, filters.company)) return false;
    if (!matchesOwner(contact, filters.owner_id)) return false;
    if (filters.campaign_id && campaignMemberIds && !campaignMemberIds.has(String(contact.id))) return false;
    if (!matchesRecordTimestampFilters(contact, filters)) return false;
    return true;
  });
}

export function applyAccountRecordFilters(accounts, filters = {}, { campaignMemberIds } = {}) {
  if (!filters || !Object.values(filters).some(Boolean)) return accounts || [];

  return (accounts || []).filter((account) => {
    if (!includesText(account.industry, filters.industry)) return false;
    if (!includesText(account.website, filters.website)) return false;
    if (!includesText(account.email, filters.email)) return false;
    if (!includesText(account.city, filters.city)) return false;
    if (filters.status && String(account.account_type || '').toLowerCase() !== String(filters.status).toLowerCase()) return false;
    if (!matchesOwner(account, filters.owner_id)) return false;
    if (filters.campaign_id && campaignMemberIds && !campaignMemberIds.has(String(account.id))) return false;
    if (!matchesRecordTimestampFilters(account, filters)) return false;
    return true;
  });
}

export function hasLeadClientFilters(filters = {}) {
  return Boolean(
    filters.company || filters.source || filters.status || filters.deal_status
    || filters.proposal_date_from || filters.proposal_date_to
    || filters.closure_date_from || filters.closure_date_to
    || (filters.deal_size_min !== '' && filters.deal_size_min != null)
    || (filters.deal_size_max !== '' && filters.deal_size_max != null)
    || hasTimestampFilters(filters),
  );
}

export function hasContactClientFilters(filters = {}) {
  return Boolean(
    filters.company
    || filters.designation
    || filters.current_status
    || filters.lead_status
    || filters.activity_from
    || filters.activity_to
    || hasTimestampFilters(filters),
  );
}

/** Company list API supports industry/city/website server-side. */
export function hasCompanyClientFilters(filters = {}) {
  return Boolean(filters.status || filters.campaign_id || filters.email || hasTimestampFilters(filters));
}

export function hasAccountClientFilters(filters = {}) {
  return Boolean(
    filters.industry || filters.website || filters.email || filters.status || filters.city
    || filters.campaign_id || hasTimestampFilters(filters),
  );
}

export function countActiveFilters(filters = {}, user = null) {
  const defaultOwnerId = defaultOwnerFilterId(user);
  return Object.entries(filters).filter(([key, value]) => {
    if (value === '' || value == null) return false;
    if (key === 'owner_id' && defaultOwnerId && String(value) === String(defaultOwnerId)) return false;
    return true;
  }).length;
}

export const EMPTY_LEAD_FILTERS = {
  company: '',
  source: '',
  status: '',
  owner_id: '',
  campaign_id: '',
  deal_status: '',
  proposal_date_from: '',
  proposal_date_to: '',
  closure_date_from: '',
  closure_date_to: '',
  deal_size_min: '',
  deal_size_max: '',
  ...TIMESTAMP_FILTER_KEYS,
};

export const EMPTY_CONTACT_FILTERS = {
  company: '',
  owner_id: '',
  campaign_id: '',
  designation: '',
  current_status: '',
  lead_status: '',
  activity_from: '',
  activity_to: '',
  ...TIMESTAMP_FILTER_KEYS,
};

export const EMPTY_ACCOUNT_FILTERS = {
  industry: '',
  website: '',
  email: '',
  status: '',
  city: '',
  owner_id: '',
  campaign_id: '',
  ...TIMESTAMP_FILTER_KEYS,
};
