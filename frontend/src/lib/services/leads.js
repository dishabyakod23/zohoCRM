import api from '../api.js';
import { normalizeLead, toLeadPayload, resolveLeadStatusForApi } from '../leadHelpers.js';
import { toConvertPayload } from '../dealHelpers.js';
import { downloadBlob, normalizeImportResult } from '../importHelpers.js';
import {
  PIPELINE_RAW, PIPELINE_PROPOSAL, PIPELINE_QUALIFIED, PIPELINE_LEAD, PROPOSAL_SOURCE,
  filterLeadsByPipelineStage, toApiLeadStatus, RAW_LEAD_CSV_HEADERS,
} from '../pipelineHelpers.js';
import {
  applyLeadRecordFilters,
  hasLeadClientFilters,
} from '../listRecordFilters.js';
import { LEAD_IMPORT_FIELDS } from '../importFieldConfig.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import { sortRecords } from '../listSortHelpers.js';
import { ensureCsvColumn } from '../csvHelpers.js';

const CONVERT_MASS_TARGETS = new Set(['account', 'contact', 'deal']);
const PIPELINE_CONVERT_MASS_FIELD = 'pipeline_convert_target';

function isConvertMassUpdateFieldKey(field) {
  const key = String(field || '').toLowerCase();
  return key === 'convert' || key === 'pipeline_convert' || key === PIPELINE_CONVERT_MASS_FIELD;
}

function resolvePipelineConvertMassValue(value, { proposal = false, clearProposal = false } = {}) {
  if (proposal) return 'proposal';
  const target = String(value ?? '').toLowerCase();
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

async function fetchAllLeadPages(params, statusOptions) {
  const pageSize = DEFAULT_PAGE_SIZE;
  let page = 1;
  let all = [];
  let serverTotal = 0;

  while (page <= 50) {
    const res = await api.get('/leads', { params: { ...params, page, page_size: pageSize } });
    const batch = (res.data.data || []).map((lead) => normalizeLead(lead, statusOptions));
    serverTotal = res.data.meta?.total ?? all.length + batch.length;
    all = all.concat(batch);
    if (batch.length === 0 || all.length >= serverTotal) break;
    page += 1;
  }

  return all;
}

export async function listAllLeads(params = {}, statusOptions) {
  const { pipeline_stage, filters, ...apiParams } = params;
  let data = await fetchAllLeadPages(apiParams, statusOptions);
  if (pipeline_stage) {
    data = filterLeadsByPipelineStage(data, pipeline_stage);
  }
  if (filters && hasLeadClientFilters(filters)) {
    data = applyLeadRecordFilters(data, filters);
  }
  return { data, total: data.length };
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
} = {}) {
  const params = {};
  if (search) params.search = search;

  const mergedOwnerId = filters.owner_id || owner_id;
  const mergedStatus = filters.status || lead_status;

  const apiStatus = pipeline_stage === PIPELINE_PROPOSAL || pipeline_stage === PIPELINE_QUALIFIED
    ? 'qualified_lead'
    : pipeline_stage === PIPELINE_RAW
      ? null
      : toApiLeadStatus(mergedStatus) || (mergedStatus ? resolveLeadStatusForApi(mergedStatus) : null);
  if (apiStatus) params.lead_status = apiStatus;
  if (mergedOwnerId) params.owner_id = mergedOwnerId;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;

  const needsClientPipeline = Boolean(pipeline_stage);
  const needsClientFilter = hasLeadClientFilters(filters);
  const fetchAll = needsClientPipeline || needsClientFilter;

  if (fetchAll) {
    const allLeads = await fetchAllLeadPages(params, statusOptions);
    let filtered = pipeline_stage
      ? filterLeadsByPipelineStage(allLeads, pipeline_stage)
      : allLeads;
    filtered = applyLeadRecordFilters(filtered, filters);
    const start = (page - 1) * page_size;
    return {
      data: filtered.slice(start, start + page_size),
      total: filtered.length,
      meta: { total: filtered.length },
    };
  }

  const res = await api.get('/leads', { params: { ...params, page, page_size } });
  let data = (res.data.data || []).map((lead) => normalizeLead(lead, statusOptions));
  if (mergedStatus && toApiLeadStatus(mergedStatus) === 'qualified_lead' && mergedStatus !== PIPELINE_PROPOSAL) {
    data = filterLeadsByPipelineStage(data, 'qualified_lead');
  }
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
} = {}) {
  if (!userId) return { data: [], total: 0 };

  const params = { owner_id: userId };
  if (search) params.search = search;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;

  const allLeads = await fetchAllLeadPages(params, statusOptions);
  let items = allLeads.filter((l) => !(l?.is_converted || l?.converted));
  if (pipeline_stage) {
    items = filterLeadsByPipelineStage(items, pipeline_stage);
  }
  items = applyLeadRecordFilters(items, { ...filters, owner_id: userId });
  items = sortRecords(items, sort_key || 'created_desc', 'leads');

  const start = (page - 1) * page_size;
  return {
    data: items.slice(start, start + page_size),
    total: items.length,
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
  const result = await massUpdateLeads(ids, apiField, value, extras);
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

export async function importLeadsFile(file, { dry_run = true, defaultLeadStatus = PIPELINE_RAW } = {}) {
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
  const records = payload.readyRecords || [];
  const res = await api.post('/leads/bulk-import', { records });
  return normalizeImportResult({ imported_count: res.data.data?.imported ?? records.length });
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
  return createLead({
    ...form,
    lead_status: form.lead_status || undefined,
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

/** Count leads created since the start of the current calendar month. */
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
