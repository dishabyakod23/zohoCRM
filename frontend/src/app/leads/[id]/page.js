'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import Badge from '../../../components/ui/Badge.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout, { InfoRow } from '../../../components/records/RecordDetailLayout.js';
import EditableFieldSection from '../../../components/records/EditableFieldSection.js';
import EditableEmailField from '../../../components/forms/EditableEmailField.js';
import LeadConvertMenu from '../../../components/leads/LeadConvertMenu.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { useMarkRecordViewed } from '../../../hooks/useMarkRecordViewed.js';
import { getApiError } from '../../../lib/api.js';
import { validateEmailUnique } from '../../../lib/emailHelpers.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';
import * as leadsApi from '../../../lib/services/leads.js';
import { fetchLeadStatuses, FALLBACK_LEAD_STATUSES } from '../../../lib/services/lookups.js';
import { LEAD_SOURCES, SALUTATIONS, RATINGS } from '../../../lib/constants.js';
import { PIPELINE_LEAD } from '../../../lib/pipelineHelpers.js';
import {
  EnvelopeIcon, PhoneIcon, DevicePhoneMobileIcon, BuildingOffice2Icon, TagIcon, TrashIcon,
} from '@heroicons/react/24/outline';

const INDUSTRIES = ['IT Services', 'E-Commerce', 'EdTech', 'Automotive', 'Finance', 'Healthcare', 'Manufacturing', 'Education', 'Media', 'Real Estate', 'Other'];

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit, canDelete, isSuperAdmin } = usePermissions();
  const [lead, setLead] = useState(null);
  const [statusOptions, setStatusOptions] = useState(FALLBACK_LEAD_STATUSES);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useMarkRecordViewed('lead', id);

  useEffect(() => {
    fetchLeadStatuses().then(setStatusOptions).catch(() => setStatusOptions(FALLBACK_LEAD_STATUSES));
  }, []);

  const loadLead = useCallback(() => {
    leadsApi.getLead(id).then((r) => {
      setLead(r);
      trackRecentItem({ type: 'lead', id, name: `${r.first_name} ${r.last_name}`, lead: r });
    }).catch(() => {
      showToast('Lead not found');
      router.push('/leads');
    });
  }, [id, router, showToast]);

  useEffect(() => {
    loadLead();
  }, [id, loadLead]);

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
      showToast('Lead updated', 'success');
    } catch (err) {
      showToast(getApiError(err));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (!lead) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

  const editable = canEdit && !lead.is_converted;
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
        backHref="/leads" backLabel="Leads"
        title={`${lead.first_name} ${lead.last_name}`}
        subtitle={lead.company}
        badges={<Badge label={lead.status} />}
        lastUpdated={new Date(lead.updated_at).toLocaleString()}
        recordNotes={{ relatedType: 'lead', recordId: id, canEdit }}
        actions={
          <>
            <LeadConvertMenu
              stage={PIPELINE_LEAD}
              leadId={id}
              leadName={`${lead.first_name} ${lead.last_name}`}
              canEdit={editable}
              isAdmin={isSuperAdmin}
              isConverted={lead.is_converted}
            />
            {canDelete && (
              <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5">
                <TrashIcon className="w-4 h-4" /> Delete
              </button>
            )}
          </>
        }
        sidebar={
          <>
            <div className="card p-4">
              <h3 className="zoho-widget-title">Contact Details</h3>
              <div className="divide-y divide-gray-50">
                <InfoRow icon={<EnvelopeIcon className="w-4 h-4" />} label="Email" value={lead.email} href={lead.email && `mailto:${lead.email}`} />
                <InfoRow icon={<PhoneIcon className="w-4 h-4" />} label="Phone" value={lead.phone} href={lead.phone && `tel:${lead.phone}`} />
                <InfoRow icon={<DevicePhoneMobileIcon className="w-4 h-4" />} label="Mobile" value={lead.mobile} href={lead.mobile && `tel:${lead.mobile}`} />
                <InfoRow icon={<BuildingOffice2Icon className="w-4 h-4" />} label="Company" value={lead.company} />
                <InfoRow icon={<TagIcon className="w-4 h-4" />} label="Lead Source" value={lead.source} />
              </div>
            </div>
          </>
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
                  { name: 'salutation', label: 'Salutation', render: (d, set) => select(SALUTATIONS, null, null)(d, set, 'salutation') },
                  { name: 'first_name', label: 'First Name' },
                  { name: 'last_name', label: 'Last Name', required: true },
                  { name: 'company', label: 'Company', required: true },
                  { name: 'title', label: 'Job Title' },
                  { name: 'lead_status', label: 'Lead Status', format: () => lead.status, render: (d, set) => select(statusOptions)(d, set, 'lead_status') },
                  { name: 'source', label: 'Lead Source', render: (d, set) => select(LEAD_SOURCES, null, null)(d, set, 'source') },
                  { name: 'industry', label: 'Industry', render: (d, set) => select(INDUSTRIES, null, null)(d, set, 'industry') },
                  { name: 'rating', label: 'Rating', render: (d, set) => select(RATINGS, null, null)(d, set, 'rating') },
                  { name: 'annual_revenue', label: 'Annual Revenue' },
                  { name: 'no_of_employees', label: 'No. of Employees' },
                  { name: 'website', label: 'Website' },
                  { name: 'owner_name', label: 'Owner', format: () => lead.owner_name },
                ]}
              />
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
                  { name: 'street', label: 'Street', colSpan: true },
                  { name: 'city', label: 'City' },
                  { name: 'state', label: 'State' },
                  { name: 'zip_code', label: 'Zip Code' },
                  { name: 'country', label: 'Country' },
                ]}
              />
              <EditableFieldSection
                title="Description"
                canEdit={editable}
                saving={saving}
                values={lead}
                onSave={saveSection}
                fields={[
                  { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
                    <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
                  ) },
                ]}
              />
              {lead.is_converted && (
                <div className="card p-4 bg-green-50 border border-green-200 text-sm text-green-800">
                  This lead was converted{lead.converted_at ? ` on ${new Date(lead.converted_at).toLocaleString()}` : ''}.
                </div>
              )}
        </div>
      </RecordDetailLayout>

      <ConfirmDialog open={deleteConfirm} message={`Delete ${lead.first_name} ${lead.last_name}?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => {
          try { await leadsApi.deleteLead(id); router.push('/leads'); showToast('Lead deleted', 'success'); }
          catch (err) { showToast(getApiError(err)); }
        }} onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
