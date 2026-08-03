import * as companiesApi from './services/companies.js';

/**
 * Resolve a contact's company link from either a selected company id or a typed name.
 * Creates the company when the name is new.
 */
export async function resolveContactCompanyId({
  company_id,
  company_name,
  account_id,
  account_name,
  companies = [],
  accounts = [],
  phone,
  mobile,
  owner_id,
} = {}) {
  const typed = String(company_name || account_name || '').trim();
  const id = String(company_id || account_id || '').trim();
  const options = companies.length ? companies : accounts;

  if (id) {
    const known = options.find((a) => String(a.value) === id);
    if (known) return known.value;
    if (/^[0-9a-f-]{36}$/i.test(id)) return id;
  }

  if (!typed) {
    throw new Error('Company name is required');
  }

  const match = options.find(
    (a) => String(a.label || a.name || '').trim().toLowerCase() === typed.toLowerCase(),
  );
  if (match) return match.value;

  const accountPhone = String(phone || mobile || '').replace(/\D/g, '');
  const created = await companiesApi.createCompany({
    company_name: typed,
    phone: accountPhone.length >= 7 ? (phone || mobile) : '0000000',
    owner_id: owner_id || null,
  });
  return created.id;
}

/** @deprecated Use resolveContactCompanyId — kept for existing imports. */
export const resolveContactAccountId = resolveContactCompanyId;

/**
 * Build API fields for linking a contact to a company (not an Account).
 * Contacts belong to Companies; Accounts are a separate converted-customer module.
 */
export async function resolveContactCompanyFields(args = {}) {
  const companyId = await resolveContactCompanyId(args);
  const companyName = String(args.company_name || args.account_name || '').trim();
  return {
    company_id: companyId,
    company_name: companyName || null,
    account_id: null,
  };
}
