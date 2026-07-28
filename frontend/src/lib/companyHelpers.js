import * as dealsApi from './services/deals.js';

export const COMPANY_ACCOUNT_TYPE = 'Prospect';
export const CONFIRMED_ACCOUNT_TYPE = 'Customer';

export function isConfirmedAccount(account, { dealAccountIds = new Set() } = {}) {
  if (!account?.id) return false;
  const type = String(account.account_type || '').trim().toLowerCase();
  if (type === CONFIRMED_ACCOUNT_TYPE.toLowerCase()) return true;
  if (dealAccountIds.has(String(account.id))) return true;
  return false;
}

export function isCompanyAccount(account, context) {
  return !isConfirmedAccount(account, context);
}

export async function buildAccountKindContext() {
  const deals = await dealsApi.listAllDeals();
  const dealAccountIds = new Set(
    (deals.data || [])
      .filter((deal) => deal.account_id)
      .map((deal) => String(deal.account_id)),
  );
  return { dealAccountIds };
}

export function filterAccountsByKind(accounts, kind, context) {
  const list = accounts || [];
  if (kind === 'account') {
    return list.filter((account) => isConfirmedAccount(account, context));
  }
  if (kind === 'company') {
    return list.filter((account) => isCompanyAccount(account, context));
  }
  return list;
}

export async function fetchContactCountByAccount() {
  const { default: api } = await import('./api.js');
  const { DEFAULT_PAGE_SIZE } = await import('./constants.js');
  const pageSize = DEFAULT_PAGE_SIZE;
  let page = 1;
  const counts = new Map();

  while (page <= 50) {
    const res = await api.get('/contacts', { params: { page, page_size: pageSize } });
    const batch = res.data.data || [];
    for (const contact of batch) {
      const accountId = contact.account_id;
      if (!accountId) continue;
      const key = String(accountId);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const total = res.data.meta?.total ?? batch.length;
    if (batch.length === 0 || page * pageSize >= total) break;
    page += 1;
  }

  return counts;
}
