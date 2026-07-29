'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  findRecordCampaign,
  saveRecordCampaignChange,
} from '../lib/campaignRecordHelpers.js';
import { useCampaignLookups } from './useCampaignLookups.js';

export function useRecordCampaign(memberType, recordId) {
  const { campaigns } = useCampaignLookups();
  const [campaignId, setCampaignId] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const previousCampaignIdRef = useRef('');

  useEffect(() => {
    if (!recordId) return undefined;
    let active = true;
    findRecordCampaign(memberType, recordId)
      .then(({ campaign_id, campaign_name }) => {
        if (!active) return;
        setCampaignId(campaign_id || '');
        setCampaignName(campaign_name || '');
        previousCampaignIdRef.current = campaign_id || '';
      })
      .catch(() => {
        if (!active) return;
        setCampaignId('');
        setCampaignName('');
        previousCampaignIdRef.current = '';
      });
    return () => { active = false; };
  }, [memberType, recordId]);

  const campaignField = useMemo(() => ({
    name: 'campaign_id',
    label: 'Campaign',
    format: () => campaignName || null,
    render: (draft, set) => (
      <select
        className="input"
        value={draft.campaign_id ?? ''}
        onChange={(e) => set((prev) => ({ ...prev, campaign_id: e.target.value }))}
      >
        <option value="">--None--</option>
        {campaigns.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
    ),
  }), [campaigns, campaignName]);

  const saveCampaignFromDraft = async (draft) => {
    if (!recordId || draft.campaign_id === undefined) return;
    await saveRecordCampaignChange({
      campaignId: draft.campaign_id,
      previousCampaignId: previousCampaignIdRef.current,
      memberType,
      recordId,
    });
    previousCampaignIdRef.current = draft.campaign_id || '';
    const match = campaigns.find((c) => c.value === draft.campaign_id);
    setCampaignId(draft.campaign_id || '');
    setCampaignName(match?.label || '');
  };

  return {
    campaignField,
    campaignId,
    campaignName,
    saveCampaignFromDraft,
    campaignValues: { campaign_id: campaignId, campaign_name: campaignName },
  };
}
