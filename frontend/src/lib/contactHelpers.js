import { ownerName } from './recordHelpers.js';
import { DEFAULT_CURRENCY } from './currencies.js';

export function normalizeContact(contact, accountMap = {}) {
  if (!contact) return contact;
  const account = accountMap[contact.account_id];
  return {
    ...contact,
    account_name: account?.label || account?.name || contact.account_name,
    owner_name: ownerName(contact) || contact.owner_name,
    currency: contact.currency || DEFAULT_CURRENCY,
  };
}

export function toContactPayload(form, { partial = false } = {}) {
  const payload = {
    salutation: form.salutation || null,
    first_name: form.first_name || null,
    last_name: form.last_name,
    account_id: form.account_id,
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
  if (partial) {
    return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  }
  return payload;
}
