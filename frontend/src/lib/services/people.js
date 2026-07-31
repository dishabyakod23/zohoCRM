import api from '../api.js';
import { ownerName } from '../recordHelpers.js';
import { getLeadDetailPath } from '../pipelineHelpers.js';
import { DIRECTORY_STATUS_OPTIONS } from '../contactDirectoryHelpers.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import { cachedLookup } from '../lookupCache.js';
import { fetchAllIdsFromEndpoint } from '../listSelectionHelpers.js';

function parseStatusOptions(data) {
  const rows = Array.isArray(data) ? data : (data?.data || data?.options || []);
  return rows.map((item) => {
    if (typeof item === 'string') return { value: item, label: item };
    const value = item.value ?? item.key ?? item.code ?? item.status ?? item.label;
    const label = item.label ?? item.name ?? item.display_name ?? value;
    return { value, label };
  }).filter((item) => item.value);
}

export function personDetailHref(person) {
  if (!person) return '/contacts';
  if (person.detail_href || person.detail_url) return person.detail_href || person.detail_url;

  const entityType = String(
    person.entity_type || person.record_type || person.source_type || '',
  ).toLowerCase();
  const recordId = person.record_id || person.entity_id || person.id;

  switch (entityType) {
    case 'contact':
      return `/contacts/${recordId}`;
    case 'lead':
    case 'raw_lead':
    case 'qualified_lead':
    case 'proposal':
      return getLeadDetailPath(person, recordId);
    case 'deal':
      return `/deals/${recordId}`;
    case 'account':
      return `/accounts/${recordId}`;
    default:
      if (person.contact_id) return `/contacts/${person.contact_id}`;
      return `/contacts/${recordId}`;
  }
}

/** Normalize GET /people or /contacts/directory row for the Contacts list UI. */
export function normalizePersonRow(person) {
  if (!person) return person;
  const entityType = person.entity_type || person.record_type || person.source_type || 'contact';

  return {
    ...person,
    id: person.id || person.record_id || person.entity_id,
    account_name: person.account_name || person.company || person.company_name || null,
    current_status: person.current_status || person.status || 'Contact',
    owner_name: ownerName(person) || person.owner_name || null,
    campaign_id: person.campaign_id || null,
    campaign_name: person.campaign_name || null,
    _entityType: String(entityType).toLowerCase(),
    _detailHref: personDetailHref(person),
  };
}

function buildPeopleParams({
  page = 1,
  page_size = DEFAULT_PAGE_SIZE,
  search,
  owner_id,
  sort_by,
  sort_order,
  filters = {},
} = {}) {
  const params = { page, page_size };
  const mergedOwnerId = filters.owner_id || owner_id;
  if (search) params.search = search;
  if (mergedOwnerId) params.owner_id = mergedOwnerId;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;
  if (filters.company) params.company = filters.company;
  if (filters.designation) params.designation = filters.designation;
  if (filters.current_status) params.current_status = filters.current_status;
  if (filters.campaign_id) params.campaign_id = filters.campaign_id;
  return params;
}

async function fetchPeoplePage(endpoint, params) {
  const res = await api.get(endpoint, { params });
  const rows = (res.data.data || []).map(normalizePersonRow);
  return {
    data: rows,
    total: res.data.meta?.total ?? res.data.total ?? rows.length,
    meta: res.data.meta || { total: res.data.meta?.total ?? rows.length },
  };
}

async function requestPeopleList(params) {
  try {
    return await fetchPeoplePage('/people', params);
  } catch (err) {
    if (err.response?.status !== 404) throw err;
    return fetchPeoplePage('/contacts/directory', params);
  }
}

export async function listPeople({
  page = 1,
  page_size = DEFAULT_PAGE_SIZE,
  search,
  owner_id,
  sort_by,
  sort_order,
  filters = {},
} = {}) {
  const params = buildPeopleParams({
    page,
    page_size,
    search,
    owner_id,
    sort_by,
    sort_order,
    filters,
  });
  return requestPeopleList(params);
}

export async function listAllMatchingPeopleIds(params = {}) {
  try {
    return fetchAllIdsFromEndpoint('/people', buildPeopleParams({ ...params, page: 1, page_size: DEFAULT_PAGE_SIZE }));
  } catch (err) {
    if (err.response?.status !== 404) throw err;
    return fetchAllIdsFromEndpoint(
      '/contacts/directory',
      buildPeopleParams({ ...params, page: 1, page_size: DEFAULT_PAGE_SIZE }),
    );
  }
}

export async function fetchPeopleStatusOptions() {
  return cachedLookup('people-status-options', async () => {
    try {
      const res = await api.get('/people/status-options');
      const options = parseStatusOptions(res.data.data ?? res.data);
      if (options.length) return options;
    } catch (err) {
      if (err.response?.status !== 404) throw err;
    }

    try {
      const res = await api.get('/contacts/directory/status-options');
      const options = parseStatusOptions(res.data.data ?? res.data);
      if (options.length) return options;
    } catch (err) {
      if (err.response?.status !== 404) throw err;
    }

    return DIRECTORY_STATUS_OPTIONS;
  });
}
