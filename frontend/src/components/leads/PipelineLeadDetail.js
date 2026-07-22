'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRecordId, isValidRecordId } from '../../hooks/useRecordId.js';
import CRMLayout from '../layout/CRMLayout.js';
import Modal from '../ui/Modal.js';
import Badge from '../ui/Badge.js';
import LeadConvertMenu from './LeadConvertMenu.js';
import CallRecordButton from '../cloudtalk/CallRecordButton.js';
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
import { fetchUsers, fetchLeadStatuses, FALLBACK_LEAD_STATUSES } from '../../lib/services/lookups.js';
import { getPipelineConfig, pipelineStageLabel, isProposalLead, PIPELINE_RAW, PIPELINE_QUALIFIED, PIPELINE_PROPOSAL, PROPOSAL_DEAL_STATUSES, proposalDealStatusLabel } from '../../lib/pipelineHelpers.js';
import { ownerFieldConfig } from '../forms/ownerField.js';
import { LEAD_SOURCES } from '../../lib/constants.js';
import { formatMoney, CURRENCIES } from '../../lib/currencies.js';
import {
  EnvelopeIcon, PhoneIcon, DevicePhoneMobileIcon, BuildingOffice2Icon, TagIcon, TrashIcon, UserIcon,
} from '@heroicons/react/24/outline';

const INDUSTRIES = ['IT Services', 'E-Commerce', 'EdTech', 'Automotive', 'Finance', 'Healthcare', 'Manufacturing', 'Education', 'Media', 'Real Estate', 'Other'];

export default function PipelineLeadDetail({ stage }) {
  const config = getPipelineConfig(stage);
  const id = useRecordId();
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { canEdit, canDelete, canAssignLeads, isSuperAdmin } = usePermissions();
  const [lead, setLead] = useState(null);
  const [users, setUsers] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusOptions, setStatusOptions] = useState(FALLBACK_LEAD_STATUSES);

  useEffect(() => {
    fetchLeadStatuses().then(setStatusOptions).catch(() => setStatusOptions(FALLBACK_LEAD_STATUSES));
  }, []);

  useEffect(() => {
    if (canAssignLeads) fetchUsers().then(setUsers).catch(() => {});
  }, [canAssignLeads]);

  const leadMatchesStage = (r) => {
    if (stage === PIPELINE_PROPOSAL) return isProposalLead(r);
    if (stage === PIPELINE_QUALIFIED) return r.lead_status === 'qualified_lead' && !isProposalLead(r);
    if (stage === PIPELINE_RAW) return r.lead_status === 'raw_prospect';
    return r.lead_status === stage;
  };

  const loadLead = useCallback(() => {
    if (!isValidRecordId(id)) return;
    leadsApi.getLead(id).then((r) => {
      if (!leadMatchesStage(r)) {
        showToast('This record is not in the expected pipeline stage');
        router.push(config?.listPath || '/dashboard');
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
    }).catch(() => {
      showToast('Lead not found');
      router.push(config?.listPath || '/dashboard');
    });
  }, [id, stage, config?.listPath, router, showToast, user?.id]);

  useEffect(() => {
    if (!isValidRecordId(id)) return;
    loadLead();
  }, [loadLead, id]);

  const saveSection = async (payload) => {
    if (payload.email) {
      const uniqueErr = await validateEmailUnique(payload.email, { excludeLeadId: id });
      if (uniqueErr) {
        showToast(uniqueErr);
        throw new Error(uniqueErr);
      }
    }
    setSaving(true);
    try {
      await leadsApi.updateLead(id, payload);
      loadLead();
      showToast('Updated', 'success');
    } catch (err) {
      showToast(getApiError(err));
      throw err;
    } finally {
      setSaving(false);
    }
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

  const editable = canEdit;
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
      <RecordDetailLayout
        backHref={config.listPath}
        backLabel={config.listTitle}
        title={`${lead.first_name} ${lead.last_name}`}
        subtitle={lead.company}
        badges={<><Badge label={pipelineStageLabel(stage)} /><Badge label={lead.status} /></>}
        lastUpdated={new Date(lead.updated_at).toLocaleString()}
        recordNotes={{ relatedType: 'lead', recordId: id, canEdit: editable }}
        recordHistory={{ entityType: 'lead', recordId: id }}
        actions={
          <>
            <CallRecordButton phone={lead.phone} mobile={lead.mobile} label="Call Lead" />
            <LeadConvertMenu
              stage={stage}
              leadId={id}
              leadName={`${lead.first_name} ${lead.last_name}`}
              canEdit={editable}
              isAdmin={isSuperAdmin}
            />
            {canAssignLeads && (
              <button onClick={() => setAssignOpen(true)} className="btn-secondary text-xs flex items-center gap-1.5">
                <UserIcon className="w-4 h-4" /> Assign
              </button>
            )}
            {canDelete && (
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
              <InfoRow icon={<PhoneIcon className="w-4 h-4" />} label="Phone" value={lead.phone} href={lead.phone && `tel:${lead.phone}`} />
              <InfoRow icon={<DevicePhoneMobileIcon className="w-4 h-4" />} label="Mobile" value={lead.mobile} href={lead.mobile && `tel:${lead.mobile}`} />
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
            values={lead}
            onSave={saveSection}
            fields={[
              { name: 'first_name', label: 'First Name', required: true },
              { name: 'last_name', label: 'Last Name', required: true },
              { name: 'company', label: 'Company', required: true },
              { name: 'title', label: 'Job Title' },
              { name: 'lead_status', label: 'Lead Status', format: () => lead.status, render: (d, set) => select(statusOptions)(d, set, 'lead_status') },
              { name: 'source', label: 'Lead Source', render: (d, set) => select(LEAD_SOURCES, null, null)(d, set, 'source') },
              { name: 'industry', label: 'Industry', render: (d, set) => select(INDUSTRIES, null, null)(d, set, 'industry') },
              ownerFieldConfig({ users, canAssign: canAssignLeads, ownerName: lead.owner_name }),
              { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
                <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
              ) },
            ]}
          />
          {stage === PIPELINE_PROPOSAL && (
            <EditableFieldSection
              title="Proposal Information"
              canEdit={editable}
              saving={saving}
              values={lead}
              onSave={saveSection}
              fields={[
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
              ]}
            />
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
                  onChange={(e) => set((p) => ({ ...p, email: e.target.value }))}
                  excludeLeadId={id}
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
              { name: 'state', label: 'State' },
              { name: 'country', label: 'Country' },
              { name: 'zip', label: 'Zip Code' },
            ]}
          />
        </div>
      </RecordDetailLayout>

      <ConfirmDialog open={deleteConfirm} message={`Delete ${lead.first_name} ${lead.last_name}?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => {
          try { await leadsApi.deleteLead(id); router.push(config.listPath); showToast('Deleted', 'success'); }
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
