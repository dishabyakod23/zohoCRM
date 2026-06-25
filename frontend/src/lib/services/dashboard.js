import api from '../api.js';
import { DEFAULT_CURRENCY } from '../currencies.js';
import * as accountsApi from './accounts.js';

function topAccountRows(home) {
  return home.top_accounts || home.topAccounts || [];
}

/** Dashboard home omits account currency — load it from each account record. */
async function enrichTopAccountsCurrency(rows) {
  const enriched = await Promise.all(rows.map(async (row) => {
    if (row.currency) return row;
    if (!row.id) return { ...row, currency: DEFAULT_CURRENCY };
    try {
      const account = await accountsApi.getAccount(row.id);
      return { ...row, currency: account.currency || DEFAULT_CURRENCY };
    } catch {
      return { ...row, currency: DEFAULT_CURRENCY };
    }
  }));
  return enriched;
}

export async function getDashboardHome() {
  const res = await api.get('/dashboard/home');
  const home = res.data.data;
  const topAccounts = await enrichTopAccountsCurrency(topAccountRows(home));
  return { ...home, top_accounts: topAccounts };
}
