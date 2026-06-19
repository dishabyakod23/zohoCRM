import api from '../api.js';
import { normalizeLead, toLeadPayload, resolveLeadStatusForApi } from '../leadHelpers.js';
import { toConvertPayload } from '../dealHelpers.js';
import { downloadBlob, normalizeImportResult } from '../importHelpers.js';
import { resolveLeadEmail } from '../emailHelpers.js';
import {
  PIPELINE_RAW, PIPELINE_PROPOSAL, PIPELINE_QUALIFIED, PIPELINE_LEAD, PROPOSAL_SOURCE,
  filterLeadsByPipelineStage, toApiLeadStatus,
} from '../pipelineHelpers.js';

const CONVERT_MASS_TARGETS = new Set(['account', 'contact', 'deal']);

async function fetchAllLeadPages(params, statusOptions) {
  const pageSize = 100;
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

export async function listLeads({ page = 1, page_size = 15, search, lead_status, owner_id, sort_by, sort_order, pipeline_stage, statusOptions } = {}) {
  const params = {};
  if (search) params.search = search;
  const apiStatus = pipeline_stage === PIPELINE_PROPOSAL || pipeline_stage === PIPELINE_QUALIFIED
    ? 'qualified_lead'
    : pipeline_stage === PIPELINE_RAW
      ? null
      : toApiLeadStatus(lead_status) || (lead_status ? resolveLeadStatusForApi(lead_status) : null);
  if (apiStatus) params.lead_status = apiStatus;
  if (owner_id) params.owner_id = owner_id;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;

  if (pipeline_stage) {
    const allLeads = await fetchAllLeadPages(params, statusOptions);
    const filtered = filterLeadsByPipelineStage(allLeads, pipeline_stage);
    const start = (page - 1) * page_size;
    return {
      data: filtered.slice(start, start + page_size),
      total: filtered.length,
      meta: { total: filtered.length },
    };
  }

  const res = await api.get('/leads', { params: { ...params, page, page_size } });
  let data = (res.data.data || []).map((lead) => normalizeLead(lead, statusOptions));
  if (lead_status && toApiLeadStatus(lead_status) === 'qualified_lead' && lead_status !== PIPELINE_PROPOSAL) {
    data = filterLeadsByPipelineStage(data, 'qualified_lead');
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

/** Route mass-update Convert to per-lead conversion; other fields use bulk API. */
export async function applyLeadMassUpdate(ids, field, value, extras = {}) {
  const fieldKey = String(field || '').toLowerCase();
  if (fieldKey === 'convert') {
    const target = String(value || '').toLowerCase();
    let success = 0;
    for (const id of ids) {
      if (CONVERT_MASS_TARGETS.has(target)) {
        await convertLead(id, { create_deal: target === 'deal' });
      } else {
        await advanceLeadStage(id, value, {
          proposal: target === 'proposal' || value === PIPELINE_PROPOSAL,
          clearProposal: target === 'lead' || target === PIPELINE_LEAD || value === PIPELINE_LEAD,
        });
      }
      success += 1;
    }
    return { success_count: success, updated: success };
  }

  const apiField = fieldKey === 'status' ? 'lead_status' : field;
  return massUpdateLeads(ids, apiField, value, extras);
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
  const res = await api.get('/leads/import/template', { responseType: 'blob' });
  downloadBlob(res.data, 'leads-import-template.csv');
}

export async function importLeadsFile(file, { dry_run = true } = {}) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/leads/import', formData, {
    params: { dry_run },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return normalizeImportResult(res.data.data);
}

export async function advanceLeadStage(id, lead_status, { proposal = false, clearProposal = false } = {}) {
  const payload = { lead_status: resolveLeadStatusForApi(lead_status) };
  if (proposal || lead_status === PIPELINE_PROPOSAL) {
    payload.lead_source = PROPOSAL_SOURCE;
  } else if (clearProposal) {
    payload.lead_source = null;
  }
  const res = await api.patch(`/leads/${id}`, payload);
  return normalizeLead(res.data.data);
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
  });
}

/** Count leads created since the start of the current calendar month. */
export async function countLeadsThisMonth() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const res = await api.get('/leads', {
    params: { page: 1, page_size: 100, sort_by: 'created_at', sort_order: 'desc' },
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
      const resolvedEmail = resolveLeadEmail({
        email: row.email,
        phone: row.phone,
        company: row.company,
        lastName: row.last_name,
        suffix: String(row._row),
      });
      if (!resolvedEmail) {
        results.failed += 1;
        results.errors.push({ row: row._row, error: 'Email or phone is required' });
        continue;
      }
      await createRawLead({
        first_name: row.first_name || '',
        last_name: row.last_name,
        company: row.company,
        email: resolvedEmail,
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
