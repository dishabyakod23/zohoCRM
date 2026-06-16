import { ownerName } from './recordHelpers.js';

export function normalizeAccount(account) {
  if (!account) return account;
  return {
    ...account,
    name: account.name || account.account_name,
    account_name: account.account_name || account.name,
    owner_name: ownerName(account) || account.owner_name,
  };
}

export function toAccountPayload(form, { partial = false } = {}) {
  const payload = {
    account_name: form.account_name || form.name,
    phone: form.phone,
    industry: form.industry || null,
    website: form.website || null,
    city: form.city || null,
    state: form.state || null,
    country: form.country || null,
    zip_code: form.zip_code || form.zip || null,
    account_type: form.account_type || null,
    annual_revenue: form.annual_revenue || null,
    description: form.description || null,
    owner_id: form.owner_id || null,
  };
  if (partial) {
    return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  }
  return payload;
}
