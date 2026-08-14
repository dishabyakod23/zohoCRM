import { useEffect, useState } from 'react';
import { loadCampaignMemberIdSet } from '../lib/campaignRecordHelpers.js';

/**
 * Loads campaign member ids for client-side filtering.
 * Returns { memberIds, ready } — wait for ready before fetching when campaign_id is set.
 */
export function useCampaignMemberFilter(campaignId, memberType) {
  const [memberIds, setMemberIds] = useState(null);
  const [ready, setReady] = useState(true);

  useEffect(() => {
    if (!campaignId) {
      setMemberIds(null);
      setReady(true);
      return undefined;
    }
    let active = true;
    setReady(false);
    loadCampaignMemberIdSet(campaignId, memberType)
      .then((ids) => {
        if (active) {
          setMemberIds(ids);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setMemberIds(new Set());
          setReady(true);
        }
      });
    return () => { active = false; };
  }, [campaignId, memberType]);

  return { memberIds, ready };
}
