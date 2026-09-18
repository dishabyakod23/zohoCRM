import * as contactsApi from './contacts.js';
import * as leadsApi from './leads.js';
import * as dealsApi from './deals.js';
import * as peopleApi from './people.js';
import {
  buildDirectoryRows,
  applyContactDirectoryFilters,
} from '../contactDirectoryHelpers.js';
import { DEFAULT_PAGE_SIZE, CLIENT_FILTER_MAX_RECORDS } from '../constants.js';
import { sortRecords } from '../listSortHelpers.js';
import { usesCampaignMembershipFilter } from '../listRecordFilters.js';

const MEMBER_FETCH_CONCURRENCY = 10;
/** Above this, fall back to directory API + membership filter instead of per-id gets. */
const MEMBER_FETCH_ID_CAP = 150;

function shouldFallbackFromDirectoryApi(error) {
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
  stripCampaignId = false,
} = {}) {
  const mergedOwnerId = filters.owner_id || owner_id;
  return {
    search,
    owner_id: mergedOwnerId,
    sort_by,
    sort_order,
    filters: {
      owner_id: mergedOwnerId,
      campaign_id: stripCampaignId ? '' : (filters.campaign_id || ''),
      company: filters.company || '',
      designation: filters.designation || '',
      current_status: filters.current_status || '',
      lead_status: filters.lead_status || '',
    },
  };
}

async function mapPool(items, concurrency, fn) {
  if (!items?.length) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let next = 0;
  const results = new Array(items.length);
  async function worker() {
    while (next < items.length) {
      const idx = next;
      next += 1;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function fetchContactsByIds(ids = [], accountMap = {}) {
  const unique = [...new Set((ids || []).map(String).filter(Boolean))];
  const rows = await mapPool(unique, MEMBER_FETCH_CONCURRENCY, async (id) => {
    try {
      return await contactsApi.getContact(id, accountMap);
    } catch {
      return null;
    }
  });
  return rows.filter(Boolean);
}

async function fetchLeadsByIds(ids = [], statusOptions) {
  const unique = [...new Set((ids || []).map(String).filter(Boolean))];
  const rows = await mapPool(unique, MEMBER_FETCH_CONCURRENCY, async (id) => {
    try {
      return await leadsApi.getLead(id);
    } catch {
      return null;
    }
  });
  return rows.filter(Boolean);
}

/**
 * Campaign filter: fetch only campaign members (not the entire contacts/leads DB).
 */
async function listContactDirectoryForCampaign({
  page = 1,
  page_size = DEFAULT_PAGE_SIZE,
  search,
  owner_id,
  sort_by,
  sort_order,
  sort_key,
  filters = {},
  campaignMemberIds,
  memberGroups,
  statusOptions,
} = {}, accountMap = {}) {
  const contactIds = memberGroups?.contactIds || [];
  const leadIds = memberGroups?.leadIds || [];
  const totalMembers = (contactIds.length + leadIds.length)
    || (campaignMemberIds instanceof Set ? campaignMemberIds.size : 0);

  // Large campaigns: use paginated directory with campaign_id, then membership filter.
  if (totalMembers > MEMBER_FETCH_ID_CAP || !memberGroups) {
    try {
      const result = await peopleApi.listPeople({
        page,
        page_size,
        search,
        owner_id: filters.owner_id || owner_id,
        sort_by,
        sort_order,
        filters,
      });
      const rows = applyContactDirectoryFilters(result.data || [], filters, { campaignMemberIds });
      return {
        data: rows,
        total: totalMembers || result.total || rows.length,
        meta: { total: totalMembers || result.total || rows.length },
      };
    } catch (err) {
      if (!shouldFallbackFromDirectoryApi(err)) throw err;
    }
  }

  const [contacts, leads] = await Promise.all([
    fetchContactsByIds(contactIds, accountMap),
    fetchLeadsByIds(leadIds, statusOptions),
  ]);

  let rows = buildDirectoryRows({
    contacts,
    leads,
    deals: [],
    statusOptions,
  });

  // Already scoped to campaign members — apply other filters only.
  const filtersWithoutCampaign = { ...filters, campaign_id: '' };
  rows = applyContactDirectoryFilters(rows, filtersWithoutCampaign, {});
  if (search) {
    const q = String(search).trim().toLowerCase();
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      rows = rows.filter((row) => {
        const hay = [
          row.first_name, row.last_name, row.email, row.phone, row.mobile,
          row.account_name, row.title, row.company,
        ].filter(Boolean).join(' ').toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }
  }
  rows = sortRecords(rows, sort_key || 'created_desc', 'contacts');

  const total = rows.length;
  const start = (page - 1) * page_size;
  return {
    data: rows.slice(start, start + page_size),
    total,
    meta: { total },
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
  const useMembership = usesCampaignMembershipFilter(filters, campaignMemberIds);
  const sourceParams = buildSourceParams({
    search,
    owner_id,
    sort_by,
    sort_order,
    filters,
    stripCampaignId: useMembership,
  });

  const [contactsRes, leadsRes, dealsRes] = await Promise.all([
    contactsApi.listAllContacts({ ...sourceParams, campaignMemberIds }, accountMap),
    leadsApi.listAllLeads({ ...sourceParams, campaignMemberIds }, statusOptions),
    dealsApi.listAllDeals(sourceParams, accountMap),
  ]);

  let rows = buildDirectoryRows({
    contacts: contactsRes.data,
    leads: leadsRes.data,
    deals: dealsRes.data,
    statusOptions,
  });

  rows = applyContactDirectoryFilters(rows, filters, { campaignMemberIds });
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
 * Unified CRM people pool — uses GET /contacts/directory (or /people).
 * Campaign membership uses targeted member fetches (not a full DB scrape).
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
  memberGroups,
  statusOptions,
} = {}, accountMap = {}) {
  if (filters?.campaign_id && campaignMemberIds) {
    return listContactDirectoryForCampaign({
      page,
      page_size,
      search,
      owner_id,
      sort_by,
      sort_order,
      sort_key,
      filters,
      campaignMemberIds,
      memberGroups,
      statusOptions,
    }, accountMap);
  }

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
    if (!shouldFallbackFromDirectoryApi(err)) throw err;
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
  if (params.filters?.campaign_id && params.campaignMemberIds) {
    const result = await listContactDirectoryForCampaign({
      ...params,
      page: 1,
      page_size: CLIENT_FILTER_MAX_RECORDS,
      statusOptions,
    }, accountMap);
    return (result.data || []).map((row) => row.id).filter(Boolean);
  }

  try {
    return await peopleApi.listAllMatchingPeopleIds(params);
  } catch (err) {
    if (!shouldFallbackFromDirectoryApi(err)) throw err;
  }

  const result = await listContactDirectoryClientSide({
    ...params,
    page: 1,
    page_size: CLIENT_FILTER_MAX_RECORDS,
    statusOptions,
  }, accountMap);
  return (result.data || []).map((row) => row.id).filter(Boolean);
}
