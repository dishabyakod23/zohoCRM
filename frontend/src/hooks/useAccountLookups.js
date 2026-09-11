import { useEffect, useState } from 'react';
import { fetchAccountLookups, fetchCompanyLookups } from '../lib/services/lookups.js';

function mergeOrgLookups(accounts = [], companies = []) {
  const byLabel = new Map();
  // Prefer account ids when the same name exists in both modules.
  for (const row of companies) {
    const key = String(row.label || '').trim().toLowerCase();
    if (!key || !row.value) continue;
    byLabel.set(key, row);
  }
  for (const row of accounts) {
    const key = String(row.label || '').trim().toLowerCase();
    if (!key || !row.value) continue;
    byLabel.set(key, row);
  }
  return Array.from(byLabel.values());
}

/**
 * Account name suggestions for create/edit.
 * Includes both Accounts and Companies so names still appear after records
 * were re-scoped by Status/account_type.
 */
export function useAccountLookups({ includeCompanies = true } = {}) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = includeCompanies
      ? Promise.all([fetchAccountLookups(), fetchCompanyLookups()])
        .then(([accountRows, companyRows]) => mergeOrgLookups(accountRows, companyRows))
      : fetchAccountLookups();

    load
      .then((rows) => { if (active) setAccounts(rows); })
      .catch(() => { if (active) setAccounts([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [includeCompanies]);

  return { accounts, loading };
}
