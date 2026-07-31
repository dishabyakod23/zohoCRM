import api from './api.js';
import {
  assignRecordsToCampaign,
  attachCampaignIdsToImportRecords,
  fetchCampaignLookups,
  invalidateCampaignCaches,
} from './campaignRecordHelpers.js';
import { invalidateCachedRequestPrefix } from './requestCache.js';

function extractImportedIds(result = {}) {
  const records = Array.isArray(result.records) ? result.records : [];
  return records.map((row) => row?.id).filter(Boolean);
}

/** Link imported leads/contacts to a campaign and refresh cached member lists. */
export async function linkImportedRecordsToCampaign(campaignId, { leadIds = [], contactIds = [] } = {}) {
  if (!campaignId) return;
  const tasks = [];
  if (leadIds.length) tasks.push(assignRecordsToCampaign(campaignId, 'lead', leadIds));
  if (contactIds.length) tasks.push(assignRecordsToCampaign(campaignId, 'contact', contactIds));
  if (!tasks.length) return;
  await Promise.all(tasks);
  invalidateCampaignCaches();
}

/** Create contact records for imported leads so they appear in the Contacts module. */
export async function syncImportedLeadsAsContacts(readyRecords, { campaignId, campaignLookups = [] } = {}) {
  if (!readyRecords?.length) return { imported: 0, contactIds: [] };

  const contactRecords = readyRecords.map((record) => ({
    first_name: record.first_name,
    last_name: record.last_name,
    email: record.email,
    phone: record.phone || null,
    mobile: record.mobile || null,
    company_name: record.company || record.company_name || null,
    lead_source: record.lead_source || record.source || null,
    owner_id: record.owner_id || null,
    title: record.title || null,
  }));

  const records = attachCampaignIdsToImportRecords(contactRecords, {
    defaultCampaignId: campaignId,
    campaignLookups,
  });

  const importBody = { records };
  if (campaignId) importBody.campaign_id = campaignId;

  const res = await api.post('/contacts/bulk-import', importBody);
  const result = res.data?.data || res.data || {};
  const contactIds = extractImportedIds(result);
  return { imported: result.imported ?? contactIds.length, contactIds, result };
}

export async function finalizeLeadBulkImport({
  campaignId,
  importResult,
  readyRecords,
  campaignLookups = [],
  syncContacts = true,
}) {
  const leadIds = extractImportedIds(importResult);
  const backendContactIds = Array.isArray(importResult.contact_ids)
    ? importResult.contact_ids
    : extractImportedIds({ records: importResult.contacts || importResult.synced_contacts || [] });
  const campaignLinked = Boolean(
    importResult.campaign_linked
    || importResult.campaign_members_created
    || importResult.campaign_member_count,
  );

  let contactIds = backendContactIds;

  if (syncContacts && !contactIds.length && readyRecords?.length) {
    try {
      const contactImport = await syncImportedLeadsAsContacts(readyRecords, { campaignId, campaignLookups });
      contactIds = contactImport.contactIds || [];
    } catch {
      contactIds = [];
    }
  }

  if (campaignId && !campaignLinked) {
    await linkImportedRecordsToCampaign(campaignId, { leadIds, contactIds });
  }
  invalidateCachedRequestPrefix('lookup:account-contact-emails');
  return { leadIds, contactIds };
}

export async function syncSingleLeadAsContact(lead, campaignId) {
  if (!lead?.email) return null;
  const readyRecords = [{
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    phone: lead.phone,
    mobile: lead.mobile,
    company: lead.company,
    lead_source: lead.lead_source || lead.source,
    owner_id: lead.owner_id,
    title: lead.title,
  }];
  const campaignLookups = await fetchCampaignLookups().catch(() => []);
  const { contactIds } = await syncImportedLeadsAsContacts(readyRecords, { campaignId, campaignLookups });
  if (campaignId && lead.id) {
    await linkImportedRecordsToCampaign(campaignId, { leadIds: [lead.id], contactIds });
  }
  return contactIds[0] || null;
}
