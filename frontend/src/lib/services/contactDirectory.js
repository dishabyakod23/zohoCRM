import * as contactsApi from './contacts.js';
import * as leadsApi from './leads.js';
import * as dealsApi from './deals.js';
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
      company: '',
      designation: '',
      current_status: '',
    },
  };
}

/**
 * Unified CRM contact pool: contacts, pipeline leads, and deal-linked contacts.
 * Deduplicates by email/phone/name and keeps the highest pipeline status per person.
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

export async function listAllMatchingContactDirectoryIds(params = {}, accountMap = {}, statusOptions = []) {
  const result = await listContactDirectory({
    ...params,
    page: 1,
    page_size: 100000,
    statusOptions,
  }, accountMap);
  return (result.data || []).map((row) => row.id).filter(Boolean);
}
