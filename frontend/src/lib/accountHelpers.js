import { ownerName } from './recordHelpers.js';
import { DEFAULT_CURRENCY } from './currencies.js';

const ACCOUNT_CURRENCY_KEY = 'crm_account_currency';

function readAccountCurrencyMap() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_CURRENCY_KEY) || '{}');
  } catch {
    return {};
  }
}

export function setAccountCurrency(accountId, currency) {
  if (typeof window === 'undefined' || !accountId || !currency) return;
  const map = readAccountCurrencyMap();
  map[String(accountId)] = currency;
  localStorage.setItem(ACCOUNT_CURRENCY_KEY, JSON.stringify(map));
}

export function getAccountCurrency(accountId) {
  if (!accountId) return null;
  return readAccountCurrencyMap()[String(accountId)] || null;
}

export function normalizeAccount(account) {
  if (!account) return account;
  const storedCurrency = getAccountCurrency(account.id);
  return {
    ...account,
    name: account.name || account.account_name,
    account_name: account.account_name || account.name,
    owner_name: ownerName(account) || account.owner_name,
    deal_size: account.deal_size ?? account.proposal_amount ?? null,
    currency: account.currency || storedCurrency || DEFAULT_CURRENCY,
  };
}

export function toAccountPayload(form, { partial = false } = {}) {
  const payload = {
    account_name: form.account_name || form.name,
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
    currency: form.currency || DEFAULT_CURRENCY,
    owner_id: form.owner_id || null,
  };
  if (partial) {
    return Object.fromEntries(
      Object.entries(payload).filter(([k, v]) => {
        if (!Object.prototype.hasOwnProperty.call(form, k)) return false;
        if (k === 'currency') return v != null && v !== '';
        return v !== undefined && v !== null && v !== '';
      }),
    );
  }
  return payload;
}
