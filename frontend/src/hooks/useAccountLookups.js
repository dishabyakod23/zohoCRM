import { useEffect, useState } from 'react';
import { fetchAccountLookups } from '../lib/services/lookups.js';

export function useAccountLookups() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchAccountLookups()
      .then((rows) => { if (active) setAccounts(rows); })
      .catch(() => { if (active) setAccounts([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { accounts, loading };
}
