import * as contactsApi from './contacts.js';
import * as leadsApi from './leads.js';
import * as dealsApi from './deals.js';
import * as peopleApi from './people.js';
import {
  buildDirectoryRows,
  applyContactDirectoryFilters,
} from '../contactDirectoryHelpers.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import { sortRecords } from '../listSortHelpers.js';

function peopleResultHasRows(result) {
  return (result?.total ?? 0) > 0 || (result?.data?.length ?? 0) > 0;
}

function shouldFallbackFromPeopleApi(error) {
  const status = error?.response?.status;
  if (!status) return true;
  if (status === 404) return true;
  if (status === 400 || status === 422) return true;
  if (status >= 500) return true;
  return false;
}

function buildSourceParams({
  search,
  owner_id,
  sort_by,
  sort_order,
  filters = {},
} = {}) {
  const mergedOwnerId = filters.owner_id || owner_id;
  return {
    search,
    owner_id: mergedOwnerId,
    sort_by,
    sort_order,
    filters: {
      owner_id: mergedOwnerId,
      campaign_id: filters.campaign_id || '',
      company: filters.company || '',
      designation: filters.designation || '',
      current_status: filters.current_status || '',
    },
  };
}

async function listContactDirectoryClientSide({
  page = 1,
  page_size = DEFAULT_PAGE_SIZE,
  search,
  owner_id,
  sort_by,
  sort_order,
  sort_key,
  filters = {},
  campaignMemberIds,
  statusOptions,
} = {}, accountMap = {}) {
  const sourceParams = buildSourceParams({
    search,
    owner_id,
    sort_by,
    sort_order,
    filters,
  });

  const [contactsRes, leadsRes, dealsRes] = await Promise.all([
    contactsApi.listAllContacts(sourceParams, accountMap),
    leadsApi.listAllLeads({ ...sourceParams, campaignMemberIds }, statusOptions),
    dealsApi.listAllDeals(sourceParams, accountMap),
  ]);

  let rows = buildDirectoryRows({
    contacts: contactsRes.data,
    leads: leadsRes.data,
    deals: dealsRes.data,
    statusOptions,
  });

  rows = applyContactDirectoryFilters(rows, filters);
  rows = sortRecords(rows, sort_key || 'created_desc', 'contacts');

  const total = rows.length;
  const start = (page - 1) * page_size;
  return {
    data: rows.slice(start, start + page_size),
    total,
    meta: { total },
  };
}

/**
 * Unified CRM people pool — prefers GET /people (or /contacts/directory).
 * Falls back to client merge when the unified API is empty or unavailable.
 */
export async function listContactDirectory({
  page = 1,
  page_size = DEFAULT_PAGE_SIZE,
  search,
  owner_id,
  sort_by,
  sort_order,
  sort_key,
  filters = {},
  campaignMemberIds,
  statusOptions,
} = {}, accountMap = {}) {
  const peopleParams = {
    page,
    page_size,
    search,
    owner_id,
    sort_by,
    sort_order,
    filters,
  };

  try {
    const apiResult = await peopleApi.listPeople(peopleParams);
    if (peopleResultHasRows(apiResult)) return apiResult;
  } catch (err) {
    if (!shouldFallbackFromPeopleApi(err)) throw err;
  }

  return listContactDirectoryClientSide({
    page,
    page_size,
    search,
    owner_id,
    sort_by,
    sort_order,
    sort_key,
    filters,
    campaignMemberIds,
    statusOptions,
  }, accountMap);
}

export async function listAllMatchingContactDirectoryIds(params = {}, accountMap = {}, statusOptions = []) {
  try {
    const ids = await peopleApi.listAllMatchingPeopleIds(params);
    if (ids.length > 0) return ids;
  } catch (err) {
    if (!shouldFallbackFromPeopleApi(err)) throw err;
  }

  const result = await listContactDirectoryClientSide({
    ...params,
    page: 1,
    page_size: 100000,
    statusOptions,
  }, accountMap);
  return (result.data || []).map((row) => row.id).filter(Boolean);
}
