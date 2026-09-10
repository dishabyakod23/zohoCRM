import api from '../api.js';
import { normalizeContact, toContactPayload, normalizeBulkUploadContactRecords, enrichContactReadyRecordsFromCsv, resolveContactLinkedInUrl } from '../contactHelpers.js';
import { downloadBlob, normalizeImportResult, postBulkImportInChunks, BULK_IMPORT_TIMEOUT_MS, assertReadyRecordsComplete, resolveReadyCount, formatBulkUploadSkipMessages } from '../importHelpers.js';
import {
  applyContactRecordFilters,
  hasContactClientFilters,
  usesCampaignMembershipFilter,
} from '../listRecordFilters.js';
import {
  fetchCampaignLookups,
  resolveImportCampaignId,
  attachCampaignIdsToImportRecords,
} from '../campaignRecordHelpers.js';
import { CONTACT_IMPORT_FIELDS } from '../importFieldConfig.js';
import { DEFAULT_PAGE_SIZE, BULK_FETCH_PAGE_SIZE } from '../constants.js';
import { listAllMatchingIdsFromListFn } from '../listSelectionHelpers.js';
import { advanceLeadStage, convertLead, massUpdateLeads, applyLeadMassUpdate } from './leads.js';
import * as accountsApi from './accounts.js';
import { migrateRecordNotes } from './notes.js';
import { CONFIRMED_ACCOUNT_TYPE } from '../companyHelpers.js';
import {
  PIPELINE_RAW,
  PIPELINE_LEAD,
  PIPELINE_PROPOSAL,
  getConvertRedirectPath,
} from '../pipelineHelpers.js';
import { resolveLeadStatusForApi } from '../leadHelpers.js';
import { isConvertMassUpdateField } from './lookups.js';
import { splitDirectorySelectionIds } from './people.js';

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
  const {
    filters = {},
    campaignMemberIds,
    search,
    owner_id,
    sort_by,
    sort_order,
    account_id,
    company_id,
  } = params;
  const mergedOwnerId = filters.owner_id || owner_id;
  const useMembership = usesCampaignMembershipFilter(filters, campaignMemberIds);
  const apiParams = {
    search,
    owner_id: mergedOwnerId,
    sort_by,
    sort_order,
    account_id,
    company_id,
  };
  if (!useMembership && filters.campaign_id) {
    apiParams.campaign_id = filters.campaign_id;
  }

  let data = await fetchAllContactPages(apiParams, accountMap);
  if (useMembership || hasContactClientFilters(filters)) {
    data = applyContactRecordFilters(data, filters, { campaignMemberIds });
  }
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
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;

  const useMembership = usesCampaignMembershipFilter(filters, campaignMemberIds);
  if (!useMembership && filters.campaign_id) params.campaign_id = filters.campaign_id;

  if (hasContactClientFilters(filters) || useMembership) {
    const allContacts = await fetchAllContactPages(
      {
        search,
        owner_id: mergedOwnerId,
        sort_by,
        sort_order,
        account_id,
        company_id,
        ...(useMembership ? {} : { campaign_id: filters.campaign_id || undefined }),
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

export async function massUpdateContacts(ids, field, value) {
  if (!ids?.length) return { success_count: 0, failed_count: 0, errors: [] };
  const res = await api.post('/contacts/mass-update', { ids, field, value });
  return res.data?.data ?? res.data;
}

function mergeMassUpdateResults(results = []) {
  return {
    success_count: results.reduce(
      (n, r) => n + (Number(r?.success_count) || Number(r?.updated) || 0),
      0,
    ),
    failed_count: results.reduce((n, r) => n + (Number(r?.failed_count) || 0), 0),
    errors: results.flatMap((r) => r?.errors || []),
  };
}

/**
 * Contacts directory mass-update: Lead Status splits mixed selection into
 * POST /contacts/mass-update + POST /leads/mass-update (1–2 requests).
 */
export async function applyContactDirectoryMassUpdate(ids, field, value, extras = {}) {
  const fieldKey = String(field || '').toLowerCase();
  const { contactIds, leadIds } = splitDirectorySelectionIds(ids, extras.records);

  if (fieldKey === 'status' || fieldKey === 'lead_status') {
    const apiValue = resolveLeadStatusForApi(value, extras.statusOptions || []);
    const apiField = 'lead_status';
    const tasks = [];
    if (contactIds.length) tasks.push(massUpdateContacts(contactIds, apiField, apiValue));
    if (leadIds.length) {
      tasks.push(massUpdateLeads(leadIds, apiField, apiValue, {
        lost_reason: extras.lost_reason,
      }));
    }
    if (!tasks.length) {
      return {
        success_count: 0,
        failed_count: (ids || []).length || 0,
        errors: ['No valid contact or lead ids selected'],
      };
    }
    const results = await Promise.all(tasks);
    const merged = mergeMassUpdateResults(results);
    if (merged.failed_count > 0) {
      const err = new Error((merged.errors || []).join('; ') || 'Mass update failed');
      err.massUpdateResult = merged;
      throw err;
    }
    return merged;
  }

  if (isConvertMassUpdateField({
    value: field,
    type: fieldKey === 'convert' ? 'convert' : undefined,
  })) {
    let success = 0;
    const errors = [];

    const contactResults = await Promise.allSettled(
      contactIds.map((id) => convertContact(id, value)),
    );
    for (let i = 0; i < contactResults.length; i += 1) {
      const result = contactResults[i];
      if (result.status === 'fulfilled') success += 1;
      else {
        const err = result.reason;
        errors.push(`${contactIds[i]}: ${err?.response?.data?.message || err?.message || 'Convert failed'}`);
      }
    }

    if (leadIds.length) {
      try {
        const leadResult = await applyLeadMassUpdate(leadIds, field, value, extras);
        success += leadResult?.success_count ?? leadResult?.updated ?? leadIds.length;
      } catch (err) {
        const partial = err?.massUpdateResult;
        if (partial) {
          success += partial.success_count || 0;
          errors.push(...(partial.errors || []));
        } else {
          errors.push(err?.message || 'Lead convert failed');
        }
      }
    }

    const merged = { success_count: success, failed_count: errors.length, errors };
    if (errors.length) {
      const err = new Error(errors.join('; ') || 'Mass update failed');
      err.massUpdateResult = merged;
      throw err;
    }
    return merged;
  }

  throw new Error(`Unsupported contacts mass-update field: ${field}`);
}

export async function downloadContactImportTemplate() {
  const headers = CONTACT_IMPORT_FIELDS.map((f) => f.key);
  const csv = `${headers.join(',')}\n`;
  downloadBlob(new Blob([csv], { type: 'text/csv' }), 'contacts-import-template.csv');
}

export async function importContactsFile(file, { dry_run = true, campaignId, onProgress } = {}) {
  const csv = await file.text();
  const upload = await api.post('/contacts/bulk-upload', { csv }, { timeout: BULK_IMPORT_TIMEOUT_MS });
  const payload = upload.data.data || {};
  const readyRecords = payload.readyRecords || [];
  const readyCount = resolveReadyCount(payload);
  const uploadErrors = (payload.errorRecords || []).map((e) => ({
    row: e.row,
    message: e.error || e.message,
    code: e.code,
    field: e.field,
  }));

  if (dry_run) {
    return normalizeImportResult({
      ready_count: readyCount,
      error_count: payload.errors ?? uploadErrors.length,
      errorRecords: uploadErrors,
      skip_messages: formatBulkUploadSkipMessages(payload.errorRecords),
      readyRecords,
    });
  }

  if (!readyRecords.length) {
    return normalizeImportResult({
      imported_count: 0,
      skipped_count: uploadErrors.length || Number(payload.errors || 0) || 0,
      error_count: uploadErrors.length || Number(payload.errors || 0) || 0,
      errorRecords: uploadErrors,
      skip_messages: formatBulkUploadSkipMessages(payload.errorRecords),
      readyRecords: [],
    });
  }

  assertReadyRecordsComplete(payload);

  let campaignLookups = [];
  try {
    campaignLookups = await fetchCampaignLookups();
  } catch {
    campaignLookups = [];
  }

  const defaultCampaignId = await resolveImportCampaignId(campaignId);
  const processedRecords = normalizeBulkUploadContactRecords(
    enrichContactReadyRecordsFromCsv(readyRecords, csv),
  );

  const records = attachCampaignIdsToImportRecords(processedRecords, {
    defaultCampaignId,
    campaignLookups,
  });

  const result = await postBulkImportInChunks(api, '/contacts/bulk-import', {
    records,
    campaign_id: defaultCampaignId || undefined,
    onProgress,
  });

  // bulk-upload/bulk-import whitelist drops LinkedIn (skype_id); restore via PATCH.
  await persistImportedContactLinkedInUrls(result, processedRecords);

  return normalizeImportResult({
    imported_count: result.imported ?? result.imported_count ?? 0,
    skipped_count: result.skipped ?? result.skipped_count,
    error_count: result.errors ?? result.error_count,
    errorRecords: result.errorRecords,
    created_ids: result.created_ids,
    records: result.records,
    skip_messages: result.skip_messages,
    partial: result.partial,
  });
}

/** After bulk-import, PATCH skype_id for rows that had a LinkedIn URL in the CSV. */
export async function persistImportedContactLinkedInUrls(importResult = {}, processedRecords = []) {
  const created = Array.isArray(importResult?.records) ? importResult.records : [];
  if (!created.length || !processedRecords?.length) return { patched: 0 };

  const byEmail = new Map();
  for (const record of processedRecords) {
    const email = String(record?.email || '').trim().toLowerCase();
    const linkedIn = resolveContactLinkedInUrl(record);
    if (email && linkedIn) byEmail.set(email, linkedIn);
  }
  if (!byEmail.size) return { patched: 0 };

  let patched = 0;
  await Promise.allSettled(created.map(async (row) => {
    const id = row?.id;
    const email = String(row?.email || '').trim().toLowerCase();
    const skype_id = email ? byEmail.get(email) : null;
    if (!id || !skype_id) return;
    try {
      await api.patch(`/contacts/${id}`, { skype_id });
      patched += 1;
    } catch {
      // Non-fatal — contact was created; LinkedIn can be edited manually.
    }
  }));
  return { patched };
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
  // Notes stay keyed to the contact after convert — copy them onto the new lead.
  if (leadId) {
    await migrateRecordNotes('contact', contactId, 'lead', leadId).catch(() => ({ migrated: 0 }));
  }
  // Best-effort: mark the contact converted so it drops out of the Contacts directory.
  try {
    await updateContact(contactId, { is_converted: true });
  } catch {
    // Backend may not accept is_converted on PATCH — directory filters still apply when set.
  }
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
