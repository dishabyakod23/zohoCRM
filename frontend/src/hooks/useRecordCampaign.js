'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import CampaignCombobox from '../components/forms/CampaignCombobox.js';
import {
  findRecordCampaign,
  resolveOrCreateCampaignId,
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
      <CampaignCombobox
        options={campaigns}
        valueId={draft.campaign_id ?? campaignId ?? ''}
        valueLabel={draft.campaign_name ?? campaignName ?? ''}
        onChange={({ campaign_id, campaign_name }) => {
          set((prev) => ({ ...prev, campaign_id, campaign_name }));
        }}
      />
    ),
  }), [campaigns, campaignId, campaignName]);

  const saveCampaignFromDraft = async (draft) => {
    if (!recordId || (draft.campaign_id === undefined && draft.campaign_name === undefined)) return;
    const resolvedId = await resolveOrCreateCampaignId({
      campaign_id: draft.campaign_id,
      campaign_name: draft.campaign_name,
      campaigns,
    });
    await saveRecordCampaignChange({
      campaignId: resolvedId,
      previousCampaignId: previousCampaignIdRef.current,
      memberType,
      recordId,
    });
    previousCampaignIdRef.current = resolvedId || '';
    const match = campaigns.find((c) => c.value === resolvedId);
    setCampaignId(resolvedId || '');
    setCampaignName(match?.label || draft.campaign_name || '');
  };

  return {
    campaignField,
    campaignId,
    campaignName,
    saveCampaignFromDraft,
    campaignValues: { campaign_id: campaignId, campaign_name: campaignName },
  };
}
