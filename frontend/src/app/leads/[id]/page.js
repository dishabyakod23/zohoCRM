'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import Modal from '../../../components/ui/Modal.js';
import Badge from '../../../components/ui/Badge.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout, { InfoRow, FieldSection } from '../../../components/records/RecordDetailLayout.js';
import { useToast } from '../../../components/ui/Toast.js';
import { getApiError } from '../../../lib/api.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';
import * as leadsApi from '../../../lib/services/leads.js';
import { fetchDealStages } from '../../../lib/services/lookups.js';
import { FALLBACK_DEAL_STAGES } from '../../../lib/dealHelpers.js';
import {
  EnvelopeIcon, PhoneIcon, DevicePhoneMobileIcon, BuildingOffice2Icon, TagIcon, TrashIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [lead, setLead] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [stageOptions, setStageOptions] = useState(FALLBACK_DEAL_STAGES);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertConfirm, setConvertConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [convertForm, setConvertForm] = useState({
    create_deal: false, deal_name: '', close_date: '', stage_value: 'qualification', amount: '',
  });

  useEffect(() => {
    fetchDealStages().then(setStageOptions).catch(() => setStageOptions(FALLBACK_DEAL_STAGES));
  }, []);

  const loadLead = () => {
    leadsApi.getLead(id).then(r => {
      setLead(r);
      trackRecentItem({ type: 'lead', id, name: `${r.first_name} ${r.last_name}` });
    }).catch(() => {
      showToast('Lead not found');
      router.push('/leads');
    });
  };

  useEffect(() => {
    loadLead();
    leadsApi.listLeadNotes(id).then(setNotes).catch(() => setNotes([]));
  }, [id, router, showToast]);

  const handleConvert = async () => {
    try {
      const result = await leadsApi.convertLead(id, convertForm);
      showToast('Lead converted successfully', 'success');
      setConvertOpen(false);
      if (result.deal_id) router.push('/deals');
      else if (result.account_id) router.push(`/accounts/${result.account_id}`);
      else loadLead();
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      const note = await leadsApi.createLeadNote(id, noteText.trim());
      setNotes(n => [note, ...n]);
      setNoteText('');
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  if (!lead) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

  const leadInfoFields = [
    ['Lead Owner', lead.owner_name], ['Lead Source', lead.source], ['Industry', lead.industry], ['Title', lead.title],
    ['Rating', lead.rating], ['Annual Revenue', lead.annual_revenue],
  ];
  const contactFields = [
    ['Email', lead.email], ['Phone', lead.phone], ['Mobile', lead.mobile], ['Website', lead.website],
  ];
  const addressFields = [
    ['Street', lead.street], ['City', lead.city], ['State', lead.state], ['Country', lead.country], ['Zip', lead.zip_code],
  ];

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
            {!lead.is_converted && (
              <button onClick={() => setConvertConfirm(true)} className="btn-primary text-xs flex items-center gap-1.5">
                <ArrowPathIcon className="w-4 h-4" /> Convert
              </button>
            )}
            <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5">
              <TrashIcon className="w-4 h-4" /> Delete
            </button>
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
            {!lead.is_converted && (
              <div className="card p-4 bg-brand-gradient text-white">
                <h3 className="text-xs font-bold uppercase tracking-wide mb-2 text-white/80">Ready to move forward?</h3>
                <p className="text-sm mb-3 text-white/90">Convert this lead into an Account, Contact and optional Deal.</p>
                <button onClick={() => setConvertConfirm(true)} className="w-full bg-white text-brand-700 rounded-lg py-1.5 text-sm font-semibold hover:bg-white/90">
                  Convert Lead
                </button>
              </div>
            )}
          </>
        }
        tabContent={(tab) => {
          if (tab === 'Overview') return (
            <div className="space-y-4">
              <FieldSection title="Lead Information" fields={leadInfoFields} />
              <FieldSection title="Contact Information" fields={contactFields} />
              <FieldSection title="Address Information" fields={addressFields} />
              {lead.description && (
                <div className="card p-5">
                  <h3 className="text-xs font-bold text-brand-700/80 uppercase tracking-wide mb-2">Description</h3>
                  <p className="text-sm text-zoho-text">{lead.description}</p>
                </div>
              )}
              {lead.is_converted && (
                <div className="card p-4 bg-green-50 border border-green-200 text-sm text-green-800">
                  This lead was converted{lead.converted_at ? ` on ${new Date(lead.converted_at).toLocaleString()}` : ''}.
                </div>
              )}
            </div>
          );
          if (tab === 'Notes') return (
            <div className="card p-5">
              <div className="flex gap-2 mb-4">
                <input className="input flex-1" placeholder="Add a note..." value={noteText} onChange={e => setNoteText(e.target.value)} />
                <button onClick={addNote} className="btn-primary text-xs">Add Note</button>
              </div>
              <div className="space-y-2">
                {notes.length === 0 ? <p className="text-sm text-zoho-muted">No notes yet</p> : notes.map(n => (
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
          try { await leadsApi.deleteLead(id); router.push('/leads'); }
          catch (err) { showToast(getApiError(err)); }
        }} onCancel={() => setDeleteConfirm(false)} />

      {convertOpen && (
        <Modal title="Convert Lead" onClose={() => setConvertOpen(false)}>
          <div className="space-y-3">
            <p className="text-sm text-zoho-muted">Account and Contact will be created from lead data.</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={convertForm.create_deal} onChange={e => setConvertForm(f => ({ ...f, create_deal: e.target.checked }))} />
              Create a new Deal for this Account
            </label>
            {convertForm.create_deal && (
              <>
                <input className="input" placeholder="Deal name" value={convertForm.deal_name} onChange={e => setConvertForm(f => ({ ...f, deal_name: e.target.value }))} />
                <input className="input" type="number" placeholder="Amount" value={convertForm.amount} onChange={e => setConvertForm(f => ({ ...f, amount: e.target.value }))} />
                <input className="input" type="date" value={convertForm.close_date} onChange={e => setConvertForm(f => ({ ...f, close_date: e.target.value }))} />
                <select className="input" value={convertForm.stage_value} onChange={e => setConvertForm(f => ({ ...f, stage_value: e.target.value }))}>
                  {stageOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
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
