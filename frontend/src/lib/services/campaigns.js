import api from '../api.js';
import { assigneeName, formatEnumLabel, listResult, omitEmpty, toDateOnly } from '../activityHelpers.js';
import { downloadBlob, normalizeImportResult } from '../importHelpers.js';

export function normalizeCampaign(campaign) {
  const type = campaign.type ?? campaign.campaign_type;
  const status = campaign.status;
  return {
    ...campaign,
    name: campaign.name ?? campaign.campaign_name,
    type,
    type_label: formatEnumLabel(type),
    status_label: formatEnumLabel(status),
    owner_name: assigneeName(campaign),
  };
}

function numOrNull(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toCampaignPayload(form, { partial = false } = {}) {
  const payload = {
    name: form.name ?? form.campaign_name,
    type: form.type ?? form.campaign_type,
    status: form.status,
    start_date: form.start_date ? toDateOnly(form.start_date) : undefined,
    end_date: form.end_date ? toDateOnly(form.end_date) : undefined,
    expected_revenue: numOrNull(form.expected_revenue),
    budgeted_cost: numOrNull(form.budgeted_cost),
    actual_cost: numOrNull(form.actual_cost),
    expected_response: numOrNull(form.expected_response),
    numbers_sent: numOrNull(form.numbers_sent),
    description: form.description || null,
    owner_id: form.owner_id || null,
  };
  return partial ? omitEmpty(payload) : payload;
}

export async function listCampaigns(params = {}) {
  const { page_size, limit, page, ...rest } = params;
  const res = await api.get('/campaigns', { params: { ...rest, page, limit: limit ?? page_size ?? 20 } });
  const result = listResult(res);
  return { ...result, data: result.data.map(normalizeCampaign) };
}

export async function getCampaign(id) {
  const res = await api.get(`/campaigns/${id}`);
  return normalizeCampaign(res.data.data);
}

export async function createCampaign(form) {
  const res = await api.post('/campaigns', toCampaignPayload(form));
  return normalizeCampaign(res.data.data);
}

export async function updateCampaign(id, form) {
  const res = await api.patch(`/campaigns/${id}`, toCampaignPayload(form, { partial: true }));
  return normalizeCampaign(res.data.data);
}

export async function deleteCampaign(id) {
  await api.delete(`/campaigns/${id}`);
}

export async function listCampaignMembers(campaignId) {
  const campaign = await getCampaign(campaignId);
  const members = campaign.members || [];
  return { data: members, total: members.length };
}

export async function addCampaignMember(campaignId, payload) {
  const res = await api.post(`/campaigns/${campaignId}/members`, payload);
  return res.data.data ?? res.data;
}

export async function updateCampaignMember(campaignId, memberId, payload) {
  const res = await api.patch(`/campaigns/${campaignId}/members/${memberId}`, payload);
  return res.data.data;
}

export async function deleteCampaignMember(campaignId, memberId) {
  await api.delete(`/campaigns/${campaignId}/members/${memberId}`);
}

export async function downloadCampaignMemberImportTemplate() {
  const csv = 'email,type\n';
  downloadBlob(new Blob([csv], { type: 'text/csv' }), 'campaign-members-template.csv');
}

export async function importCampaignMembers(campaignId, file, { dry_run = true } = {}) {
  const csv = await file.text();
  if (dry_run) {
    const res = await api.post(`/campaigns/${campaignId}/bulk-upload`, { csv });
    const payload = res.data.data ?? res.data;
    return normalizeImportResult({
      ready_count: payload.ready,
      error_count: payload.errors,
      errorRecords: (payload.errorRecords || []).map((e) => ({ row: e.row, message: e.error })),
      readyRecords: payload.readyRecords,
    });
  }
  const upload = await api.post(`/campaigns/${campaignId}/bulk-upload`, { csv });
  const payload = upload.data.data ?? upload.data;
  const members = payload.readyRecords || [];
  const res = await api.post(`/campaigns/${campaignId}/bulk-import`, { members });
  const result = res.data.data ?? res.data;
  return normalizeImportResult({ imported_count: result.imported ?? members.length, skipped_count: result.skipped ?? 0 });
}
