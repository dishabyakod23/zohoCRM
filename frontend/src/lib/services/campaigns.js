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
  const res = await api.get('/campaigns', { params });
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

export async function listCampaignMembers(campaignId, params = {}) {
  const res = await api.get(`/campaigns/${campaignId}/members`, { params });
  return listResult(res);
}

export async function addCampaignMember(campaignId, payload) {
  const res = await api.post(`/campaigns/${campaignId}/members`, payload);
  return res.data.data;
}

export async function updateCampaignMember(campaignId, memberId, payload) {
  const res = await api.patch(`/campaigns/${campaignId}/members/${memberId}`, payload);
  return res.data.data;
}

export async function deleteCampaignMember(campaignId, memberId) {
  await api.delete(`/campaigns/${campaignId}/members/${memberId}`);
}

export async function downloadCampaignMemberImportTemplate(campaignId) {
  const res = await api.get(`/campaigns/${campaignId}/members/import/template`, { responseType: 'blob' });
  downloadBlob(res.data, 'campaign-members-template.csv');
}

export async function importCampaignMembers(campaignId, file, { dry_run = true } = {}) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/campaigns/${campaignId}/members/import`, formData, {
    params: { dry_run },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return normalizeImportResult(res.data.data);
}
