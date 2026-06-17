import { ownerName } from './recordHelpers.js';

export function normalizeAccount(account) {
  if (!account) return account;
  return {
    ...account,
    name: account.name || account.account_name,
    account_name: account.account_name || account.name,
    owner_name: ownerName(account) || account.owner_name,
    deal_size: account.deal_size ?? account.proposal_amount ?? null,
  };
}

export function toAccountPayload(form, { partial = false } = {}) {
  const payload = {
    account_name: form.account_name || form.name,
    account_site: form.account_site || null,
    account_number: form.account_number || null,
    account_type: form.account_type || null,
    industry: form.industry || null,
    annual_revenue: form.annual_revenue || null,
    rating: form.rating || null,
    phone: form.phone || null,
    fax: form.fax || null,
    website: form.website || null,
    ticker_symbol: form.ticker_symbol || null,
    ownership: form.ownership || null,
    employees: form.employees || null,
    sic_code: form.sic_code || null,
    parent_account_id: form.parent_account_id || null,
    billing_flat: form.billing_flat || null,
    billing_street: form.billing_street || null,
    billing_city: form.billing_city || null,
    billing_state: form.billing_state || null,
    billing_country: form.billing_country || null,
    billing_zip: form.billing_zip || null,
    billing_lat: form.billing_lat || null,
    billing_lng: form.billing_lng || null,
    shipping_flat: form.shipping_flat || null,
    shipping_street: form.shipping_street || null,
    shipping_city: form.shipping_city || null,
    shipping_state: form.shipping_state || null,
    shipping_country: form.shipping_country || null,
    shipping_zip: form.shipping_zip || null,
    shipping_lat: form.shipping_lat || null,
    shipping_lng: form.shipping_lng || null,
    description: form.description || null,
    deal_size: form.deal_size || null,
    proposal_amount: form.deal_size || form.proposal_amount || null,
    owner_id: form.owner_id || null,
  };
  if (partial) {
    return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  }
  return payload;
}
