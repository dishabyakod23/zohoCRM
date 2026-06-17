'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../layout/CRMLayout.js';
import Modal from '../ui/Modal.js';
import Badge from '../ui/Badge.js';
import LeadConvertMenu from './LeadConvertMenu.js';
import ConfirmDialog from '../ui/ConfirmDialog.js';
import FormField, { inputClass } from '../forms/FormField.js';
import RecordDetailLayout, { InfoRow } from '../records/RecordDetailLayout.js';
import EditableFieldSection from '../records/EditableFieldSection.js';
import { useToast } from '../ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import * as leadsApi from '../../lib/services/leads.js';
import { fetchUsers, fetchLeadStatuses, FALLBACK_LEAD_STATUSES } from '../../lib/services/lookups.js';
import { getPipelineConfig, pipelineStageLabel, isProposalLead, PIPELINE_RAW, PIPELINE_QUALIFIED, PIPELINE_PROPOSAL } from '../../lib/pipelineHelpers.js';
import { LEAD_SOURCES } from '../../lib/constants.js';
import {
  EnvelopeIcon, PhoneIcon, DevicePhoneMobileIcon, BuildingOffice2Icon, TagIcon, TrashIcon, UserIcon,
} from '@heroicons/react/24/outline';

const INDUSTRIES = ['IT Services', 'E-Commerce', 'EdTech', 'Automotive', 'Finance', 'Healthcare', 'Manufacturing', 'Education', 'Media', 'Real Estate', 'Other'];

export default function PipelineLeadDetail({ stage }) {
  const config = getPipelineConfig(stage);
  const { id } = useParams();
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
    leadsApi.getLead(id).then((r) => {
      if (!leadMatchesStage(r)) {
        showToast('This record is not in the expected pipeline stage');
        router.push(config?.listPath || '/dashboard');
        return;
      }
      setLead(r);
      setAssignUserId(r.owner_id || user?.id || '');
    }).catch(() => {
      showToast('Lead not found');
      router.push(config?.listPath || '/dashboard');
    });
  }, [id, stage, config?.listPath, router, showToast, user?.id]);

  useEffect(() => { loadLead(); }, [loadLead]);

  const saveSection = async (payload) => {
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
      showToast('Lead assigned', 'success');
      setAssignOpen(false);
      loadLead();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!lead) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

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
        actions={
          <>
            <LeadConvertMenu
              stage={stage}
              leadId={id}
              leadName={`${lead.first_name} ${lead.last_name}`}
              canEdit={editable}
              isAdmin={isSuperAdmin}
            />
            {canAssignLeads && config?.allowAssign && (
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
              { name: 'first_name', label: 'First Name' },
              { name: 'last_name', label: 'Last Name', required: true },
              { name: 'company', label: 'Company', required: true },
              { name: 'title', label: 'Job Title' },
              { name: 'lead_status', label: 'Lead Status', format: () => lead.status, render: (d, set) => select(statusOptions)(d, set, 'lead_status') },
              { name: 'source', label: 'Lead Source', render: (d, set) => select(LEAD_SOURCES, null, null)(d, set, 'source') },
              { name: 'industry', label: 'Industry', render: (d, set) => select(INDUSTRIES, null, null)(d, set, 'industry') },
              { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
                <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
              ) },
            ]}
          />
          <EditableFieldSection
            title="Contact Information"
            canEdit={editable}
            saving={saving}
            values={lead}
            onSave={saveSection}
            fields={[
              { name: 'email', label: 'Email' },
              { name: 'phone', label: 'Phone' },
              { name: 'mobile', label: 'Mobile' },
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
