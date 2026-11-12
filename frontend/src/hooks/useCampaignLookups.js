import { useEffect, useState } from 'react';
import { fetchCampaignLookups } from '../lib/campaignRecordHelpers.js';

/** Wait until the page has gone quiet (its main list request first), at most `timeout` ms. */
function whenIdle(fn, timeout = 1500) {
  if (typeof window === 'undefined') return () => {};
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, timeout);
  return () => window.clearTimeout(id);
}

/**
 * Campaign options for filters and pickers. The campaigns list is a slow request (500 rows),
 * so it starts once the page is idle instead of competing with the page's own table request;
 * after the first load it comes from the lookup cache, even across pages.
 */
export function useCampaignLookups() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const cancel = whenIdle(() => {
      fetchCampaignLookups()
        .then((rows) => { if (active) setCampaigns(rows); })
        .catch(() => { if (active) setCampaigns([]); })
        .finally(() => { if (active) setLoading(false); });
    });
    return () => {
      active = false;
      cancel();
    };
  }, []);

  return { campaigns, loading };
}
