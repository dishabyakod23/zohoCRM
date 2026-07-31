import { cachedLookup } from './lookupCache.js';
import * as campaignsApi from './services/campaigns.js';

export async function fetchCampaignLookups() {
  return cachedLookup('campaigns-list', async () => {
    const res = await campaignsApi.listCampaigns({ page: 1, page_size: 500 });
    return (res.data || []).map((c) => ({
      value: c.id,
      label: c.name || c.campaign_name || 'Campaign',
    }));
  });
}

export function resolveCampaignId(value, campaigns = []) {
  if (!value) return '';
  const raw = String(value).trim();
  const byId = campaigns.find((c) => String(c.value) === raw);
  if (byId) return byId.value;
  const norm = raw.toLowerCase();
  const byName = campaigns.find((c) => String(c.label).trim().toLowerCase() === norm);
  return byName?.value || '';
}

/** Find existing campaign by id/name, or create one when the user typed a new name. */
export async function resolveOrCreateCampaignId({
  campaign_id,
  campaign_name,
  campaigns,
} = {}) {
  const list = campaigns ?? await fetchCampaignLookups();
  const resolvedId = resolveCampaignId(campaign_id, list);
  if (resolvedId) return resolvedId;

  const typedName = String(campaign_name || '').trim();
  const nameFromId = campaign_id && !resolvedId
    ? String(campaign_id).trim()
    : '';
  const name = typedName || (nameFromId && !/^[0-9a-f-]{36}$/i.test(nameFromId) ? nameFromId : '');
  if (!name) return '';

  const existing = list.find((c) => String(c.label).trim().toLowerCase() === name.toLowerCase());
  if (existing) return existing.value;

  const created = await campaignsApi.createCampaign({ name });
  return created.id;
}

export async function assignRecordToCampaign(campaignId, memberType, memberId) {
  if (!campaignId || !memberId) return;
  try {
    await campaignsApi.addCampaignMember(campaignId, {
      member_type: memberType,
      member_id: memberId,
    });
  } catch (err) {
    const msg = String(err?.response?.data?.message || err?.message || '');
    if (!/already|duplicate|exists|member/i.test(msg)) throw err;
  }
}

export async function assignRecordsToCampaign(campaignId, memberType, memberIds) {
  if (!campaignId || !memberIds?.length) return;
  const members = memberIds
    .filter(Boolean)
    .map((member_id) => ({ member_type: memberType, member_id }));
  if (!members.length) return;
  await campaignsApi.addCampaignMembers(campaignId, members);
}

export async function resolveImportCampaignId(campaignId) {
  if (!campaignId) return '';
  const lookups = await fetchCampaignLookups().catch(() => []);
  return resolveCampaignId(campaignId, lookups) || String(campaignId).trim();
}

export function attachCampaignIdsToImportRecords(records, { defaultCampaignId, campaignLookups = [] } = {}) {
  return (records || []).map((record) => {
    const rowCampaignId = resolveCampaignId(
      record.campaign_id || record.campaign_name,
      campaignLookups,
    ) || defaultCampaignId;
    if (!rowCampaignId) return record;
    return { ...record, campaign_id: rowCampaignId };
  });
}

export async function afterRecordSave({ campaignId, memberType, recordId }) {
  if (campaignId && recordId) {
    await assignRecordToCampaign(campaignId, memberType, recordId);
  }
}

export async function loadCampaignMemberIdSet(campaignId, memberType) {
  if (!campaignId) return null;
  return cachedLookup(`campaign-members:${campaignId}:${memberType || 'all'}`, async () => {
    const { data: members } = await campaignsApi.listCampaignMembers(campaignId);
    const set = new Set();
    for (const member of members) {
      if (!memberType || member.member_type === memberType) {
        set.add(String(member.member_id));
      }
    }
    return set;
  });
}

export async function findRecordCampaign(memberType, memberId) {
  if (!memberId) return { campaign_id: '', campaign_name: '' };
  const campaigns = await fetchCampaignLookups();
  for (const campaign of campaigns) {
    const memberIds = await loadCampaignMemberIdSet(campaign.value, memberType);
    if (memberIds?.has(String(memberId))) {
      return { campaign_id: campaign.value, campaign_name: campaign.label };
    }
  }
  return { campaign_id: '', campaign_name: '' };
}

export async function saveRecordCampaignChange({
  campaignId,
  previousCampaignId,
  memberType,
  recordId,
}) {
  if (!recordId || campaignId === previousCampaignId) return;
  if (campaignId) await assignRecordToCampaign(campaignId, memberType, recordId);
}
