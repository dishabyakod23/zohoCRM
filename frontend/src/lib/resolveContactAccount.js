import * as accountsApi from './services/accounts.js';

/**
 * Resolve a contact's account_id from either a selected lookup id or a typed name.
 * Creates the account when the name is new.
 */
export async function resolveContactAccountId({
  account_id,
  account_name,
  accounts = [],
  phone,
  mobile,
  owner_id,
} = {}) {
  const typed = String(account_name || '').trim();
  const id = String(account_id || '').trim();

  if (id) {
    const known = accounts.find((a) => String(a.value) === id);
    if (known) return known.value;
    // Id present but not in lookups — still prefer it if UUID-like
    if (/^[0-9a-f-]{36}$/i.test(id)) return id;
  }

  if (!typed) {
    throw new Error('Account Name is required');
  }

  const match = accounts.find(
    (a) => String(a.label || a.name || '').trim().toLowerCase() === typed.toLowerCase(),
  );
  if (match) return match.value;

  const accountPhone = String(phone || mobile || '').replace(/\D/g, '');
  const created = await accountsApi.createAccount({
    account_name: typed,
    phone: accountPhone.length >= 7 ? (phone || mobile) : '0000000',
    owner_id: owner_id || null,
  });
  return created.id;
}
