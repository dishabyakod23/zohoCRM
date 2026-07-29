import { useEffect, useState } from 'react';
import { loadCampaignMemberIdSet } from '../lib/campaignRecordHelpers.js';

export function useCampaignMemberFilter(campaignId, memberType) {
  const [memberIds, setMemberIds] = useState(null);

  useEffect(() => {
    if (!campaignId) {
      setMemberIds(null);
      return undefined;
    }
    let active = true;
    loadCampaignMemberIdSet(campaignId, memberType)
      .then((ids) => { if (active) setMemberIds(ids); })
      .catch(() => { if (active) setMemberIds(new Set()); });
    return () => { active = false; };
  }, [campaignId, memberType]);

  return memberIds;
}
