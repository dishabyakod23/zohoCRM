import { ownerName } from './recordHelpers.js';
import { DEFAULT_CURRENCY } from './currencies.js';
import { trimStringFields } from './formInput.js';
import {
  detectRecordModule,
  stripModuleToken,
  withModuleToken,
} from './companyHelpers.js';

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

/** Map API AccountOut address fields onto the billing_* / shipping_* UI shape. */
export function normalizeAccount(account, { defaultModule = 'account' } = {}) {
  if (!account) return account;
  const storedCurrency = getAccountCurrency(account.id);
  const detected = detectRecordModule(account);
  return {
    ...account,
    name: account.name || account.account_name,
    account_name: account.account_name || account.name,
    owner_name: ownerName(account) || account.owner_name,
    deal_size: account.deal_size ?? account.proposal_amount ?? null,
    currency: account.currency || storedCurrency || DEFAULT_CURRENCY,
    description: stripModuleToken(account.description),
    _crm_module: detected || defaultModule,
    // API billing address is unprefixed (street/city/…); UI uses billing_*.
    billing_street: account.billing_street || account.street || '',
    billing_city: account.billing_city || account.city || '',
    billing_state: account.billing_state || account.state || '',
    billing_country: account.billing_country || account.country || '',
    billing_zip: account.billing_zip || account.zip_code || account.billing_zip_code || '',
    shipping_street: account.shipping_street || '',
    shipping_city: account.shipping_city || '',
    shipping_state: account.shipping_state || '',
    shipping_country: account.shipping_country || '',
    shipping_zip: account.shipping_zip || account.shipping_zip_code || '',
    employees: account.employees ?? account.no_of_employees ?? null,
  };
}

function formHas(form, ...keys) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(form, key));
}

function pickFormValue(form, ...keys) {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(form, key)) continue;
    const value = form[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * Build create/update body for POST/PATCH /accounts.
 * API billing fields are street/city/state/country/zip_code (not billing_*).
 * Shipping zip is shipping_zip_code.
 * `module` stamps hidden membership so account_type changes do not move modules.
 */
export function toAccountPayload(form, { partial = false, module = 'account' } = {}) {
  form = trimStringFields(form) || form;

  const accountName = pickFormValue(form, 'account_name', 'name');
  const employees = pickFormValue(form, 'no_of_employees', 'employees');
  const billingStreet = pickFormValue(form, 'street', 'billing_street');
  const billingCity = pickFormValue(form, 'city', 'billing_city');
  const billingState = pickFormValue(form, 'state', 'billing_state');
  const billingCountry = pickFormValue(form, 'country', 'billing_country');
  const billingZip = pickFormValue(form, 'zip_code', 'billing_zip', 'billing_zip_code');
  const shippingZip = pickFormValue(form, 'shipping_zip_code', 'shipping_zip');
  const hasDescription = formHas(form, 'description');
  const stampedDescription = (hasDescription || !partial || form._stamp_module)
    ? withModuleToken(form.description, module)
    : undefined;

  const payload = {
    account_name: accountName || null,
    account_number: form.account_number ?? null,
    account_type: form.account_type ?? null,
    industry: form.industry ?? null,
    annual_revenue: form.annual_revenue ?? null,
    rating: form.rating ?? null,
    phone: form.phone ?? null,
    fax: form.fax ?? null,
    website: form.website ?? null,
    ticker_symbol: form.ticker_symbol ?? null,
    ownership: form.ownership ?? null,
    no_of_employees: employees ?? null,
    sic_code: form.sic_code ?? null,
    parent_account_id: form.parent_account_id ?? null,
    street: billingStreet ?? null,
    city: billingCity ?? null,
    state: billingState ?? null,
    country: billingCountry ?? null,
    zip_code: billingZip ?? null,
    shipping_street: form.shipping_street ?? null,
    shipping_city: form.shipping_city ?? null,
    shipping_state: form.shipping_state ?? null,
    shipping_country: form.shipping_country ?? null,
    shipping_zip_code: shippingZip ?? null,
    description: stampedDescription ?? null,
    deal_size: form.deal_size ?? null,
    proposal_amount: form.deal_size ?? form.proposal_amount ?? null,
    currency: form.currency || DEFAULT_CURRENCY,
    owner_id: form.owner_id ?? null,
    campaign_id: form.campaign_id ?? null,
  };

  if (!partial) return payload;

  // Partial PATCH: only send fields the form actually provided (UI aliases count).
  const include = {
    account_name: formHas(form, 'account_name', 'name'),
    account_number: formHas(form, 'account_number'),
    account_type: formHas(form, 'account_type'),
    industry: formHas(form, 'industry'),
    annual_revenue: formHas(form, 'annual_revenue'),
    rating: formHas(form, 'rating'),
    phone: formHas(form, 'phone'),
    fax: formHas(form, 'fax'),
    website: formHas(form, 'website'),
    ticker_symbol: formHas(form, 'ticker_symbol'),
    ownership: formHas(form, 'ownership'),
    no_of_employees: formHas(form, 'no_of_employees', 'employees'),
    sic_code: formHas(form, 'sic_code'),
    parent_account_id: formHas(form, 'parent_account_id'),
    street: formHas(form, 'street', 'billing_street'),
    city: formHas(form, 'city', 'billing_city'),
    state: formHas(form, 'state', 'billing_state'),
    country: formHas(form, 'country', 'billing_country'),
    zip_code: formHas(form, 'zip_code', 'billing_zip', 'billing_zip_code'),
    shipping_street: formHas(form, 'shipping_street'),
    shipping_city: formHas(form, 'shipping_city'),
    shipping_state: formHas(form, 'shipping_state'),
    shipping_country: formHas(form, 'shipping_country'),
    shipping_zip_code: formHas(form, 'shipping_zip_code', 'shipping_zip'),
    description: hasDescription || Boolean(form._stamp_module),
    deal_size: formHas(form, 'deal_size'),
    proposal_amount: formHas(form, 'proposal_amount', 'deal_size'),
    currency: formHas(form, 'currency'),
    owner_id: formHas(form, 'owner_id'),
    campaign_id: formHas(form, 'campaign_id'),
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      if (!include[key]) return false;
      if (key === 'currency') return value != null && value !== '';
      if (key === 'description') return value !== undefined;
      return value !== undefined && value !== null && value !== '';
    }),
  );
}
