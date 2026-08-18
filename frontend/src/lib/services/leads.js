import api from '../api.js';
import { normalizeLead, toLeadPayload, resolveLeadStatusForApi } from '../leadHelpers.js';
import { toConvertPayload } from '../dealHelpers.js';
import { downloadBlob, normalizeImportResult } from '../importHelpers.js';
import {
  PIPELINE_RAW, PIPELINE_PROPOSAL, PIPELINE_QUALIFIED, PIPELINE_LEAD, PROPOSAL_SOURCE,
  filterLeadsByPipelineStage, toApiLeadStatus, RAW_LEAD_CSV_HEADERS, pipelineStageLabel,
  isPipelineStageStatus,
} from '../pipelineHelpers.js';
import {
  applyLeadRecordFilters,
  hasLeadClientFilters,
} from '../listRecordFilters.js';
import {
  fetchCampaignLookups,
  resolveImportCampaignId,
  attachCampaignIdsToImportRecords,
} from '../campaignRecordHelpers.js';
import { finalizeLeadBulkImport } from '../importSyncHelpers.js';
import { LEAD_IMPORT_FIELDS } from '../importFieldConfig.js';
import { DEFAULT_PAGE_SIZE, BULK_FETCH_PAGE_SIZE, CLIENT_FILTER_MAX_RECORDS } from '../constants.js';
import { sortRecords } from '../listSortHelpers.js';
import { ensureCsvColumn } from '../csvHelpers.js';
import { listAllMatchingIdsFromListFn } from '../listSelectionHelpers.js';
import { sumAmountsInInr } from '../fxRates.js';

const CONVERT_MASS_TARGETS = new Set(['account', 'deal']);
const PIPELINE_CONVERT_MASS_FIELD = 'pipeline_convert_target';

function isConvertMassUpdateFieldKey(field) {
  const key = String(field || '').toLowerCase();
  return key === 'convert' || key === 'pipeline_convert' || key === PIPELINE_CONVERT_MASS_FIELD;
}

function resolvePipelineConvertMassValue(value, { proposal = false, clearProposal = false } = {}) {
  if (proposal) return 'proposal';
  const target = String(value ?? '').toLowerCase();
  if (target === 'contact') return 'contact';
  if (clearProposal || target === 'lead') return PIPELINE_LEAD;
  const mapped = resolveLeadStatusForApi(value);
  if (mapped) return mapped;
  if (target === 'proposal') return 'proposal';
  return value;
}

async function convertPipelineTargets(ids, value, extras = {}) {
  const apiValue = resolvePipelineConvertMassValue(value, extras);
  const result = await massUpdateLeads(ids, PIPELINE_CONVERT_MASS_FIELD, apiValue, extras);
  if (result?.failed_count > 0) {
    const err = new Error((result.errors || []).join('; ') || 'Convert failed');
    err.massUpdateResult = result;
    throw err;
  }
  return result;
}

async function fetchAllLeadPages(params, statusOptions, pageSize = BULK_FETCH_PAGE_SIZE, maxRecords = CLIENT_FILTER_MAX_RECORDS) {
  let page = 1;
  let all = [];
  let serverTotal = 0;

  while (page <= 50 && all.length < maxRecords) {
    const res = await api.get('/leads', { params: { ...params, page, page_size: pageSize } });
    const batch = (res.data.data || []).map((lead) => normalizeLead(lead, statusOptions));
    serverTotal = res.data.meta?.total ?? all.length + batch.length;
    all = all.concat(batch);
    if (batch.length === 0 || all.length >= serverTotal) break;
    page += 1;
  }

  return all;
}

/** Map UI pipeline stage / filters to API query params supported by GET /leads. */
function buildLeadListApiParams({
  pipeline_stage,
  filters = {},
  search,
  owner_id,
  lead_status,
  sort_by,
  sort_order,
} = {}) {
  const params = {};
  if (search) params.search = search;

  const mergedOwnerId = filters.owner_id || owner_id;
  const mergedStatus = filters.status || lead_status;

  if (mergedOwnerId) params.owner_id = mergedOwnerId;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;
  if (filters.campaign_id) params.campaign_id = filters.campaign_id;
  if (filters.company) params.company = filters.company;
  if (filters.source) params.lead_source = filters.source;

  if (pipeline_stage) {
    params.is_converted = false;
    if (pipeline_stage === PIPELINE_PROPOSAL) {
      params.pipeline_stage = PIPELINE_PROPOSAL;
      params.lead_status = 'qualified_lead';
    } else if (pipeline_stage === PIPELINE_QUALIFIED) {
      params.pipeline_stage = PIPELINE_QUALIFIED;
      params.lead_status = 'qualified_lead';
    } else if (pipeline_stage === PIPELINE_RAW) {
      params.pipeline_stage = PIPELINE_RAW;
      // Do not pin lead_status to raw_prospect — outreach statuses (e.g. not_contacted)
      // are updated independently and records must stay in Raw Leads.
      const statusFilter = filters.status || lead_status;
      if (statusFilter) {
        const apiStatus = toApiLeadStatus(statusFilter) || resolveLeadStatusForApi(statusFilter);
        if (apiStatus) params.lead_status = apiStatus;
      }
    } else {
      params.pipeline_stage = pipeline_stage;
      const apiStatus = toApiLeadStatus(pipeline_stage) || resolveLeadStatusForApi(pipeline_stage);
      if (apiStatus) params.lead_status = apiStatus;
    }
  } else {
    const apiStatus = toApiLeadStatus(mergedStatus) || (mergedStatus ? resolveLeadStatusForApi(mergedStatus) : null);
    if (apiStatus) params.lead_status = apiStatus;
  }

  return params;
}

function refineLeadPageByPipelineStage(data, pipeline_stage) {
  if (!pipeline_stage || !data?.length) return data || [];
  return filterLeadsByPipelineStage(data, pipeline_stage);
}

export async function listAllLeads(params = {}, statusOptions) {
  const { pipeline_stage, filters, campaignMemberIds, ...rest } = params;
  const apiParams = buildLeadListApiParams({ pipeline_stage, filters, ...rest });
  let data = await fetchAllLeadPages(apiParams, statusOptions);
  if (pipeline_stage) {
    data = refineLeadPageByPipelineStage(data, pipeline_stage);
  }
  if (filters && hasLeadClientFilters(filters)) {
    data = applyLeadRecordFilters(data, filters, { campaignMemberIds });
  }
  return { data, total: data.length };
}

export async function listAllMatchingLeadIds(params = {}, statusOptions) {
  return listAllMatchingIdsFromListFn(
    (listParams) => listLeads({ ...listParams, statusOptions }),
    params,
  );
}

export async function listAllMatchingWorkItemIds(params = {}, statusOptions) {
  return listAllMatchingIdsFromListFn(
    (listParams) => listWorkItems({ ...listParams, statusOptions }),
    params,
  );
}

export async function listLeads({
  page = 1,
  page_size = DEFAULT_PAGE_SIZE,
  search,
  lead_status,
  owner_id,
  sort_by,
  sort_order,
  pipeline_stage,
  statusOptions,
  filters = {},
  campaignMemberIds,
} = {}) {
  const params = buildLeadListApiParams({
    pipeline_stage,
    filters,
    search,
    owner_id,
    lead_status,
    sort_by,
    sort_order,
  });

  const needsClientFilter = hasLeadClientFilters(filters);

  if (needsClientFilter) {
    const allLeads = await fetchAllLeadPages(params, statusOptions);
    let filtered = refineLeadPageByPipelineStage(allLeads, pipeline_stage);
    filtered = applyLeadRecordFilters(filtered, filters, { campaignMemberIds });
    const start = (page - 1) * page_size;
    return {
      data: filtered.slice(start, start + page_size),
      total: filtered.length,
      meta: { total: filtered.length },
    };
  }

  const res = await api.get('/leads', { params: { ...params, page, page_size } });
  let data = (res.data.data || []).map((lead) => normalizeLead(lead, statusOptions));
  data = refineLeadPageByPipelineStage(data, pipeline_stage);
  return {
    data,
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

export async function listWorkItems({
  userId,
  page = 1,
  page_size = DEFAULT_PAGE_SIZE,
  search,
  pipeline_stage,
  sort_by = 'updated_at',
  sort_order = 'desc',
  sort_key,
  filters = {},
  statusOptions,
  campaignMemberIds,
} = {}) {
  if (!userId) return { data: [], total: 0 };

  const params = buildLeadListApiParams({
    pipeline_stage,
    filters,
    search,
    owner_id: userId,
    sort_by,
    sort_order,
  });
  params.is_converted = false;

  const needsClientFilter = hasLeadClientFilters(filters);

  if (needsClientFilter) {
    const allLeads = await fetchAllLeadPages(params, statusOptions);
    let items = refineLeadPageByPipelineStage(allLeads, pipeline_stage);
    items = applyLeadRecordFilters(items, filters, { campaignMemberIds });
    items = sortRecords(items, sort_key || 'created_desc', 'leads');
    const start = (page - 1) * page_size;
    return {
      data: items.slice(start, start + page_size),
      total: items.length,
    };
  }

  const res = await api.get('/leads', { params: { ...params, page, page_size } });
  let data = (res.data.data || []).map((lead) => normalizeLead(lead, statusOptions));
  data = refineLeadPageByPipelineStage(data, pipeline_stage);
  if (sort_key) {
    data = sortRecords(data, sort_key, 'leads');
  }
  return {
    data,
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

export async function getLead(id) {
  const res = await api.get(`/leads/${id}`);
  return normalizeLead(res.data.data);
}

export async function createLead(form) {
  const res = await api.post('/leads', toLeadPayload(form));
  return normalizeLead(res.data.data);
}

export async function updateLead(id, form) {
  const res = await api.patch(`/leads/${id}`, toLeadPayload(form, { partial: true }));
  return normalizeLead(res.data.data);
}

export async function deleteLead(id) {
  await api.delete(`/leads/${id}`);
}

export async function bulkDeleteLeads(ids) {
  const res = await api.post('/leads/bulk-delete', { ids });
  return res.data.data;
}

export async function massUpdateLeads(ids, field, value, { lost_reason } = {}) {
  const payload = { ids, field, value };
  if (lost_reason) payload.lost_reason = lost_reason;
  const res = await api.post('/leads/mass-update', payload);
  return res.data.data;
}

/** Route mass-update Convert to pipeline_convert_target API; account/deal uses per-lead convert. */
export async function applyLeadMassUpdate(ids, field, value, extras = {}) {
  if (isConvertMassUpdateFieldKey(field)) {
    const target = String(value || '').toLowerCase();
    if (target === 'contact') {
      return convertLeadsToContact(ids);
    }
    if (CONVERT_MASS_TARGETS.has(target)) {
      let success = 0;
      const errors = [];
      for (const id of ids) {
        try {
          await convertLead(id, { create_deal: target === 'deal' });
          success += 1;
        } catch (err) {
          errors.push(`${id}: ${err.response?.data?.message || err.response?.data?.error || err.message || 'Update failed'}`);
        }
      }
      if (errors.length) {
        const err = new Error(errors.join('; '));
        err.massUpdateResult = { success_count: success, failed_count: errors.length, errors };
        throw err;
      }
      return { success_count: success, updated: success, failed_count: 0, errors: [] };
    }
    return convertPipelineTargets(ids, value, {
      proposal: target === 'proposal' || value === PIPELINE_PROPOSAL,
      clearProposal: target === 'lead' || target === PIPELINE_LEAD || value === PIPELINE_LEAD,
      ...extras,
    });
  }

  const fieldKey = String(field || '').toLowerCase();
  const apiField = fieldKey === 'status' ? 'lead_status' : field;
  let apiValue = value;
  if (fieldKey === 'status' || fieldKey === 'lead_status') {
    apiValue = resolveLeadStatusForApi(value, extras.statusOptions || []);
  }
  const result = await massUpdateLeads(ids, apiField, apiValue, extras);
  if (result?.failed_count > 0) {
    const err = new Error((result.errors || []).join('; ') || 'Mass update failed');
    err.massUpdateResult = result;
    throw err;
  }
  return result;
}

export async function convertLead(id, form) {
  const res = await api.post(`/leads/${id}/convert`, toConvertPayload(form));
  return res.data.data;
}

/** Move a cold lead back into the Contacts module (reverse of convert-to-raw-lead). */
export async function convertLeadToContact(id) {
  const res = await api.post(`/leads/${id}/convert-to-contact`);
  return res.data?.data || null;
}

async function convertLeadsToContact(ids = []) {
  let success = 0;
  const errors = [];
  for (const id of ids) {
    try {
      await convertLeadToContact(id);
      success += 1;
    } catch (err) {
      errors.push(`${id}: ${err.response?.data?.message || err.response?.data?.error || err.message || 'Convert failed'}`);
    }
  }
  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.massUpdateResult = { success_count: success, failed_count: errors.length, errors };
    throw err;
  }
  return { success_count: success, updated: success, failed_count: 0, errors: [] };
}

export async function listLeadAttachments(id) {
  const res = await api.get(`/leads/${id}/attachments`);
  return res.data.data || [];
}

export async function uploadLeadAttachment(id, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/leads/${id}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function deleteLeadAttachment(leadId, attachmentId) {
  await api.delete(`/leads/${leadId}/attachments/${attachmentId}`);
}

export async function downloadLeadImportTemplate() {
  const headers = [...RAW_LEAD_CSV_HEADERS, 'lead_status'];
  const csv = `${headers.join(',')}\nraw,lead,raw@example.com,,,,,Manual Entry,,raw_prospect\n`;
  downloadBlob(new Blob([csv], { type: 'text/csv' }), 'raw-leads-import-template.csv');
}

export async function importLeadsFile(file, { dry_run = true, defaultLeadStatus = PIPELINE_RAW, campaignId } = {}) {
  const rawCsv = await file.text();
  const csv = ensureCsvColumn(rawCsv, 'lead_status', defaultLeadStatus);
  if (dry_run) {
    const res = await api.post('/leads/bulk-upload', { csv });
    const payload = res.data.data || {};
    return normalizeImportResult({
      ready_count: payload.ready,
      error_count: payload.errors,
      errorRecords: (payload.errorRecords || []).map((e) => ({ row: e.row, message: e.error })),
      readyRecords: payload.readyRecords,
    });
  }
  const upload = await api.post('/leads/bulk-upload', { csv });
  const payload = upload.data.data || {};
  const readyRecords = payload.readyRecords || [];

  let campaignLookups = [];
  try {
    campaignLookups = await fetchCampaignLookups();
  } catch {
    campaignLookups = [];
  }
  const defaultCampaignId = await resolveImportCampaignId(campaignId);
  const records = attachCampaignIdsToImportRecords(readyRecords, {
    defaultCampaignId,
    campaignLookups,
  });

  const importBody = { records };
  if (defaultCampaignId) {
    importBody.campaign_id = defaultCampaignId;
  }

  const res = await api.post('/leads/bulk-import', importBody);
  const result = res.data.data || res.data || {};

  await finalizeLeadBulkImport({
    campaignId: defaultCampaignId,
    importResult: result,
    readyRecords,
    campaignLookups,
    syncContacts: defaultLeadStatus === PIPELINE_RAW,
  });

  return normalizeImportResult({
    imported_count: result.imported ?? result.imported_count ?? records.length,
    error_count: result.errors ?? result.error_count,
    errorRecords: result.errorRecords || result.errors,
    created_ids: (result.records || []).map((row) => row?.id).filter(Boolean),
  });
}

export async function advanceLeadStage(id, lead_status, { proposal = false, clearProposal = false } = {}) {
  await convertPipelineTargets([id], lead_status, { proposal, clearProposal });
  return getLead(id);
}

export async function assignLead(id, owner_id) {
  const res = await api.patch(`/leads/${id}`, { owner_id });
  return normalizeLead(res.data.data);
}

export async function createRawLead(form) {
  const outreachStatus = form.lead_status && !isPipelineStageStatus(form.lead_status)
    ? form.lead_status
    : null;
  return createLead({
    ...form,
    lead_status: outreachStatus,
    pipeline_stage: form.pipeline_stage || PIPELINE_RAW,
    source: form.source || form.lead_source || 'Manual Entry',
  });
}

export async function createQualifiedLead(form) {
  return createLead({
    ...form,
    lead_status: form.lead_status || PIPELINE_QUALIFIED,
    source: form.source || form.lead_source || 'Manual Entry',
  });
}

export async function createProposal(form) {
  return createLead({
    ...form,
    lead_status: PIPELINE_QUALIFIED,
    source: PROPOSAL_SOURCE,
    deal_status: form.deal_status || 'active_proposal',
  });
}

export async function countLeadsThisMonth() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const res = await api.get('/leads', {
    params: { page: 1, page_size: DEFAULT_PAGE_SIZE, sort_by: 'created_at', sort_order: 'desc' },
  });
  return (res.data.data || []).filter((lead) => {
    if (!lead.created_at) return false;
    return new Date(lead.created_at) >= monthStart;
  }).length;
}

export async function countQualifiedLeads(statusOptions = []) {
  const { data } = await listAllLeads({ pipeline_stage: PIPELINE_QUALIFIED }, statusOptions);
  return data.length;
}

/** Pipeline counts for dashboard KPIs and chart (single fetch, matches list pages). */
export async function summarizePipelineDashboard(statusOptions = []) {
  const { data } = await listAllLeads({}, statusOptions);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const stages = [PIPELINE_RAW, PIPELINE_LEAD, PIPELINE_QUALIFIED, PIPELINE_PROPOSAL];
  const leadsByPipeline = stages
    .map((stage) => ({
      status: pipelineStageLabel(stage),
      count: filterLeadsByPipelineStage(data, stage).length,
    }))
    .filter((row) => row.count > 0);

  const proposalLeads = filterLeadsByPipelineStage(data, PIPELINE_PROPOSAL);
  const qualifiedCount = filterLeadsByPipelineStage(data, PIPELINE_QUALIFIED).length;
  const dealSize = await sumAmountsInInr(proposalLeads, {
    amountOf: (lead) => Number(lead.deal_size ?? lead.proposal_amount),
    currencyOf: (lead) => lead.currency || 'INR',
  });
  const leadsThisMonth = data.filter((lead) => {
    if (!lead.created_at) return false;
    return new Date(lead.created_at) >= monthStart;
  }).length;

  return {
    leadsByPipeline,
    totalLeads: leadsByPipeline.reduce((sum, row) => sum + row.count, 0),
    qualifiedCount,
    leadsThisMonth,
    proposals: { total: proposalLeads.length, dealSize },
  };
}

export async function summarizeProposals(statusOptions = []) {
  const { data } = await listAllLeads({ pipeline_stage: PIPELINE_PROPOSAL }, statusOptions);
  const dealSize = await sumAmountsInInr(data, {
    amountOf: (lead) => Number(lead.deal_size ?? lead.proposal_amount),
    currencyOf: (lead) => lead.currency || 'INR',
  });
  return { total: data.length, dealSize };
}

/** @deprecated use summarizeProposals */
export async function countProposals(statusOptions = []) {
  const summary = await summarizeProposals(statusOptions);
  return summary.total;
}

/** Parse CSV text into row objects keyed by header names */
export function parseLeadCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line, index) => {
    const values = line.split(',').map((v) => v.trim());
    const row = { _row: index + 2 };
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

export async function importRawLeads(rows) {
  const results = { success: 0, failed: 0, errors: [] };
  for (const row of rows) {
    if (!row.first_name?.trim() || !row.last_name?.trim() || !row.company?.trim()) {
      results.failed += 1;
      results.errors.push({ row: row._row, error: 'First name, last name, and company are required' });
      continue;
    }
    try {
      await createRawLead({
        first_name: row.first_name || '',
        last_name: row.last_name,
        company: row.company,
        email: row.email || `raw-${Date.now()}-${row._row}@import.local`,
        phone: row.phone || null,
        mobile: row.mobile || null,
        title: row.title || null,
        source: row.lead_source || 'Bulk Upload',
        industry: row.industry || null,
        description: row.description || null,
      });
      results.success += 1;
    } catch (err) {
      results.failed += 1;
      results.errors.push({ row: row._row, error: err.response?.data?.message || err.message || 'Import failed' });
    }
  }
  return results;
}
