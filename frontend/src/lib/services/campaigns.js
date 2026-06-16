import api from '../api.js';
import { assigneeName, formatEnumLabel, listResult, omitEmpty, toDateOnly } from '../activityHelpers.js';

export function normalizeCampaign(campaign) {
  return {
    ...campaign,
    name: campaign.campaign_name,
    type: campaign.campaign_type,
    type_label: formatEnumLabel(campaign.campaign_type),
    status_label: formatEnumLabel(campaign.status),
    owner_name: assigneeName(campaign),
  };
}

function toCampaignPayload(form, { partial = false } = {}) {
  return omitEmpty({
    campaign_name: form.name ?? form.campaign_name,
    campaign_type: form.type ?? form.campaign_type,
    status: form.status,
    start_date: form.start_date ? toDateOnly(form.start_date) : undefined,
    end_date: form.end_date ? toDateOnly(form.end_date) : undefined,
    expected_revenue: form.expected_revenue || null,
    budgeted_cost: form.budgeted_cost || null,
    actual_cost: form.actual_cost || null,
    description: form.description,
    owner_id: form.owner_id || null,
  });
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
