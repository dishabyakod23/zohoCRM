import { useEffect, useRef, useState } from 'react';
import { loadCampaignMemberGroups } from '../lib/campaignRecordHelpers.js';

/** Stable string key for memberType (string | string[] | null). */
export function campaignMemberTypeKey(memberType) {
  if (Array.isArray(memberType)) {
    return [...memberType].map(String).sort().join(',');
  }
  return memberType == null || memberType === '' ? '' : String(memberType);
}

const EMPTY_GROUPS = {
  ids: null,
  contactIds: [],
  leadIds: [],
  accountIds: [],
};

/**
 * Loads campaign member ids for client-side filtering.
 * Returns { memberIds, memberGroups, ready }.
 * Wait for ready before fetching when campaign_id is set.
 *
 * `memberType` may be a string or string[] — array identity is ignored.
 */
export function useCampaignMemberFilter(campaignId, memberType) {
  const [memberGroups, setMemberGroups] = useState(EMPTY_GROUPS);
  const [ready, setReady] = useState(true);
  const typeKey = campaignMemberTypeKey(memberType);
  const memberTypeRef = useRef(memberType);
  memberTypeRef.current = memberType;

  useEffect(() => {
    if (!campaignId) {
      setMemberGroups(EMPTY_GROUPS);
      setReady(true);
      return undefined;
    }
    let active = true;
    setReady(false);
    loadCampaignMemberGroups(campaignId, memberTypeRef.current)
      .then((groups) => {
        if (!active) return;
        setMemberGroups(groups || {
          ids: new Set(),
          contactIds: [],
          leadIds: [],
          accountIds: [],
        });
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setMemberGroups({
          ids: new Set(),
          contactIds: [],
          leadIds: [],
          accountIds: [],
        });
        setReady(true);
      });
    return () => { active = false; };
  }, [campaignId, typeKey]);

  return {
    memberIds: memberGroups.ids,
    memberGroups,
    ready,
  };
}
