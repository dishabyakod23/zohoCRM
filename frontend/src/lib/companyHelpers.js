import * as dealsApi from './services/deals.js';
import { ownerName } from './recordHelpers.js';
import { cachedRequest } from './requestCache.js';

const ACCOUNT_KIND_CACHE_MS = 5 * 60 * 1000;

export const COMPANY_ACCOUNT_TYPE = 'Prospect';
export const CONFIRMED_ACCOUNT_TYPE = 'Customer';

export function isConfirmedAccount(account, { dealAccountIds = new Set() } = {}) {
  if (!account?.id) return false;
  const type = String(account.account_type || '').trim().toLowerCase();
  if (type === CONFIRMED_ACCOUNT_TYPE.toLowerCase()) return true;
  if (dealAccountIds.has(String(account.id))) return true;
  return false;
}

export async function buildAccountKindContext() {
  return cachedRequest('account-kind-context', async () => {
    const deals = await dealsApi.listAllDeals();
    const dealAccountIds = new Set(
      (deals.data || [])
        .filter((deal) => deal.account_id)
        .map((deal) => String(deal.account_id)),
    );
    return { dealAccountIds };
  }, ACCOUNT_KIND_CACHE_MS);
}

export function normalizeCompany(company) {
  if (!company) return company;
  const name = company.company_name || company.account_name || company.name;
  return {
    ...company,
    name,
    company_name: name,
    account_name: name,
    owner_name: ownerName(company) || company.owner_name,
  };
}

export function toCompanyPayload(form, { partial = false } = {}) {
  const payload = {
    company_name: form.company_name || form.account_name || form.name,
    industry: form.industry || null,
    phone: form.phone || null,
    fax: form.fax || null,
    website: form.website || null,
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
    owner_id: form.owner_id || null,
  };

  if (partial) {
    const entries = Object.entries(payload).filter(([key, value]) => {
      if (key === 'company_name') {
        const hasName = Object.prototype.hasOwnProperty.call(form, 'company_name')
          || Object.prototype.hasOwnProperty.call(form, 'account_name')
          || Object.prototype.hasOwnProperty.call(form, 'name');
        return hasName && value !== undefined && value !== null && value !== '';
      }
      return Object.prototype.hasOwnProperty.call(form, key)
        && value !== undefined && value !== null && value !== '';
    });
    return Object.fromEntries(entries);
  }

  return payload;
}
