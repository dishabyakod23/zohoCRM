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

function formHas(form, key) {
  return Object.prototype.hasOwnProperty.call(form, key);
}

export function toContactPayload(form, { partial = false } = {}) {
  if (partial) {
    const payload = {};
    if (formHas(form, 'salutation')) payload.salutation = form.salutation || null;
    if (formHas(form, 'first_name')) payload.first_name = form.first_name || null;
    if (formHas(form, 'last_name')) payload.last_name = form.last_name;
    if (formHas(form, 'account_id')) payload.account_id = form.account_id;
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
}
