import { ownerName } from './recordHelpers.js';
import { DEFAULT_CURRENCY } from './currencies.js';
import { coerceImportBool } from './importHelpers.js';
import { leadStatusLabel, resolveLeadStatusForApi } from './leadHelpers.js';
import { directoryLeadStatusValue } from './contactDirectoryHelpers.js';
import { isPipelineStageStatus } from './pipelineHelpers.js';
import { isLostLeadStatus, normalizeLostReasonValue } from './statusHelpers.js';

export function isImportUuid(value) {
  return /^[0-9a-f-]{36}$/i.test(String(value || '').trim());
}

/** Contact Lead Status is outreach-only — never send pipeline stage values. */
function contactOutreachLeadStatus(raw) {
  if (!raw) return null;
  if (isPipelineStageStatus(raw)) return null;
  const normalized = String(raw).trim();
  if (!normalized) return null;
  const label = normalized.toLowerCase();
  if (['cold lead', 'warm lead', 'qualified lead', 'proposal', 'contact', 'account', 'deal'].includes(label)) {
    return null;
  }
  return resolveLeadStatusForApi(raw);
}

export function normalizeContact(contact, companyMap = {}) {
  if (!contact) return contact;
  const companyId = contact.company_id || null;
  const company = companyMap[companyId];
  const companyName = contact.company_name
    || company?.label
    || company?.name
    || contact.account_name;
  const leadStatus = directoryLeadStatusValue(contact);
  return {
    ...contact,
    company_id: companyId,
    company_name: companyName || null,
    account_name: companyName || contact.account_name,
    owner_name: ownerName(contact) || contact.owner_name,
    currency: contact.currency || DEFAULT_CURRENCY,
    lead_status: leadStatus,
    lead_status_label: leadStatus ? leadStatusLabel(leadStatus) : '—',
    lost_reason: normalizeLostReasonValue(
      contact.lost_reason ?? contact.lostReason ?? contact.lost_reason_code,
    ),
  };
}

function formHas(form, key) {
  return Object.prototype.hasOwnProperty.call(form, key);
}

function applyCompanyLinkFields(payload, form) {
  const hasCompanyField = formHas(form, 'company_id')
    || formHas(form, 'company_name')
    || formHas(form, 'account_id')
    || formHas(form, 'account_name');
  if (!hasCompanyField) return;

  const companyId = form.company_id ?? form.account_id ?? null;
  const companyName = form.company_name ?? form.account_name ?? null;
  payload.company_id = companyId || null;
  if (companyName) payload.company_name = companyName;
  payload.account_id = null;
}

export function toContactPayload(form, { partial = false } = {}) {
  if (partial) {
    const payload = {};
    if (formHas(form, 'salutation')) payload.salutation = form.salutation || null;
    if (formHas(form, 'first_name')) payload.first_name = form.first_name || null;
    if (formHas(form, 'last_name')) payload.last_name = form.last_name;
    applyCompanyLinkFields(payload, form);
    if (formHas(form, 'email')) payload.email = form.email;
    if (formHas(form, 'phone')) payload.phone = form.phone || null;
    if (formHas(form, 'other_phone')) payload.other_phone = form.other_phone || null;
    if (formHas(form, 'home_phone')) payload.home_phone = form.home_phone || null;
    if (formHas(form, 'mobile')) payload.mobile = form.mobile || null;
    if (formHas(form, 'fax')) payload.fax = form.fax || null;
    if (formHas(form, 'secondary_email')) payload.secondary_email = form.secondary_email || null;
    if (formHas(form, 'skype_id')) payload.skype_id = form.skype_id || null;
    if (formHas(form, 'twitter')) payload.twitter = form.twitter || null;
    if (formHas(form, 'email_opt_out')) payload.email_opt_out = !!form.email_opt_out;
    if (formHas(form, 'title')) payload.title = form.title || null;
    if (formHas(form, 'department')) payload.department = form.department || null;
    if (formHas(form, 'lead_source') || formHas(form, 'source')) {
      payload.lead_source = form.lead_source || form.source || null;
    }
    if (formHas(form, 'lead_status') || formHas(form, 'status')) {
      payload.lead_status = contactOutreachLeadStatus(form.lead_status || form.status);
    }
    if (formHas(form, 'lost_reason')) {
      const statusForReason = payload.lead_status || form.lead_status || form.status;
      payload.lost_reason = isLostLeadStatus(statusForReason)
        ? (normalizeLostReasonValue(form.lost_reason) || null)
        : null;
    }
    if (formHas(form, 'reports_to_id')) payload.reports_to_id = form.reports_to_id || null;
    if (formHas(form, 'assistant')) payload.assistant = form.assistant || null;
    if (formHas(form, 'asst_phone')) payload.asst_phone = form.asst_phone || null;
    if (formHas(form, 'date_of_birth')) payload.date_of_birth = form.date_of_birth || null;
    if (formHas(form, 'website')) payload.website = form.website || null;
    if (formHas(form, 'mailing_flat')) payload.mailing_flat = form.mailing_flat || null;
    if (formHas(form, 'mailing_street')) payload.mailing_street = form.mailing_street || null;
    if (formHas(form, 'mailing_city')) payload.mailing_city = form.mailing_city || null;
    if (formHas(form, 'mailing_state')) payload.mailing_state = form.mailing_state || null;
    if (formHas(form, 'mailing_country')) payload.mailing_country = form.mailing_country || null;
    if (formHas(form, 'mailing_zip')) payload.mailing_zip = form.mailing_zip || null;
    if (formHas(form, 'mailing_lat')) payload.mailing_lat = form.mailing_lat || null;
    if (formHas(form, 'mailing_lng')) payload.mailing_lng = form.mailing_lng || null;
    if (formHas(form, 'other_flat')) payload.other_flat = form.other_flat || null;
    if (formHas(form, 'other_street')) payload.other_street = form.other_street || null;
    if (formHas(form, 'other_city')) payload.other_city = form.other_city || null;
    if (formHas(form, 'other_state')) payload.other_state = form.other_state || null;
    if (formHas(form, 'other_country')) payload.other_country = form.other_country || null;
    if (formHas(form, 'other_zip')) payload.other_zip = form.other_zip || null;
    if (formHas(form, 'other_lat')) payload.other_lat = form.other_lat || null;
    if (formHas(form, 'other_lng')) payload.other_lng = form.other_lng || null;
    if (formHas(form, 'description')) payload.description = form.description || null;
    if (formHas(form, 'proposal_amount')) payload.proposal_amount = form.proposal_amount || null;
    if (formHas(form, 'currency')) payload.currency = form.currency || DEFAULT_CURRENCY;
    if (formHas(form, 'owner_id')) payload.owner_id = form.owner_id || null;
    return payload;
  }

  return {
    salutation: form.salutation || null,
    first_name: form.first_name,
    last_name: form.last_name,
    company_id: form.company_id || form.account_id || null,
    company_name: form.company_name || form.account_name || null,
    account_id: null,
    email: form.email,
    phone: form.phone || null,
    other_phone: form.other_phone || null,
    home_phone: form.home_phone || null,
    mobile: form.mobile || null,
    fax: form.fax || null,
    secondary_email: form.secondary_email || null,
    skype_id: form.skype_id || null,
    twitter: form.twitter || null,
    email_opt_out: !!form.email_opt_out,
    title: form.title || null,
    department: form.department || null,
    lead_source: form.lead_source || form.source || null,
    lead_status: contactOutreachLeadStatus(form.lead_status),
    ...(isLostLeadStatus(form.lead_status)
      ? { lost_reason: normalizeLostReasonValue(form.lost_reason) || null }
      : {}),
    reports_to_id: form.reports_to_id || null,
    assistant: form.assistant || null,
    asst_phone: form.asst_phone || null,
    date_of_birth: form.date_of_birth || null,
    website: form.website || null,
    mailing_flat: form.mailing_flat || null,
    mailing_street: form.mailing_street || null,
    mailing_city: form.mailing_city || null,
    mailing_state: form.mailing_state || null,
    mailing_country: form.mailing_country || null,
    mailing_zip: form.mailing_zip || null,
    mailing_lat: form.mailing_lat || null,
    mailing_lng: form.mailing_lng || null,
    other_flat: form.other_flat || null,
    other_street: form.other_street || null,
    other_city: form.other_city || null,
    other_state: form.other_state || null,
    other_country: form.other_country || null,
    other_zip: form.other_zip || null,
    other_lat: form.other_lat || null,
    other_lng: form.other_lng || null,
    description: form.description || null,
    proposal_amount: form.proposal_amount || null,
    currency: form.currency || DEFAULT_CURRENCY,
    owner_id: form.owner_id || null,
  };
}

/** Normalize bulk-upload rows before bulk-import while preserving API-resolved account_id. */
export function normalizeBulkUploadContactRecords(readyRecords = []) {
  return (readyRecords || []).map((record) => ({
    ...record,
    account_id: record.account_id || record.company_id || null,
    email_opt_out: coerceImportBool(record.email_opt_out),
    skype_id: record.skype_id || record.linkedin || null,
  }));
}

/** Fallback for lead-sync contact creation when bulk-upload did not resolve links. */
export async function prepareContactImportRecords(readyRecords = [], { companies = [] } = {}) {
  const { resolveContactCompanyFields } = await import('./resolveContactAccount.js');
  const processed = [];

  for (const record of readyRecords) {
    if (record.account_id && isImportUuid(record.account_id)) {
      processed.push(normalizeBulkUploadContactRecords([record])[0]);
      continue;
    }

    const companyName = String(
      record.company_name || record.account_name || record.account || record.company || '',
    ).trim() || null;

    let companyId = record.company_id && isImportUuid(record.company_id) ? record.company_id : null;

    if (!companyId && companyName) {
      const resolved = await resolveContactCompanyFields({
        company_name: companyName,
        companies,
        phone: record.phone,
        mobile: record.mobile,
        owner_id: record.owner_id || null,
      });
      companyId = resolved.company_id;
    }

    processed.push({
      ...normalizeBulkUploadContactRecords([record])[0],
      company_id: companyId,
      company_name: companyName,
      account_id: companyId || record.account_id || null,
    });
  }

  return processed;
}
