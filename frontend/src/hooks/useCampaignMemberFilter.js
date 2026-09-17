import { useEffect, useRef, useState } from 'react';
import { loadCampaignMemberIdSet } from '../lib/campaignRecordHelpers.js';

/** Stable string key for memberType (string | string[] | null). */
export function campaignMemberTypeKey(memberType) {
  if (Array.isArray(memberType)) {
    return [...memberType].map(String).sort().join(',');
  }
  return memberType == null || memberType === '' ? '' : String(memberType);
}

/**
 * Loads campaign member ids for client-side filtering.
 * Returns { memberIds, ready } — wait for ready before fetching when campaign_id is set.
 *
 * `memberType` may be a string or string[] — array identity is ignored; only contents matter,
 * so callers can pass `['contact', 'lead']` inline without causing fetch loops.
 */
export function useCampaignMemberFilter(campaignId, memberType) {
  const [memberIds, setMemberIds] = useState(null);
  const [ready, setReady] = useState(true);
  // Recompute each render — string result is stable for the same contents.
  const typeKey = campaignMemberTypeKey(memberType);
  const memberTypeRef = useRef(memberType);
  memberTypeRef.current = memberType;

  useEffect(() => {
    if (!campaignId) {
      setMemberIds(null);
      setReady(true);
      return undefined;
    }
    let active = true;
    setReady(false);
    loadCampaignMemberIdSet(campaignId, memberTypeRef.current)
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
  }, [campaignId, typeKey]);

  return { memberIds, ready };
}
