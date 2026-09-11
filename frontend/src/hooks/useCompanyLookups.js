import { useEffect, useState } from 'react';
import { fetchCompanyLookups } from '../lib/services/lookups.js';

export function useCompanyLookups() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchCompanyLookups()
      .then((rows) => { if (active) setCompanies(rows); })
      .catch(() => { if (active) setCompanies([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { companies, loading };
}
