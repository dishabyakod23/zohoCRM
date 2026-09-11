import * as dealsApi from './services/deals.js';
import { ownerName } from './recordHelpers.js';
import { cachedRequest } from './requestCache.js';
import { trimStringFields } from './formInput.js';

const ACCOUNT_KIND_CACHE_MS = 5 * 60 * 1000;

export const COMPANY_ACCOUNT_TYPE = 'Prospect';
export const CONFIRMED_ACCOUNT_TYPE = 'Customer';

/** Hidden tokens keep Accounts vs Companies membership independent of account_type. */
export const ACCOUNT_MODULE_TOKEN = '<!--crm-module:account-->';
export const COMPANY_MODULE_TOKEN = '<!--crm-module:company-->';
const MODULE_TOKEN_RE = /\n?<!--crm-module:(account|company)-->\s*/g;

export function stripModuleToken(description) {
  return String(description || '').replace(MODULE_TOKEN_RE, '').trimEnd();
}

export function detectRecordModule(record) {
  const desc = String(record?.description || '');
  if (desc.includes('crm-module:account')) return 'account';
  if (desc.includes('crm-module:company')) return 'company';
  if (record?._crm_module === 'account' || record?._crm_module === 'company') {
    return record._crm_module;
  }
  return null;
}

export function withModuleToken(description, module) {
  const clean = stripModuleToken(description);
  const token = module === 'company' ? COMPANY_MODULE_TOKEN : ACCOUNT_MODULE_TOKEN;
  return clean ? `${clean}\n\n${token}` : token;
}

/**
 * Module membership is sticky until Convert.
 * account_type (Status) must not move records between Accounts and Companies.
 */
export function isAccountModuleRecord(record, { dealAccountIds = new Set() } = {}) {
  if (!record?.id) return false;
  const module = detectRecordModule(record);
  if (module === 'account') return true;
  if (module === 'company') return false;
  // Legacy rows without a token: keep prior confirmed-account heuristic.
  return isConfirmedAccount(record, { dealAccountIds });
}

export function isCompanyModuleRecord(record, context) {
  return !isAccountModuleRecord(record, context);
}

export function isConfirmedAccount(account, { dealAccountIds = new Set() } = {}) {
  if (!account?.id) return false;
  const module = detectRecordModule(account);
  if (module === 'account') return true;
  if (module === 'company') return false;
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

export function filterRecordsByModule(records, module, context) {
  const list = records || [];
  if (module === 'account') {
    return list.filter((record) => isAccountModuleRecord(record, context));
  }
  if (module === 'company') {
    return list.filter((record) => isCompanyModuleRecord(record, context));
  }
  return list;
}

export function normalizeCompany(company, { defaultModule = 'company' } = {}) {
  if (!company) return company;
  const name = company.company_name || company.account_name || company.name;
  const detected = detectRecordModule(company);
  return {
    ...company,
    name,
    company_name: name,
    account_name: name,
    owner_name: ownerName(company) || company.owner_name,
    description: stripModuleToken(company.description),
    _crm_module: detected || defaultModule,
  };
}

export function toCompanyPayload(form, { partial = false, module = 'company' } = {}) {
  form = trimStringFields(form) || form;
  const hasDescription = Object.prototype.hasOwnProperty.call(form, 'description')
    || Boolean(form._stamp_module);
  const description = hasDescription || !partial
    ? withModuleToken(form.description, module)
    : undefined;

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
    description: description ?? null,
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
      if (key === 'description') {
        return hasDescription && value !== undefined;
      }
      return Object.prototype.hasOwnProperty.call(form, key)
        && value !== undefined && value !== null && value !== '';
    });
    return Object.fromEntries(entries);
  }

  return payload;
}
