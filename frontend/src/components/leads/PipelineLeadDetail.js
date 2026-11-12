'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRecordId, isValidRecordId, getRecordIdFromPathname } from '../../hooks/useRecordId.js';
import CRMLayout from '../layout/CRMLayout.js';
import Modal from '../ui/Modal.js';
import Badge from '../ui/Badge.js';
import LeadConvertMenu from './LeadConvertMenu.js';
import CallRecordButton from '../cloudtalk/CallRecordButton.js';
import { formatPhoneForDisplay } from '../../lib/cloudTalkHelpers.js';
import ConfirmDialog from '../ui/ConfirmDialog.js';
import FormField, { inputClass } from '../forms/FormField.js';
import RecordDetailLayout, { InfoRow } from '../records/RecordDetailLayout.js';
import RecordDetailSkeleton from '../records/RecordDetailSkeleton.js';
import EditableFieldSection from '../records/EditableFieldSection.js';
import EditableEmailField from '../forms/EditableEmailField.js';
import { useToast } from '../ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import { validateEmailUnique } from '../../lib/emailHelpers.js';
import { markRecordListStale } from '../../lib/recordUpdateEvents.js';
import * as leadsApi from '../../lib/services/leads.js';
import { proposalOutcomeMove, convertWonProposalToAccount } from '../../lib/services/proposalOutcome.js';
import { fetchUsers, fetchLeadStatuses, fetchLeadSources, fetchLostReasons, FALLBACK_LEAD_STATUSES } from '../../lib/services/lookups.js';
import { getPipelineConfig, pipelineStageLabel, PIPELINE_RAW, PIPELINE_QUALIFIED, PIPELINE_PROPOSAL, PROPOSAL_DEAL_STATUSES, DEAL_STATUS_LOST, LOST_PROPOSALS_PATH, PROPOSAL_TYPES, proposalDealStatusLabel, proposalTypeLabel, resolveLeadPipelineStage, getLeadDetailPath, outreachLeadStatusOptions, emptyProposalDetails, buildSiblingProposalPayloads, otherProposalsForClient } from '../../lib/pipelineHelpers.js';
import { isLostLeadStatus, lostReasonLabel } from '../../lib/statusHelpers.js';
import { ownerFieldConfig } from '../forms/ownerField.js';
import { trackRecentItem } from '../layout/BottomUtilityBar.js';
import ReadOnlyRecordBanner from '../records/ReadOnlyRecordBanner.js';
import { navigateToRecord } from '../../lib/recordNavigation.js';
import { useRecordCampaign } from '../../hooks/useRecordCampaign.js';
import { trimStartValue } from '../../lib/formInput.js';
import { IndustrySelectControl } from '../forms/IndustryField.js';
import {
  AddressCountrySelect,
  AddressStateSelect,
} from '../forms/AddressCountryStateFields.js';
import { nextStateForCountry } from '../../lib/addressRegions.js';
import { formatMoney, CURRENCIES, DEFAULT_CURRENCY } from '../../lib/currencies.js';
import CurrencyAmountInput from '../forms/CurrencyAmountInput.js';
import AccountNameCombobox from '../forms/AccountNameCombobox.js';
import ProposalDetailFields from './ProposalDetailFields.js';
import RecordDetailLink from '../records/RecordDetailLink.js';
import { useCompanyLookups } from '../../hooks/useCompanyLookups.js';
import { SALUTATIONS } from '../../lib/constants.js';
import {
  normalizeSalutation,
  LEAD_SALUTATION_BACKEND_MESSAGE,
} from '../../lib/leadHelpers.js';
import {
  EnvelopeIcon, PhoneIcon, DevicePhoneMobileIcon, BuildingOffice2Icon, TagIcon, TrashIcon, UserIcon,
} from '@heroicons/react/24/outline';

export default function PipelineLeadDetail({ stage }) {
  const config = getPipelineConfig(stage);
  const id = useRecordId();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { can, canEditRecord, canDeleteRecord, canAssignLeads, isSuperAdmin, isSalesManager } = usePermissions();
  const [lead, setLead] = useState(null);
  const [users, setUsers] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [extraProposals, setExtraProposals] = useState([]);
  const extraProposalKey = useRef(0);
  const [clientProposals, setClientProposals] = useState([]);

  const loadClientProposals = useCallback(async (record) => {
    if (stage !== PIPELINE_PROPOSAL || !record?.id) return;
    try {
      const { data } = await leadsApi.listAllLeads({
        pipeline_stage: PIPELINE_PROPOSAL,
        search: record.email || record.company || undefined,
      });
      setClientProposals(otherProposalsForClient(record, data));
    } catch {
      setClientProposals([]);
    }
  }, [stage]);
  const [statusOptions, setStatusOptions] = useState(() => outreachLeadStatusOptions(FALLBACK_LEAD_STATUSES));
  const [sourceOptions, setSourceOptions] = useState([]);
  const [lostReasonOptions, setLostReasonOptions] = useState([]);
  const { companies } = useCompanyLookups();
  const { campaignField, saveCampaignFromDraft, campaignValues } = useRecordCampaign(
    'lead',
    id,
    lead ? { campaign_id: lead.campaign_id, campaign_name: lead.campaign_name } : null,
  );

  useEffect(() => {
    fetchLeadStatuses()
      .then((options) => setStatusOptions(outreachLeadStatusOptions(options)))
      .catch(() => setStatusOptions(outreachLeadStatusOptions(FALLBACK_LEAD_STATUSES)));
    fetchLeadSources().then(setSourceOptions).catch(() => setSourceOptions([]));
    fetchLostReasons().then(setLostReasonOptions).catch(() => setLostReasonOptions([]));
  }, []);

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => {});
  }, []);

  const loadLead = useCallback(() => {
    if (!isValidRecordId(id)) return;
    leadsApi.getLead(id).then((r) => {
      const resolved = resolveLeadPipelineStage(r);
      if (resolved !== stage) {
        if (resolved) {
          navigateToRecord(getLeadDetailPath(r, id));
          return;
        }
        showToast('This record is not in the expected pipeline stage');
        navigateToRecord(config?.listPath || '/dashboard');
        return;
      }
      setLead(r);
      setAssignUserId(r.owner_id || user?.id || '');
      trackRecentItem({
        type: 'lead',
        id,
        name: `${r.first_name} ${r.last_name}`,
        pipelineStage: stage,
        lead: r,
      });
    }).catch((err) => {
      if (err?.response?.status === 401) return;
      showToast('Lead not found');
      navigateToRecord(config?.listPath || '/dashboard');
    });
  }, [id, stage, config?.listPath, showToast, user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined' || isValidRecordId(id)) return undefined;
    const timer = window.setTimeout(() => {
      const fromPath = getRecordIdFromPathname(window.location.pathname);
      if (!isValidRecordId(fromPath)) {
        showToast('Lead not found');
        navigateToRecord(config?.listPath || '/dashboard');
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id, config?.listPath, showToast]);

  useEffect(() => {
    if (!isValidRecordId(id)) return;
    loadLead();
  }, [loadLead, id]);

  useEffect(() => {
    if (lead?.id) loadClientProposals(lead);
    // Reload only when the record or its client identity changes, not on every field edit.
  }, [lead?.id, lead?.email, lead?.company, loadClientProposals]);

  const saveSection = async (payload) => {
    // Guard set synchronously (before any await) so a rapid double-click or a slow
    // in-flight email-uniqueness check can't start a second, concurrent submission.
    if (savingRef.current) throw new Error('Save already in progress');
    savingRef.current = true;
    setSaving(true);
    try {
      // One client can have several proposals with the same email, so proposals skip the unique check.
      if (payload.email && stage !== PIPELINE_PROPOSAL) {
        const uniqueErr = await validateEmailUnique(payload.email, { excludeLeadId: id });
        if (uniqueErr) throw new Error(uniqueErr);
      }
      const { campaign_id: draftCampaignId, campaign_name: draftCampaignName, ...leadPayload } = payload;
      const updated = await leadsApi.updateLead(id, leadPayload);
      if (draftCampaignId !== undefined || draftCampaignName !== undefined) {
        await saveCampaignFromDraft({ campaign_id: draftCampaignId, campaign_name: draftCampaignName });
      }
      let refreshed = await leadsApi.getLead(id).catch(() => updated);
      const savedReason = leadPayload.lost_reason || updated?.lost_reason || '';
      const savedStatus = leadPayload.lead_status || refreshed?.lead_status || updated?.lead_status;
      // If PATCH accepted lost_reason but GET still omits it, persist via mass-update (same as table).
      if (savedReason && isLostLeadStatus(savedStatus) && !refreshed?.lost_reason) {
        try {
          await leadsApi.massUpdateLeads([id], 'lead_status', savedStatus, { lost_reason: savedReason });
          refreshed = await leadsApi.getLead(id).catch(() => refreshed);
        } catch {
          // Keep local reason even if mass-update is unavailable.
        }
      }
      const salutationDropped = Object.prototype.hasOwnProperty.call(leadPayload, 'salutation')
        && Boolean(leadPayload.salutation)
        && !normalizeSalutation(refreshed?.salutation || refreshed?.prefix || '');
      setLead({
        ...refreshed,
        lost_reason: refreshed?.lost_reason || savedReason || '',
        ...(salutationDropped
          ? { salutation: normalizeSalutation(leadPayload.salutation || updated?.salutation) }
          : {}),
      });
      if (salutationDropped) {
        showToast(LEAD_SALUTATION_BACKEND_MESSAGE, 'error');
      } else {
        showToast('Updated', 'success');
      }
    } catch (err) {
      showToast(getApiError(err));
      throw err;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const addExtraProposal = () => {
    extraProposalKey.current += 1;
    setExtraProposals((list) => [
      ...list,
      { key: `proposal-${extraProposalKey.current}`, ...emptyProposalDetails(lead?.amc_currency || lead?.currency || DEFAULT_CURRENCY) },
    ]);
  };

  const updateExtraProposal = (key, field, value) => {
    setExtraProposals((list) => list.map((p) => (p.key === key ? { ...p, [field]: value } : p)));
  };

  // Saves this proposal, then creates each added proposal as a new record for the same client.
  // Added proposals that fail stay in the form (and edit mode stays open) so they can be retried.
  const saveProposalSection = async (payload) => {
    const previousDealStatus = lead?.deal_status || '';
    await saveSection(payload);
    if (extraProposals.length) await saveExtraProposals(payload);
    await moveProposalForDealOutcome(previousDealStatus, payload.deal_status);
  };

  // Deal Won → Accounts. Deal Lost stays a proposal and shows in the Lost Proposals tab, so there is
  // nothing more to save. The edit is already saved, so a failed move only shows a message; the
  // Convert menu can still do it.
  const moveProposalForDealOutcome = async (previousStatus, nextStatus) => {
    const move = proposalOutcomeMove(previousStatus, nextStatus);
    if (!move) return;
    if (move === 'lost') {
      markRecordListStale();
      showToast('Deal Lost — moved to Lost Proposals', 'success');
      navigateToRecord(LOST_PROPOSALS_PATH);
      return;
    }
    setSaving(true);
    try {
      const accountId = await convertWonProposalToAccount(id, lead?.company);
      markRecordListStale();
      showToast('Deal Won — moved to Accounts', 'success');
      navigateToRecord(accountId ? `/accounts/${accountId}` : '/accounts');
    } catch (err) {
      showToast(`Saved, but could not move it to Accounts: ${getApiError(err)}`);
      loadLead();
    } finally {
      setSaving(false);
    }
  };

  const saveExtraProposals = async (payload) => {
    const payloads = buildSiblingProposalPayloads({ ...lead, ...payload }, extraProposals);
    const failed = [];
    const errors = [];
    setSaving(true);
    try {
      for (let i = 0; i < payloads.length; i += 1) {
        try {
          await leadsApi.createProposal(payloads[i], { currentUserId: user?.id });
        } catch (err) {
          failed.push(extraProposals[i]);
          errors.push(getApiError(err));
        }
      }
    } finally {
      setSaving(false);
    }
    const created = payloads.length - failed.length;
    if (created) {
      markRecordListStale();
      loadClientProposals({ ...lead, ...payload });
    }
    setExtraProposals(failed);
    if (failed.length) {
      showToast(`${created} of ${payloads.length} new proposals created. Not saved — ${errors.join('; ')}`);
      throw new Error('Some proposals were not created');
    }
    showToast(created === 1 ? 'Updated and 1 more proposal created' : `Updated and ${created} more proposals created`, 'success');
  };

  const handleAssign = async () => {
    if (!assignUserId) return;
    setSaving(true);
    try {
      await leadsApi.assignLead(id, assignUserId);
      markRecordListStale();
      showToast('Lead assigned', 'success');
      setAssignOpen(false);
      loadLead();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!lead) return <CRMLayout><RecordDetailSkeleton /></CRMLayout>;

  const isLostProposal = stage === PIPELINE_PROPOSAL && lead.deal_status === DEAL_STATUS_LOST;
  const editable = canEditRecord(lead);
  const deletable = canDeleteRecord(lead);
  const canChangeOwner = canAssignLeads || editable;
  const adminTier = isSuperAdmin || isSalesManager;
  const statusFieldLabel = stage === PIPELINE_RAW
    ? 'Cold Lead Status'
    : stage === PIPELINE_QUALIFIED
      ? 'Qualified Lead Status'
      : 'Lead Status';
  const select = (opts, key = 'value', labelKey = 'label') => (draft, setDraft, field) => (
    <select className="input" value={draft[field] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}>
      <option value="">--None--</option>
      {opts.map((o) => (typeof o === 'string'
        ? <option key={o} value={o}>{o}</option>
        : <option key={o[key]} value={o[key]}>{o[labelKey]}</option>))}
    </select>
  );

  return (
    <CRMLayout>
      <ReadOnlyRecordBanner show={!editable} />
      <RecordDetailLayout
        backHref={isLostProposal ? LOST_PROPOSALS_PATH : config.listPath}
        backLabel={isLostProposal ? 'Lost Proposals' : config.listTitle}
        title={`${lead.first_name} ${lead.last_name}`}
        subtitle={lead.company}
        badges={(
          <>
            <Badge label={pipelineStageLabel(stage)} />
            {(() => {
              const statusLabel = String(lead.status || '').trim();
              const stageLabel = pipelineStageLabel(stage);
              const isPlaceholder = !statusLabel || statusLabel === '—' || statusLabel === '-';
              if (isPlaceholder || statusLabel === stageLabel) return null;
              return <Badge label={statusLabel} />;
            })()}
          </>
        )}
        lastUpdated={new Date(lead.updated_at).toLocaleString()}
        recordNotes={{ relatedType: 'lead', recordId: id, canEdit: editable }}
        recordHistory={{ entityType: 'lead', recordId: id }}
        actions={
          <>
            {stage === PIPELINE_PROPOSAL && can('proposals', 'create') && (
              <button
                type="button"
                onClick={() => navigateToRecord(`/proposals/create/?from=${id}`)}
                className="btn-primary text-xs"
              >
                + Add Proposal
              </button>
            )}
            <CallRecordButton phone={lead.phone} mobile={lead.mobile} label="Call Lead" />
            <LeadConvertMenu
              stage={stage}
              leadId={id}
              leadName={`${lead.first_name} ${lead.last_name}`}
              canEdit={editable}
              isAdmin={adminTier}
              dealStatus={stage === PIPELINE_PROPOSAL ? (lead.deal_status || '') : undefined}
            />
            {canChangeOwner && (
              <button onClick={() => setAssignOpen(true)} className="btn-secondary text-xs flex items-center gap-1.5">
                <UserIcon className="w-4 h-4" /> Assign
              </button>
            )}
            {deletable && (
              <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5">
                <TrashIcon className="w-4 h-4" /> Delete
              </button>
            )}
          </>
        }
        sidebar={
          <div className="card p-4">
            <h3 className="zoho-widget-title">Contact Details</h3>
            <div className="divide-y divide-gray-50">
              <InfoRow icon={<EnvelopeIcon className="w-4 h-4" />} label="Email" value={lead.email} href={lead.email && `mailto:${lead.email}`} />
              <InfoRow icon={<PhoneIcon className="w-4 h-4" />} label="Phone" value={lead.phone && formatPhoneForDisplay(String(lead.phone))} href={lead.phone && `tel:${lead.phone}`} />
              <InfoRow icon={<DevicePhoneMobileIcon className="w-4 h-4" />} label="Mobile" value={lead.mobile && formatPhoneForDisplay(String(lead.mobile))} href={lead.mobile && `tel:${lead.mobile}`} />
              <InfoRow icon={<BuildingOffice2Icon className="w-4 h-4" />} label="Company" value={lead.company} />
              <InfoRow icon={<TagIcon className="w-4 h-4" />} label="Lead Source" value={lead.source} />
              <InfoRow icon={<UserIcon className="w-4 h-4" />} label="Owner" value={lead.owner_name || 'Unassigned'} />
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <EditableFieldSection
            title="Lead Information"
            canEdit={editable}
            saving={saving}
            values={{ ...lead, ...campaignValues }}
            onSave={saveSection}
            fields={[
              { name: 'salutation', label: 'Salutation', render: (d, set) => select(SALUTATIONS, null, null)(d, set, 'salutation') },
              { name: 'first_name', label: 'First Name', required: true },
              { name: 'last_name', label: 'Last Name', required: true },
              { name: 'company', label: 'Company', required: true, render: (d, set) => (
                <AccountNameCombobox
                  options={companies}
                  valueId=""
                  valueLabel={d.company || ''}
                  placeholder="Search or type company name"
                  onChange={({ account_name }) => {
                    set((p) => ({ ...p, company: account_name || '' }));
                  }}
                />
              ) },
              { name: 'title', label: 'Job Title' },
              { name: 'lead_status', label: statusFieldLabel, format: () => lead.status, render: (d, set) => (
                <select
                  className="input"
                  value={d.lead_status ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    set((prev) => ({
                      ...prev,
                      lead_status: value,
                      ...(isLostLeadStatus(value) ? {} : { lost_reason: '' }),
                    }));
                  }}
                >
                  <option value="">--None--</option>
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) },
              {
                name: 'lost_reason',
                label: 'Lost Reason',
                visibleWhen: (d) => isLostLeadStatus(d.lead_status),
                requiredWhen: (d) => isLostLeadStatus(d.lead_status),
                format: (v) => lostReasonLabel(v, lostReasonOptions),
                render: (d, set) => (
                  <select
                    className="input"
                    value={d.lost_reason ?? ''}
                    onChange={(e) => set((prev) => ({ ...prev, lost_reason: e.target.value }))}
                  >
                    <option value="">Select lost reason</option>
                    {lostReasonOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ),
              },
              { name: 'source', label: 'Lead Source', render: (d, set) => select(sourceOptions)(d, set, 'source') },
              { name: 'industry', label: 'Industry', render: (d, set) => (
                <IndustrySelectControl
                  value={d.industry ?? ''}
                  onChange={(industry) => set((p) => ({ ...p, industry }))}
                />
              ) },
              campaignField,
              ownerFieldConfig({ users, canAssign: canChangeOwner, ownerName: lead.owner_name }),
              { name: 'description', label: stage === PIPELINE_PROPOSAL ? 'Client Description' : 'Description', colSpan: true, render: (d, set) => (
                <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: trimStartValue(e.target.value) }))} />
              ) },
            ]}
          />
          {stage === PIPELINE_PROPOSAL && (
            <EditableFieldSection
              title="Proposal Information"
              canEdit={editable}
              saving={saving}
              values={lead}
              onSave={saveProposalSection}
              onEditStart={() => setExtraProposals([])}
              onCancel={() => setExtraProposals([])}
              editExtras={(
                <div className="mt-2">
                  {extraProposals.map((proposal, index) => (
                    <div key={proposal.key} className="pt-4 mt-4 border-t border-zoho-border/60">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider">{`New Proposal ${index + 1} for ${lead.company || 'this client'}`}</p>
                        <button
                          type="button"
                          onClick={() => setExtraProposals((list) => list.filter((p) => p.key !== proposal.key))}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <ProposalDetailFields
                        values={proposal}
                        currency={proposal.currency || lead.currency || DEFAULT_CURRENCY}
                        namePrefix={`${proposal.key}-`}
                        onChange={(field, value) => updateExtraProposal(proposal.key, field, value)}
                        onCurrencyChange={(e) => updateExtraProposal(proposal.key, 'currency', e.target.value)}
                      />
                    </div>
                  ))}
                  <button type="button" onClick={addExtraProposal} className="btn-secondary text-xs mt-4">
                    + Add another proposal
                  </button>
                </div>
              )}
              fields={[
                { name: 'proposal_name', label: 'Proposal Name', colSpan: true, render: (d, set) => (
                  <input
                    className="input"
                    type="text"
                    maxLength={200}
                    value={d.proposal_name ?? ''}
                    onChange={(e) => set((p) => ({ ...p, proposal_name: trimStartValue(e.target.value) }))}
                    placeholder="e.g. Website revamp"
                  />
                ) },
                { name: 'proposal_date', label: 'Proposal Date', format: (v) => (v ? new Date(v).toLocaleDateString() : null), render: (d, set) => (
                  <input className="input" type="date" value={(d.proposal_date ?? '').slice(0, 10)} onChange={(e) => set((p) => ({ ...p, proposal_date: e.target.value }))} />
                ) },
                { name: 'deal_size', label: 'Size of the Deal', format: (v) => formatMoney(v, lead.currency) },
                { name: 'currency', label: 'Currency', render: (d, set) => (
                  <select className="input" value={d.currency ?? lead.currency ?? 'INR'} onChange={(e) => set((p) => ({ ...p, currency: e.target.value }))}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                  </select>
                ) },
                { name: 'closure_date', label: 'Closure Date', format: (v) => (v ? new Date(v).toLocaleDateString() : null), render: (d, set) => (
                  <input className="input" type="date" value={(d.closure_date ?? '').slice(0, 10)} onChange={(e) => set((p) => ({ ...p, closure_date: e.target.value }))} />
                ) },
                { name: 'deal_status', label: 'Deal Status', format: () => lead.deal_status_label || proposalDealStatusLabel(lead.deal_status), render: (d, set) => select(PROPOSAL_DEAL_STATUSES)(d, set, 'deal_status') },
                { name: 'proposal_type', label: 'Proposal Type', format: () => lead.proposal_type_label || proposalTypeLabel(lead.proposal_type), render: (d, set) => select(PROPOSAL_TYPES)(d, set, 'proposal_type') },
                { name: 'amc_it_support', label: 'AMC / IT Support', format: (v) => formatMoney(v, lead.amc_currency || lead.currency), render: (d, set) => (
                  <CurrencyAmountInput
                    amount={d.amc_it_support ?? ''}
                    currency={d.amc_currency || lead.amc_currency || lead.currency || DEFAULT_CURRENCY}
                    onAmountChange={(e) => {
                      const value = e.target.value;
                      if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
                      set((p) => ({ ...p, amc_it_support: value }));
                    }}
                    onCurrencyChange={(e) => set((p) => ({ ...p, amc_currency: e.target.value }))}
                    placeholder="0"
                  />
                ) },
                { name: 'proposal_description', label: 'Proposal Description', colSpan: true, render: (d, set) => (
                  <textarea
                    className="input min-h-[80px]"
                    value={d.proposal_description ?? ''}
                    onChange={(e) => set((p) => ({ ...p, proposal_description: trimStartValue(e.target.value) }))}
                  />
                ) },
              ]}
            />
          )}
          {stage === PIPELINE_PROPOSAL && (
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-4">
                {`Other Proposals for ${lead.company || 'this client'} (${clientProposals.length})`}
              </h3>
              {clientProposals.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] text-zoho-muted uppercase tracking-wider">
                        <th className="py-2 pr-4 font-medium">Proposal Name</th>
                        <th className="py-2 pr-4 font-medium">Proposal Date</th>
                        <th className="py-2 pr-4 font-medium">Proposal Type</th>
                        <th className="py-2 pr-4 font-medium">Description</th>
                        <th className="py-2 pr-4 font-medium">Size of the Deal</th>
                        <th className="py-2 pr-4 font-medium">Deal Status</th>
                        <th className="py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zoho-border/60">
                      {clientProposals.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 pr-4 max-w-[200px] truncate" title={p.proposal_name || ''}>{p.proposal_name || '—'}</td>
                          <td className="py-2 pr-4">{p.proposal_date ? new Date(p.proposal_date).toLocaleDateString() : '—'}</td>
                          <td className="py-2 pr-4">{p.proposal_type_label || proposalTypeLabel(p.proposal_type)}</td>
                          <td className="py-2 pr-4 max-w-[240px] truncate" title={p.proposal_description || ''}>{p.proposal_description || '—'}</td>
                          <td className="py-2 pr-4">{p.deal_size ?? p.proposal_amount ? formatMoney(p.deal_size ?? p.proposal_amount, p.currency) : '—'}</td>
                          <td className="py-2 pr-4">{p.deal_status_label || proposalDealStatusLabel(p.deal_status)}</td>
                          <td className="py-2 text-right">
                            <RecordDetailLink href={config.detailPath(p.id)} className="text-xs font-medium text-brand-600 hover:underline">Open</RecordDetailLink>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-zoho-muted">No other proposals for this client yet. Click Edit on Proposal Information and use “+ Add another proposal”.</p>
              )}
            </div>
          )}
          <EditableFieldSection
            title="Contact Information"
            canEdit={editable}
            saving={saving}
            values={lead}
            onSave={saveSection}
            fields={[
              { name: 'email', label: 'Email', render: (d, set) => (
                <EditableEmailField
                  value={d.email}
                  onChange={(e) => set((p) => ({ ...p, email: trimStartValue(e.target.value) }))}
                  excludeLeadId={id}
                  enabled={stage !== PIPELINE_PROPOSAL}
                />
              ) },
              { name: 'phone', label: 'Phone' },
              { name: 'mobile', label: 'Mobile' },
            ]}
          />
          <EditableFieldSection
            title="Address Information"
            canEdit={editable}
            saving={saving}
            values={lead}
            onSave={saveSection}
            fields={[
              { name: 'street', label: 'Street' },
              { name: 'city', label: 'City' },
              { name: 'country', label: 'Country', render: (d, set) => (
                <AddressCountrySelect
                  value={d.country ?? ''}
                  onChange={(country) => set((p) => ({
                    ...p,
                    country,
                    state: nextStateForCountry(country, p.state),
                  }))}
                />
              ) },
              { name: 'state', label: 'State', render: (d, set) => (
                <AddressStateSelect
                  country={d.country}
                  value={d.state ?? ''}
                  onChange={(state) => set((p) => ({ ...p, state }))}
                />
              ) },
              { name: 'zip', label: 'Zip Code' },
            ]}
          />
        </div>
      </RecordDetailLayout>

      <ConfirmDialog open={deleteConfirm} message={`Delete ${lead.first_name} ${lead.last_name}?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => {
          try { await leadsApi.deleteLead(id); navigateToRecord(config.listPath); showToast('Deleted', 'success'); }
          catch (err) { showToast(getApiError(err)); }
        }} onCancel={() => setDeleteConfirm(false)} />

      {assignOpen && (
        <Modal title="Assign Lead" onClose={() => setAssignOpen(false)}>
          <FormField label="Assign to" name="owner_id">
            <select className={inputClass()} value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
              <option value="">Select user</option>
              {users.map((u) => <option key={u.id || u.value} value={u.id || u.value}>{u.name}</option>)}
            </select>
          </FormField>
          <div className="flex gap-2 justify-end pt-4">
            <button onClick={() => setAssignOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAssign} disabled={saving || !assignUserId} className="btn-primary">{saving ? 'Assigning...' : 'Assign'}</button>
          </div>
        </Modal>
      )}
    </CRMLayout>
  );
}
