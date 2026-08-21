'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRecordId, isValidRecordId } from '../../../hooks/useRecordId.js';
import { useRecordIdGuard } from '../../../hooks/useRecordIdGuard.js';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import Badge from '../../../components/ui/Badge.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout, { InfoRow } from '../../../components/records/RecordDetailLayout.js';
import RecordDetailSkeleton from '../../../components/records/RecordDetailSkeleton.js';
import EditableFieldSection from '../../../components/records/EditableFieldSection.js';
import EditableEmailField from '../../../components/forms/EditableEmailField.js';
import LeadConvertMenu from '../../../components/leads/LeadConvertMenu.js';
import ReadOnlyRecordBanner from '../../../components/records/ReadOnlyRecordBanner.js';
import CallRecordButton from '../../../components/cloudtalk/CallRecordButton.js';
import { displayPhoneWithoutAutoDetect, normalizePhoneForDial } from '../../../lib/cloudTalkHelpers.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { useMarkRecordViewed } from '../../../hooks/useMarkRecordViewed.js';
import { getApiError } from '../../../lib/api.js';
import { validateEmailUnique } from '../../../lib/emailHelpers.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';
import * as leadsApi from '../../../lib/services/leads.js';
import { fetchLeadStatuses, fetchLeadSources, FALLBACK_LEAD_STATUSES, fetchUsers } from '../../../lib/services/lookups.js';
import { ownerFieldConfig } from '../../../components/forms/ownerField.js';
import { SALUTATIONS, RATINGS } from '../../../lib/constants.js';
import { IndustrySelectControl } from '../../../components/forms/IndustryField.js';
import {
  AddressCountrySelect,
  AddressStateSelect,
} from '../../../components/forms/AddressCountryStateFields.js';
import { nextStateForCountry } from '../../../lib/addressRegions.js';
import { PIPELINE_LEAD, outreachLeadStatusOptions } from '../../../lib/pipelineHelpers.js';
import {
  EnvelopeIcon, PhoneIcon, DevicePhoneMobileIcon, BuildingOffice2Icon, TagIcon, TrashIcon,
} from '@heroicons/react/24/outline';

export default function LeadDetailPage() {
  const id = useRecordId();
  const ready = useRecordIdGuard(id, { fallbackPath: '/leads', message: 'Lead not found' });
  const router = useRouter();
  const { showToast } = useToast();
  const { canEditRecord, canDeleteRecord, isSuperAdmin, canAssignLeads } = usePermissions();
  const [lead, setLead] = useState(null);
  const [users, setUsers] = useState([]);
  const [statusOptions, setStatusOptions] = useState(() => outreachLeadStatusOptions(FALLBACK_LEAD_STATUSES));
  const [sourceOptions, setSourceOptions] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useMarkRecordViewed('lead', id);

  useEffect(() => {
    fetchLeadStatuses()
      .then((options) => setStatusOptions(outreachLeadStatusOptions(options)))
      .catch(() => setStatusOptions(outreachLeadStatusOptions(FALLBACK_LEAD_STATUSES)));
    fetchLeadSources().then(setSourceOptions).catch(() => setSourceOptions([]));
    if (canAssignLeads) fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, [canAssignLeads]);

  const loadLead = useCallback(() => {
    if (!ready || !isValidRecordId(id)) return;
    leadsApi.getLead(id).then((r) => {
      setLead(r);
      trackRecentItem({ type: 'lead', id, name: `${r.first_name} ${r.last_name}`, lead: r });
    }).catch(() => {
      showToast('Lead not found');
      router.push('/leads');
    });
  }, [id, ready, router, showToast]);

  useEffect(() => {
    if (!ready || !isValidRecordId(id)) return;
    loadLead();
  }, [id, ready, loadLead]);

  const saveSection = async (payload) => {
    // Guard set synchronously (before any await) so a rapid double-click or a slow
    // in-flight email-uniqueness check can't start a second, concurrent submission.
    if (savingRef.current) throw new Error('Save already in progress');
    savingRef.current = true;
    setSaving(true);
    try {
      if (payload.email) {
        const uniqueErr = await validateEmailUnique(payload.email, { excludeLeadId: id });
        if (uniqueErr) throw new Error(uniqueErr);
      }
      await leadsApi.updateLead(id, payload);
      loadLead();
      showToast('Lead updated', 'success');
    } catch (err) {
      showToast(getApiError(err));
      throw err;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (!ready || !lead) return <CRMLayout><RecordDetailSkeleton /></CRMLayout>;

  const editable = canEditRecord(lead) && !lead.is_converted;
  const deletable = canDeleteRecord(lead);
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
      <ReadOnlyRecordBanner show={!editable && !lead.is_converted} />
      <RecordDetailLayout
        backHref="/leads" backLabel="Warm Leads"
        title={`${lead.first_name} ${lead.last_name}`}
        subtitle={lead.company}
        badges={<Badge label={lead.status} />}
        lastUpdated={new Date(lead.updated_at).toLocaleString()}
        recordNotes={{ relatedType: 'lead', recordId: id, canEdit: editable }}
        recordHistory={{ entityType: 'lead', recordId: id }}
        actions={
          <>
            <CallRecordButton phone={lead.phone} mobile={lead.mobile} label="Call Lead" />
            <LeadConvertMenu
              stage={PIPELINE_LEAD}
              leadId={id}
              leadName={`${lead.first_name} ${lead.last_name}`}
              canEdit={editable}
              isAdmin={isSuperAdmin}
              isConverted={lead.is_converted}
            />
            {deletable && (
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
                <InfoRow icon={<PhoneIcon className="w-4 h-4" />} label="Phone" value={lead.phone && displayPhoneWithoutAutoDetect(normalizePhoneForDial(lead.phone))} href={lead.phone && `tel:${lead.phone}`} />
                <InfoRow icon={<DevicePhoneMobileIcon className="w-4 h-4" />} label="Mobile" value={lead.mobile && displayPhoneWithoutAutoDetect(normalizePhoneForDial(lead.mobile))} href={lead.mobile && `tel:${lead.mobile}`} />
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
                  { name: 'first_name', label: 'First Name', required: true },
                  { name: 'last_name', label: 'Last Name', required: true },
                  { name: 'company', label: 'Company', required: true },
                  { name: 'title', label: 'Job Title' },
                  { name: 'lead_status', label: 'Lead Status', format: () => lead.status, render: (d, set) => select(statusOptions)(d, set, 'lead_status') },
                  { name: 'source', label: 'Lead Source', render: (d, set) => select(sourceOptions)(d, set, 'source') },
                  { name: 'industry', label: 'Industry', render: (d, set) => (
                    <IndustrySelectControl
                      value={d.industry ?? ''}
                      onChange={(industry) => set((p) => ({ ...p, industry }))}
                    />
                  ) },
                  { name: 'rating', label: 'Rating', render: (d, set) => select(RATINGS, null, null)(d, set, 'rating') },
                  { name: 'annual_revenue', label: 'Annual Revenue' },
                  { name: 'no_of_employees', label: 'No. of Employees' },
                  { name: 'website', label: 'Website' },
                  ownerFieldConfig({ users, canAssign: canAssignLeads, ownerName: lead.owner_name }),
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
                  { name: 'zip_code', label: 'Zip Code' },
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
