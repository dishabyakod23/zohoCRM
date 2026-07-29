import { useEffect, useState } from 'react';
import { fetchCampaignLookups } from '../lib/campaignRecordHelpers.js';

export function useCampaignLookups() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchCampaignLookups()
      .then((rows) => { if (active) setCampaigns(rows); })
      .catch(() => { if (active) setCampaigns([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { campaigns, loading };
}
