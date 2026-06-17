import api from '../api.js';
import { normalizeLead, toLeadPayload, resolveLeadStatusForApi } from '../leadHelpers.js';
import { toConvertPayload } from '../dealHelpers.js';
import {
  PIPELINE_RAW, PIPELINE_PROPOSAL, PIPELINE_QUALIFIED, PROPOSAL_SOURCE,
  filterLeadsByPipelineStage, toApiLeadStatus,
} from '../pipelineHelpers.js';

export async function listLeads({ page = 1, page_size = 15, search, lead_status, owner_id, sort_by, sort_order, pipeline_stage } = {}) {
  const params = { page, page_size };
  if (search) params.search = search;
  const apiStatus = pipeline_stage === PIPELINE_PROPOSAL || pipeline_stage === PIPELINE_QUALIFIED
    ? 'qualified_lead'
    : toApiLeadStatus(lead_status) || (lead_status ? resolveLeadStatusForApi(lead_status) : null);
  if (apiStatus) params.lead_status = apiStatus;
  if (owner_id) params.owner_id = owner_id;
  if (sort_by) params.sort_by = sort_by;
  if (sort_order) params.sort_order = sort_order;

  const res = await api.get('/leads', { params });
  let data = (res.data.data || []).map((lead) => normalizeLead(lead));
  if (pipeline_stage) {
    data = filterLeadsByPipelineStage(data, pipeline_stage);
  } else if (lead_status && toApiLeadStatus(lead_status) === 'qualified_lead' && lead_status !== PIPELINE_PROPOSAL) {
    data = filterLeadsByPipelineStage(data, 'qualified_lead');
  }
  return {
    data,
    total: pipeline_stage ? data.length : (res.data.meta?.total ?? 0),
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

export async function convertLead(id, form) {
  const res = await api.post(`/leads/${id}/convert`, toConvertPayload(form));
  return res.data.data;
}

export async function listLeadNotes(id) {
  const res = await api.get(`/leads/${id}/notes`);
  return res.data.data || [];
}

export async function createLeadNote(id, body) {
  const res = await api.post(`/leads/${id}/notes`, { body });
  return res.data.data;
}

export async function deleteLeadNote(leadId, noteId) {
  await api.delete(`/leads/${leadId}/notes/${noteId}`);
}

export async function listLeadAttachments(id) {
  const res = await api.get(`/leads/${id}/attachments`);
  return res.data.data || [];
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
    lead_status: form.lead_status || PIPELINE_RAW,
    source: form.source || form.lead_source || 'Manual Entry',
  });
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
    if (!row.last_name?.trim() || !row.company?.trim()) {
      results.failed += 1;
      results.errors.push({ row: row._row, error: 'Last name and company are required' });
      continue;
    }
    try {
      await createRawLead({
        first_name: row.first_name || '',
        last_name: row.last_name,
        company: row.company,
        email: row.email || `raw-${Date.now()}-${row._row}@import.local`,
        phone: row.phone || '0000000000',
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
