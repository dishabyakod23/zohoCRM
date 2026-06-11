'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import Modal from '../../../components/ui/Modal.js';
import Badge from '../../../components/ui/Badge.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout, { InfoRow, FieldSection } from '../../../components/records/RecordDetailLayout.js';
import { useToast } from '../../../components/ui/Toast.js';
import api from '../../../lib/api.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';
import { DEAL_STAGES } from '../../../lib/constants.js';
import {
  EnvelopeIcon, PhoneIcon, DevicePhoneMobileIcon, BuildingOffice2Icon,
  GlobeAltIcon, TagIcon, BriefcaseIcon, MapPinIcon, ArrowPathIcon, TrashIcon,
} from '@heroicons/react/24/outline';

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [lead, setLead] = useState(null);
  const [notes, setNotes] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertConfirm, setConvertConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [convertForm, setConvertForm] = useState({ create_deal: false, deal_name: '', close_date: '', stage: 'Qualification', amount: '' });

  useEffect(() => {
    api.get(`/leads/${id}`).then(r => {
      setLead(r.data);
      trackRecentItem({ type: 'lead', id, name: `${r.data.first_name} ${r.data.last_name}` });
    }).catch(() => router.push('/leads'));
    api.get('/notes', { params: { related_type: 'lead', related_id: id } }).then(r => setNotes(r.data));
    api.get(`/leads/${id}/audit`).then(r => setTimeline(r.data)).catch(() => setTimeline([]));
  }, [id, router]);

  const handleConvert = async () => {
    try {
      const res = await api.post(`/leads/${id}/convert`, convertForm);
      showToast('Lead converted successfully', 'success');
      setConvertOpen(false);
      if (res.data.deal) router.push(`/deals/${res.data.deal.id}`);
      else router.push(`/accounts/${res.data.account.id}`);
    } catch (err) { showToast(err.response?.data?.error || 'Conversion failed'); }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    const res = await api.post('/notes', { content: noteText, related_type: 'lead', related_id: id });
    setNotes(n => [res.data, ...n]); setNoteText('');
  };

  if (!lead) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

  const leadInfoFields = [
    ['Lead Owner', lead.owner_name], ['Lead Source', lead.source], ['Industry', lead.industry], ['Title', lead.title],
  ];
  const contactFields = [
    ['Email', lead.email], ['Phone', lead.phone], ['Mobile', lead.mobile], ['Website', lead.website],
  ];
  const addressFields = [
    ['City', lead.city], ['State', lead.state], ['Country', lead.country],
  ];

  return (
    <CRMLayout>
      <RecordDetailLayout
        backHref="/leads" backLabel="Leads"
        title={`${lead.first_name} ${lead.last_name}`}
        subtitle={lead.company}
        badges={<Badge label={lead.status} />}
        lastUpdated={new Date(lead.updated_at).toLocaleString()}
        tabs={['Overview', 'Timeline', 'Notes', 'Open Activities', 'Emails']}
        actions={
          <>
            {!lead.converted && (
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

            {!lead.converted && (
              <div className="card p-4 bg-brand-gradient text-white">
                <h3 className="text-xs font-bold uppercase tracking-wide mb-2 text-white/80">Ready to move forward?</h3>
                <p className="text-sm mb-3 text-white/90">Convert this lead into an Account, Contact and Deal.</p>
                <button onClick={() => setConvertConfirm(true)} className="w-full bg-white text-brand-700 rounded-lg py-1.5 text-sm font-semibold hover:bg-white/90 transition-colors shadow-soft">
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
            </div>
          );
          if (tab === 'Timeline') return (
            <div className="card p-5">
              {timeline.length === 0 ? <p className="text-sm text-zoho-muted">No timeline entries yet</p> : (
                <div className="space-y-4">{timeline.map(t => (
                  <div key={t.id} className="flex gap-3 text-sm relative pl-5">
                    <span className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-brand-gradient ring-4 ring-brand-100" />
                    <div className="border-l-2 border-brand-100 pl-4 -ml-[5px] pb-1">
                      <p className="font-medium text-zoho-text">{t.action}</p>
                      <p className="text-xs text-zoho-muted">{t.user_name} · {new Date(t.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}</div>
              )}
            </div>
          );
          if (tab === 'Notes') return (
            <div className="card p-5">
              <div className="flex gap-2 mb-4">
                <input className="input flex-1" placeholder="Add a note..." value={noteText} onChange={e => setNoteText(e.target.value)} />
                <button onClick={addNote} className="btn-primary text-xs">Add Note</button>
              </div>
              <div className="space-y-2">{notes.map(n => <div key={n.id} className="text-sm bg-brand-50/60 border border-zoho-border/60 p-3 rounded-xl">{n.content}</div>)}</div>
            </div>
          );
          return <div className="card p-8 text-center text-zoho-muted text-sm">{tab} — configure in Setup</div>;
        }}
      />

      <ConfirmDialog open={convertConfirm} message={`You are about to convert ${lead.first_name} ${lead.last_name} into an Account, Contact, and optionally a Deal. Proceed?`} confirmLabel="Yes, Convert" onConfirm={() => { setConvertConfirm(false); setConvertOpen(true); }} onCancel={() => setConvertConfirm(false)} />
      <ConfirmDialog open={deleteConfirm} message={`Are you sure you want to delete ${lead.first_name} ${lead.last_name}?`} confirmLabel="Confirm Delete" danger onConfirm={async () => { await api.delete(`/leads/${id}`); router.push('/leads'); }} onCancel={() => setDeleteConfirm(false)} />

      {convertOpen && (
        <Modal title="Convert Lead" onClose={() => setConvertOpen(false)}>
          <div className="space-y-3">
            <p className="text-sm text-zoho-muted">Account and Contact will be created from lead data.</p>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={convertForm.create_deal} onChange={e => setConvertForm(f => ({ ...f, create_deal: e.target.checked }))} /> Create a new Deal for this Account</label>
            {convertForm.create_deal && (
              <>
                <input className="input" placeholder="Deal name" value={convertForm.deal_name} onChange={e => setConvertForm(f => ({ ...f, deal_name: e.target.value }))} />
                <input className="input" type="date" value={convertForm.close_date} onChange={e => setConvertForm(f => ({ ...f, close_date: e.target.value }))} />
                <select className="input" value={convertForm.stage} onChange={e => setConvertForm(f => ({ ...f, stage: e.target.value }))}>{DEAL_STAGES.filter(s => !s.includes('Closed')).map(s => <option key={s}>{s}</option>)}</select>
              </>
            )}
            <div className="flex gap-2 justify-end"><button onClick={() => setConvertOpen(false)} className="btn-secondary">Cancel</button><button onClick={handleConvert} className="btn-primary">Convert</button></div>
          </div>
        </Modal>
      )}
    </CRMLayout>
  );
}
