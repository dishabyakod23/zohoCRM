'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import Modal from '../../../components/ui/Modal.js';
import Badge from '../../../components/ui/Badge.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout, { InfoRow } from '../../../components/records/RecordDetailLayout.js';
import EditableFieldSection from '../../../components/records/EditableFieldSection.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { getApiError } from '../../../lib/api.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';
import * as leadsApi from '../../../lib/services/leads.js';
import { fetchLeadStatuses, FALLBACK_LEAD_STATUSES } from '../../../lib/services/lookups.js';
import { fetchDealStages } from '../../../lib/services/lookups.js';
import { FALLBACK_DEAL_STAGES } from '../../../lib/dealHelpers.js';
import { LEAD_SOURCES, SALUTATIONS, RATINGS } from '../../../lib/constants.js';
import {
  EnvelopeIcon, PhoneIcon, DevicePhoneMobileIcon, BuildingOffice2Icon, TagIcon, TrashIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';

const INDUSTRIES = ['IT Services', 'E-Commerce', 'EdTech', 'Automotive', 'Finance', 'Healthcare', 'Manufacturing', 'Education', 'Media', 'Real Estate', 'Other'];

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [lead, setLead] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [statusOptions, setStatusOptions] = useState(FALLBACK_LEAD_STATUSES);
  const [stageOptions, setStageOptions] = useState(FALLBACK_DEAL_STAGES);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertConfirm, setConvertConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [convertForm, setConvertForm] = useState({
    create_deal: false, deal_name: '', close_date: '', stage_value: 'qualification', amount: '',
  });

  useEffect(() => {
    fetchLeadStatuses().then(setStatusOptions).catch(() => setStatusOptions(FALLBACK_LEAD_STATUSES));
    fetchDealStages().then(setStageOptions).catch(() => setStageOptions(FALLBACK_DEAL_STAGES));
  }, []);

  const loadLead = useCallback(() => {
    leadsApi.getLead(id).then((r) => {
      setLead(r);
      trackRecentItem({ type: 'lead', id, name: `${r.first_name} ${r.last_name}` });
    }).catch(() => {
      showToast('Lead not found');
      router.push('/leads');
    });
  }, [id, router, showToast]);

  useEffect(() => {
    loadLead();
    leadsApi.listLeadNotes(id).then(setNotes).catch(() => setNotes([]));
  }, [id, loadLead]);

  const saveSection = async (payload) => {
    setSaving(true);
    try {
      await leadsApi.updateLead(id, payload);
      loadLead();
      showToast('Lead updated', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async () => {
    try {
      const result = await leadsApi.convertLead(id, convertForm);
      showToast('Lead converted successfully', 'success');
      setConvertOpen(false);
      if (result.deal?.id) router.push(`/deals/${result.deal.id}`);
      else if (result.account?.id) router.push(`/accounts/${result.account.id}`);
      else loadLead();
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      const note = await leadsApi.createLeadNote(id, noteText.trim());
      setNotes((n) => [note, ...n]);
      setNoteText('');
    } catch (err) {
      showToast(getApiError(err));
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
        tabs={['Overview', 'Notes']}
        actions={
          <>
            {editable && !lead.is_converted && (
              <button onClick={() => setConvertConfirm(true)} className="btn-primary text-xs flex items-center gap-1.5">
                <ArrowPathIcon className="w-4 h-4" /> Convert
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
        tabContent={(tab) => {
          if (tab === 'Overview') return (
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
                  { name: 'email', label: 'Email' },
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
          );
          if (tab === 'Notes') return (
            <div className="card p-5">
              {canEdit && (
              <div className="flex gap-2 mb-4">
                <input className="input flex-1" placeholder="Add a note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <button onClick={addNote} className="btn-primary text-xs">Add Note</button>
              </div>
              )}
              <div className="space-y-2">
                {notes.length === 0 ? <p className="text-sm text-zoho-muted">No notes yet</p> : notes.map((n) => (
                  <div key={n.id} className="text-sm bg-brand-50/60 border border-zoho-border/60 p-3 rounded-xl">{n.body}</div>
                ))}
              </div>
            </div>
          );
          return null;
        }}
      />

      <ConfirmDialog open={convertConfirm} message={`Convert ${lead.first_name} ${lead.last_name} into Account, Contact, and optional Deal?`} confirmLabel="Yes, Convert"
        onConfirm={() => { setConvertConfirm(false); setConvertOpen(true); }} onCancel={() => setConvertConfirm(false)} />
      <ConfirmDialog open={deleteConfirm} message={`Delete ${lead.first_name} ${lead.last_name}?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => {
          try { await leadsApi.deleteLead(id); router.push('/leads'); showToast('Lead deleted', 'success'); }
          catch (err) { showToast(getApiError(err)); }
        }} onCancel={() => setDeleteConfirm(false)} />

      {convertOpen && (
        <Modal title="Convert Lead" onClose={() => setConvertOpen(false)}>
          <div className="space-y-3">
            <p className="text-sm text-zoho-muted">Account and Contact will be created from lead data.</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={convertForm.create_deal} onChange={(e) => setConvertForm((f) => ({ ...f, create_deal: e.target.checked }))} />
              Create a new Deal for this Account
            </label>
            {convertForm.create_deal && (
              <>
                <input className="input" placeholder="Deal name" value={convertForm.deal_name} onChange={(e) => setConvertForm((f) => ({ ...f, deal_name: e.target.value }))} />
                <input className="input" type="number" placeholder="Amount" value={convertForm.amount} onChange={(e) => setConvertForm((f) => ({ ...f, amount: e.target.value }))} />
                <input className="input" type="date" value={convertForm.close_date} onChange={(e) => setConvertForm((f) => ({ ...f, close_date: e.target.value }))} />
                <select className="input" value={convertForm.stage_value} onChange={(e) => setConvertForm((f) => ({ ...f, stage_value: e.target.value }))}>
                  {stageOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConvertOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleConvert} className="btn-primary">Convert</button>
            </div>
          </div>
        </Modal>
      )}
    </CRMLayout>
  );
}
