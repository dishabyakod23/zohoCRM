import { cachedLookup } from './lookupCache.js';
import { invalidateCachedRequest, invalidateCachedRequestPrefix } from './requestCache.js';
import * as campaignsApi from './services/campaigns.js';
import * as contactsApi from './services/contacts.js';
import * as leadsApi from './services/leads.js';
import * as accountsApi from './services/accounts.js';

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

export function invalidateCampaignCaches() {
  invalidateCachedRequest('lookup:campaigns-list');
  invalidateCachedRequestPrefix('lookup:campaign-members:');
}

function personNameParts(record = {}) {
  const first = String(record.first_name || '').trim();
  const last = String(record.last_name || '').trim();
  const full = `${first} ${last}`.trim();
  if (full) return { first_name: first, last_name: last, name: full };
  const fallback = String(
    record.name
    || record.member_name
    || record.full_name
    || record.account_name
    || record.company
    || record.label
    || '',
  ).trim();
  if (!fallback) return { first_name: '', last_name: '', name: '' };
  const parts = fallback.split(/\s+/);
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' '),
    name: fallback,
  };
}

/** Display fields for a campaign member row (name + email). */
export function formatCampaignMemberIdentity(member = {}) {
  const email = String(
    member.email
    || member.member_email
    || member.contact?.email
    || member.lead?.email
    || '',
  ).trim();

  const nested = member.contact || member.lead || member.account || {};
  const parts = personNameParts({
    first_name: member.first_name || nested.first_name,
    last_name: member.last_name || nested.last_name,
    name: member.member_name || member.name || nested.name || nested.label,
    account_name: member.account_name || nested.account_name,
    company: member.company || nested.company,
  });

  return {
    first_name: parts.first_name,
    last_name: parts.last_name,
    name: parts.name,
    email,
  };
}

export function campaignMemberDisplayName(member) {
  const { name, email } = formatCampaignMemberIdentity(member);
  return name || email || '';
}

async function resolveContactMap(ids) {
  if (!ids.size) return new Map();
  try {
    const { data } = await contactsApi.listAllContacts();
    const map = new Map();
    for (const contact of data || []) {
      const id = String(contact.id);
      if (!ids.has(id)) continue;
      map.set(id, { ...personNameParts(contact), email: contact.email || '' });
    }
    return map;
  } catch {
    return new Map();
  }
}

async function resolveLeadMap(ids) {
  if (!ids.size) return new Map();
  try {
    const { data } = await leadsApi.listAllLeads();
    const map = new Map();
    for (const lead of data || []) {
      const id = String(lead.id);
      if (!ids.has(id)) continue;
      map.set(id, { ...personNameParts(lead), email: lead.email || '' });
    }
    return map;
  } catch {
    return new Map();
  }
}

async function resolveAccountMap(ids) {
  if (!ids.size) return new Map();
  try {
    const { data } = await accountsApi.listAllAccounts();
    const map = new Map();
    for (const account of data || []) {
      const id = String(account.id);
      if (!ids.has(id)) continue;
      map.set(id, {
        ...personNameParts({ name: account.name || account.account_name }),
        email: account.email || '',
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

/** Attach first/last name + email onto campaign members that only have type/id. */
export async function enrichCampaignMembers(members = []) {
  const list = Array.isArray(members) ? members : [];
  if (!list.length) return [];

  const contactIds = new Set();
  const leadIds = new Set();
  const accountIds = new Set();
  for (const member of list) {
    const id = member?.member_id;
    if (!id) continue;
    const identity = formatCampaignMemberIdentity(member);
    if (identity.name && identity.email) continue;
    if (member.member_type === 'contact') contactIds.add(String(id));
    else if (member.member_type === 'lead') leadIds.add(String(id));
    else if (member.member_type === 'account') accountIds.add(String(id));
  }

  const [contactMap, leadMap, accountMap] = await Promise.all([
    resolveContactMap(contactIds),
    resolveLeadMap(leadIds),
    resolveAccountMap(accountIds),
  ]);

  return list.map((member) => {
    const id = String(member.member_id || '');
    const resolved = member.member_type === 'contact'
      ? contactMap.get(id)
      : member.member_type === 'lead'
        ? leadMap.get(id)
        : member.member_type === 'account'
          ? accountMap.get(id)
          : null;

    const current = formatCampaignMemberIdentity(member);
    const first_name = current.first_name || resolved?.first_name || '';
    const last_name = current.last_name || resolved?.last_name || '';
    const name = current.name || resolved?.name || '';
    const email = current.email || resolved?.email || '';

    return {
      ...member,
      first_name,
      last_name,
      email,
      member_name: name || member.member_name || '',
      member_email: email || member.member_email || '',
    };
  });
}
