import { ownerName } from './recordHelpers.js';

export function normalizeContact(contact, accountMap = {}) {
  if (!contact) return contact;
  const account = accountMap[contact.account_id];
  return {
    ...contact,
    account_name: account?.label || account?.name || contact.account_name,
    owner_name: ownerName(contact) || contact.owner_name,
  };
}

export function toContactPayload(form, { partial = false } = {}) {
  const payload = {
    first_name: form.first_name || null,
    last_name: form.last_name,
    account_id: form.account_id,
    email: form.email,
    phone: form.phone,
    title: form.title || null,
    mobile: form.mobile || null,
    department: form.department || null,
    lead_source: form.lead_source || form.source || null,
    description: form.description || null,
    owner_id: form.owner_id || null,
  };
  if (partial) {
    return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  }
  return payload;
}
