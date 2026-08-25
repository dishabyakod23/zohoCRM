import api from '../api.js';
import { ownerName } from '../recordHelpers.js';
import { getLeadDetailPath } from '../pipelineHelpers.js';
import { DIRECTORY_STATUS_OPTIONS, resolveDirectoryCurrentStatus, directoryLeadStatusValue, isConvertedToAccount } from '../contactDirectoryHelpers.js';
import { leadStatusLabel } from '../leadHelpers.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import { cachedLookup } from '../lookupCache.js';
import * as contactsApi from './contacts.js';
import * as leadsApi from './leads.js';
import * as dealsApi from './deals.js';
import * as accountsApi from './accounts.js';

function parseStatusOptions(data) {
  const rows = Array.isArray(data) ? data : (data?.data || data?.options || []);
  return rows.map((item) => {
    if (typeof item === 'string') return { value: item, label: item };
    const value = item.value ?? item.key ?? item.code ?? item.status ?? item.label;
    const label = item.label ?? item.name ?? item.display_name ?? value;
    return { value, label };
  }).filter((item) => item.value);
}

export function personEntityType(person) {
  const raw = String(
    person?.entity_type || person?._entityType || person?.record_type || person?.source_type || '',
  ).toLowerCase();

  if (!raw || raw === 'contact') return 'contact';

  // Company/prospect linkage is not the Accounts module — keep as a contact row.
  if ((raw === 'account' || raw === 'company') && !isConvertedToAccount(person)) {
    const status = String(person?.current_status || person?.status || '').toLowerCase();
    if (!status || status === 'contact' || person?.account_id || person?.company_id) {
      return 'contact';
    }
  }

  return raw;
}

export function personRecordId(person) {
  return person?.record_id || person?.entity_id || person?.id || null;
}

/** Stable list-row id that encodes entity type for bulk actions (delete, campaign). */
export function personRowId(person) {
  const entityType = personEntityType(person);
  const recordId = personRecordId(person);
  if (!recordId) return '';
  if (person?.record_id || person?.entity_type || person?.record_type || person?.source_type) {
    return `${entityType}:${recordId}`;
  }
  return String(person.id || recordId);
}

export function parsePersonRowId(rowId) {
  const raw = String(rowId || '');
  const splitAt = raw.indexOf(':');
  if (splitAt > 0) {
    return {
      entityType: raw.slice(0, splitAt).toLowerCase(),
      recordId: raw.slice(splitAt + 1),
    };
  }
  return { entityType: 'contact', recordId: raw };
}

export async function deletePersonRecord(person) {
  const entityType = personEntityType(person);
  const recordId = personRecordId(person);
  if (!recordId) throw new Error('Missing record id');

  switch (entityType) {
    case 'lead':
    case 'raw_lead':
    case 'qualified_lead':
    case 'proposal':
      return leadsApi.deleteLead(recordId);
    case 'deal':
      return dealsApi.deleteDeal(recordId);
    case 'account':
      return accountsApi.deleteAccount(recordId);
    case 'contact':
    default:
      return contactsApi.deleteContact(recordId);
  }
}

export async function deletePersonByRowId(rowId) {
  const { entityType, recordId } = parsePersonRowId(rowId);
  return deletePersonRecord({ entity_type: entityType, record_id: recordId, id: recordId });
}

export async function bulkDeletePersonRecords(records = []) {
  const results = await Promise.allSettled(
    (records || []).map((record) => deletePersonRecord(record)),
  );
  const success_count = results.filter((result) => result.status === 'fulfilled').length;
  const failed_count = results.length - success_count;
  if (!success_count) {
    const firstError = results.find((result) => result.status === 'rejected');
    throw firstError?.reason || new Error('Delete failed');
  }
  return { success_count, failed_count };
}

export async function bulkDeletePersonRowIds(ids = []) {
  const results = await Promise.allSettled(
    (ids || []).map((rowId) => deletePersonByRowId(rowId)),
  );
  const success_count = results.filter((result) => result.status === 'fulfilled').length;
  const failed_count = results.length - success_count;
  if (!success_count) {
    const firstError = results.find((result) => result.status === 'rejected');
    throw firstError?.reason || new Error('Delete failed');
  }
  return { success_count, failed_count };
}

export function personCampaignMemberType(person) {
  const entityType = personEntityType(person);
  if (entityType === 'lead' || entityType === 'raw_lead' || entityType === 'qualified_lead' || entityType === 'proposal') {
    return 'lead';
  }
  if (entityType === 'account') return 'account';
  return 'contact';
}

export function personDetailHref(person) {
  if (!person) return '/contacts';

  const detailPath = person.detail_path || person.detail_href || person.detail_url;
  if (detailPath) {
    const path = String(detailPath).trim();
    return path.startsWith('/') ? path : `/${path}`;
  }

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
  let entityType = personEntityType(person);

  // Converted contacts live on as leads/accounts — do not list them as Contact rows.
  if (
    (entityType === 'contact' || entityType === '')
    && (person.is_converted || person.converted)
  ) {
    return null;
  }

  const recordId = personRecordId(person);
  const rowId = personRowId(person);
  const current_status = resolveDirectoryCurrentStatus({ ...person, entity_type: entityType });

  if (entityType === 'account' && current_status === 'Contact') {
    entityType = 'contact';
  }

  const lead_status = directoryLeadStatusValue(person);

  return {
    ...person,
    id: rowId,
    record_id: recordId,
    entity_type: entityType,
    account_name: person.account_name || person.company || person.company_name || null,
    current_status,
    lead_status,
    lead_status_label: lead_status ? (leadStatusLabel(lead_status) || lead_status) : '—',
    owner_name: ownerName(person) || person.owner_name || null,
    campaign_id: person.campaign_id || null,
    campaign_name: person.campaign_name || null,
    _entityType: entityType,
    _detailHref: personDetailHref({ ...person, record_id: recordId, entity_type: entityType, current_status }),
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
  if (filters.lead_status) params.lead_status = filters.lead_status;
  if (filters.campaign_id) params.campaign_id = filters.campaign_id;
  return params;
}

const DIRECTORY_ENDPOINTS = ['/contacts/directory', '/people'];
const DIRECTORY_STATUS_ENDPOINTS = ['/contacts/directory/status-options', '/people/status-options'];

async function fetchDirectoryPage(endpoint, params) {
  const res = await api.get(endpoint, { params });
  const raw = res.data?.data ?? res.data?.items ?? res.data?.results ?? [];
  const list = Array.isArray(raw) ? raw : [];
  const rows = list.map(normalizePersonRow).filter(Boolean);
  return {
    data: rows,
    total: res.data?.meta?.total ?? res.data?.total ?? rows.length,
    meta: res.data?.meta || { total: res.data?.meta?.total ?? rows.length },
  };
}

async function requestDirectoryList(params) {
  let lastError;
  for (const endpoint of DIRECTORY_ENDPOINTS) {
    try {
      return await fetchDirectoryPage(endpoint, params);
    } catch (err) {
      lastError = err;
      if (err.response?.status !== 404) throw err;
    }
  }
  throw lastError || new Error('Contact directory API is unavailable');
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
  return requestDirectoryList(params);
}

export async function listAllMatchingPeopleIds(params = {}) {
  const baseParams = buildPeopleParams({ ...params, page_size: 250 });
  let page = 1;
  const ids = [];
  let total = 0;

  while (page <= 50) {
    const result = await requestDirectoryList({ ...baseParams, page });

    ids.push(...result.data.map((row) => row.id).filter(Boolean));
    total = result.total;
    if (!result.data.length || ids.length >= total) break;
    page += 1;
  }

  return ids;
}

export async function fetchPeopleStatusOptions() {
  return cachedLookup('people-status-options', async () => {
    for (const endpoint of DIRECTORY_STATUS_ENDPOINTS) {
      try {
        const res = await api.get(endpoint);
        const options = parseStatusOptions(res.data.data ?? res.data);
        if (options.length) return options;
      } catch (err) {
        if (err.response?.status !== 404) throw err;
      }
    }

    return DIRECTORY_STATUS_OPTIONS;
  });
}
