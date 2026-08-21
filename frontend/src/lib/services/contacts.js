import api from '../api.js';
import { normalizeContact, toContactPayload, normalizeBulkUploadContactRecords } from '../contactHelpers.js';
import { downloadBlob, normalizeImportResult, postBulkImportInChunks, BULK_IMPORT_TIMEOUT_MS } from '../importHelpers.js';
import {
  applyContactRecordFilters,
  hasContactClientFilters,
} from '../listRecordFilters.js';
import {
  fetchCampaignLookups,
  resolveImportCampaignId,
  attachCampaignIdsToImportRecords,
} from '../campaignRecordHelpers.js';
import { CONTACT_IMPORT_FIELDS } from '../importFieldConfig.js';
import { DEFAULT_PAGE_SIZE, BULK_FETCH_PAGE_SIZE } from '../constants.js';
import { listAllMatchingIdsFromListFn } from '../listSelectionHelpers.js';
import { advanceLeadStage, convertLead } from './leads.js';
import * as accountsApi from './accounts.js';
import { CONFIRMED_ACCOUNT_TYPE } from '../companyHelpers.js';
import {
  PIPELINE_RAW,
  PIPELINE_LEAD,
  PIPELINE_PROPOSAL,
  getConvertRedirectPath,
} from '../pipelineHelpers.js';

async function fetchAllContactPages(params, accountMap) {
  const pageSize = BULK_FETCH_PAGE_SIZE;
  let page = 1;
  let all = [];
  let serverTotal = 0;

  while (page <= 50) {
    const res = await api.get('/contacts', { params: { ...params, page, page_size: pageSize } });
    const batch = (res.data.data || []).map((c) => normalizeContact(c, accountMap));
    serverTotal = res.data.meta?.total ?? all.length + batch.length;
    all = all.concat(batch);
    if (batch.length === 0 || all.length >= serverTotal) break;
    page += 1;
  }

  return all;
}

export async function listAllMatchingContactIds(params = {}, accountMap = {}) {
  return listAllMatchingIdsFromListFn(
    (listParams) => listContacts(listParams, accountMap),
    params,
  );
}

export async function listAllContacts(params = {}, accountMap = {}) {
  const data = await fetchAllContactPages(params, accountMap);
  return { data, total: data.length };
}

export async function listContacts({
  page = 1,
  page_size = DEFAULT_PAGE_SIZE,
  search,
  account_id,
  company_id,
  owner_id,
  sort_by,
  sort_order,
  filters = {},
  campaignMemberIds,
} = {}, accountMap = {}) {
  const params = { page, page_size };
  if (search) params.search = search;
  if (account_id) params.account_id = account_id;
  if (company_id) params.company_id = company_id;
  const mergedOwnerId = filters.owner_id || owner_id;
  if (mergedOwnerId) params.owner_id = mergedOwnerId;
  if (filters.campaign_id) params.campaign_id = filters.campaign_id;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;

  if (hasContactClientFilters(filters)) {
    const allContacts = await fetchAllContactPages(
      {
        search,
        owner_id: mergedOwnerId,
        campaign_id: filters.campaign_id || undefined,
        sort_by,
        sort_order,
      },
      accountMap,
    );
    const filtered = applyContactRecordFilters(allContacts, filters, { campaignMemberIds });
    const start = (page - 1) * page_size;
    return {
      data: filtered.slice(start, start + page_size),
      total: filtered.length,
      meta: { total: filtered.length },
    };
  }

  const res = await api.get('/contacts', { params });
  return {
    data: (res.data.data || []).map(c => normalizeContact(c, accountMap)),
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

export async function getContact(id, accountMap = {}) {
  const res = await api.get(`/contacts/${id}`);
  return normalizeContact(res.data.data, accountMap);
}

export async function createContact(form) {
  const res = await api.post('/contacts', toContactPayload(form));
  return normalizeContact(res.data.data);
}

export async function updateContact(id, form) {
  const res = await api.patch(`/contacts/${id}`, toContactPayload(form, { partial: true }));
  return normalizeContact(res.data.data);
}

export async function deleteContact(id) {
  await api.delete(`/contacts/${id}`);
}

export async function downloadContactImportTemplate() {
  const headers = CONTACT_IMPORT_FIELDS.map((f) => f.key);
  const csv = `${headers.join(',')}\n`;
  downloadBlob(new Blob([csv], { type: 'text/csv' }), 'contacts-import-template.csv');
}

export async function importContactsFile(file, { dry_run = true, campaignId } = {}) {
  const csv = await file.text();
  const upload = await api.post('/contacts/bulk-upload', { csv }, { timeout: BULK_IMPORT_TIMEOUT_MS });
  const payload = upload.data.data || {};
  const readyRecords = payload.readyRecords || [];
  if (dry_run) {
    return normalizeImportResult({
      ready_count: payload.ready,
      error_count: payload.errors,
      errorRecords: (payload.errorRecords || []).map((e) => ({ row: e.row, message: e.error })),
      readyRecords,
    });
  }

  let campaignLookups = [];
  try {
    campaignLookups = await fetchCampaignLookups();
  } catch {
    campaignLookups = [];
  }

  const defaultCampaignId = await resolveImportCampaignId(campaignId);
  const processedRecords = normalizeBulkUploadContactRecords(readyRecords);

  const records = attachCampaignIdsToImportRecords(processedRecords, {
    defaultCampaignId,
    campaignLookups,
  });

  const result = await postBulkImportInChunks(api, '/contacts/bulk-import', {
    records,
    campaign_id: defaultCampaignId || undefined,
  });

  return normalizeImportResult({
    imported_count: result.imported ?? result.imported_count ?? records.length,
    skipped_count: result.skipped ?? result.skipped_count,
    error_count: result.errors ?? result.error_count,
    errorRecords: result.errorRecords,
    created_ids: result.created_ids,
    records: result.records,
    skip_messages: result.skip_messages,
  });
}

/** Only contact conversion endpoint exposed by the API. */
export async function convertToRawLead(contactId) {
  const res = await api.post(`/contacts/${contactId}/convert-to-raw-lead`);
  return res.data?.data || null;
}

function resolveLeadIdFromContactConvert(result) {
  return result?.lead_id || result?.lead?.id || null;
}

export function getContactConvertRedirect(result, target) {
  if (target === 'account') {
    return result?.account_id ? `/accounts/${result.account_id}` : '/accounts';
  }
  const leadId = resolveLeadIdFromContactConvert(result);
  if (!leadId) return '/contacts';
  return getConvertRedirectPath(target, leadId);
}

/** Convert contact via convert-to-raw-lead, then advance lead stage or convert to account. */
export async function convertContact(contactId, target = PIPELINE_RAW) {
  const converted = await convertToRawLead(contactId);
  const leadId = resolveLeadIdFromContactConvert(converted);
  if (!leadId || target === PIPELINE_RAW || target === 'raw_prospect') {
    return { ...converted, lead_id: leadId };
  }
  if (target === 'account') {
    const accountResult = await convertLead(leadId, { create_deal: false });
    if (accountResult.account?.id) {
      await accountsApi.updateAccount(accountResult.account.id, { account_type: CONFIRMED_ACCOUNT_TYPE });
    }
    return { ...converted, ...accountResult, lead_id: leadId };
  }
  const lead = await advanceLeadStage(leadId, target, {
    proposal: target === PIPELINE_PROPOSAL || target === 'proposal',
    clearProposal: target === PIPELINE_LEAD || target === 'contacted',
  });
  return { ...converted, lead_id: leadId, lead };
}
