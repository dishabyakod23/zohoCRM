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
 * Unified CRM people pool — prefers GET /people (or /contacts/directory), falls back to client merge.
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
  try {
    return await peopleApi.listPeople({
      page,
      page_size,
      search,
      owner_id,
      sort_by,
      sort_order,
      filters,
    });
  } catch (err) {
    if (err.response?.status !== 404) throw err;
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
    return await peopleApi.listAllMatchingPeopleIds(params);
  } catch (err) {
    if (err.response?.status !== 404) throw err;
  }

  const result = await listContactDirectoryClientSide({
    ...params,
    page: 1,
    page_size: 100000,
    statusOptions,
  }, accountMap);
  return (result.data || []).map((row) => row.id).filter(Boolean);
}
