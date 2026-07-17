'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout from '../../../components/records/RecordDetailLayout.js';
import RecordDetailSkeleton from '../../../components/records/RecordDetailSkeleton.js';
import EditableFieldSection from '../../../components/records/EditableFieldSection.js';
import EditableEmailField from '../../../components/forms/EditableEmailField.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { useMarkRecordViewed } from '../../../hooks/useMarkRecordViewed.js';
import { getApiError } from '../../../lib/api.js';
import api from '../../../lib/api.js';
import { validateEmailUnique } from '../../../lib/emailHelpers.js';
import * as contactsApi from '../../../lib/services/contacts.js';
import * as dealsApi from '../../../lib/services/deals.js';
import { fetchAccountLookups, accountMapFromLookups, fetchDealStages } from '../../../lib/services/lookups.js';
import { LEAD_SOURCES } from '../../../lib/constants.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';
import PhoneDisplay from '../../../components/cloudtalk/PhoneDisplay.js';
import CallRecordButton from '../../../components/cloudtalk/CallRecordButton.js';
import AccountNameCombobox from '../../../components/forms/AccountNameCombobox.js';
import { resolveContactAccountId } from '../../../lib/resolveContactAccount.js';
import { TrashIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { FALLBACK_DEAL_STAGES } from '../../../lib/dealHelpers.js';
import { tableLinkClass } from '../../../lib/tableStyles.js';
import { useAuth } from '../../../hooks/useAuth.js';

function toHref(raw, kind) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (kind === 'twitter') {
    const handle = value.replace(/^@/, '');
    return `https://twitter.com/${encodeURIComponent(handle)}`;
  }
  if (kind === 'linkedin') {
    if (value.includes('linkedin.com')) return `https://${value.replace(/^\/+/, '')}`;
    return `https://www.linkedin.com/in/${encodeURIComponent(value.replace(/^@/, ''))}`;
  }
  return `https://${value.replace(/^\/+/, '')}`;
}

function formatExternalLink(raw, kind) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const href = toHref(value, kind);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={tableLinkClass}>
      {kind === 'twitter' && !value.startsWith('http') ? `@${value.replace(/^@/, '')}` : value}
    </a>
  );
}

export default function ContactDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { canEdit, canDelete } = usePermissions();
  const [contact, setContact] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [stageOptions, setStageOptions] = useState(FALLBACK_DEAL_STAGES);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const convertRef = useRef(null);

  useMarkRecordViewed('contact', id);

  const loadContact = useCallback(() => {
    const map = accountMapFromLookups(accounts);
    contactsApi.getContact(id, map).then((r) => {
      setContact(r);
      trackRecentItem({ type: 'contact', id, name: `${r.first_name} ${r.last_name}` });
    }).catch((err) => {
      showToast(getApiError(err) || 'Contact not found');
      router.push('/contacts');
    });
  }, [id, accounts, router, showToast]);

  useEffect(() => {
    fetchAccountLookups().then(setAccounts).catch(() => {});
    fetchDealStages().then(setStageOptions).catch(() => setStageOptions(FALLBACK_DEAL_STAGES));
  }, []);

  useEffect(() => { if (accounts.length >= 0) loadContact(); }, [loadContact, accounts]);

  useEffect(() => {
    const map = accountMapFromLookups(accounts);
    dealsApi.listAllDeals({}, map, stageOptions)
      .then((result) => setDeals((result.data || []).filter((d) => String(d.contact_id) === String(id))))
      .catch(() => setDeals([]));
  }, [id, accounts, stageOptions]);

  const saveSection = async (payload) => {
    if (payload.email) {
      const uniqueErr = await validateEmailUnique(payload.email, { excludeContactId: id });
      if (uniqueErr) {
        showToast(uniqueErr);
        throw new Error(uniqueErr);
      }
    }
    setSaving(true);
    try {
      const next = { ...payload };
      if (Object.prototype.hasOwnProperty.call(payload, 'account_id')
        || Object.prototype.hasOwnProperty.call(payload, 'account_name')) {
        const accountId = await resolveContactAccountId({
          account_id: payload.account_id,
          account_name: payload.account_name || contact?.account_name,
          accounts,
          phone: contact?.phone,
          mobile: contact?.mobile,
          owner_id: contact?.owner_id || user?.id,
        });
        next.account_id = accountId;
        delete next.account_name;
        // Refresh lookups so new accounts appear next edit
        fetchAccountLookups().then(setAccounts).catch(() => {});
      }
      await contactsApi.updateContact(id, next);
      loadContact();
      showToast('Contact updated', 'success');
    } catch (err) {
      showToast(getApiError(err) || err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!convertOpen) return;
    const handler = (e) => { if (convertRef.current && !convertRef.current.contains(e.target)) setConvertOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [convertOpen]);

  const CONVERT_OPTIONS = [
    { label: 'Raw Lead',        endpoint: 'convert-to-raw-lead',       path: '/raw-leads' },
    { label: 'Lead',            endpoint: 'convert-to-lead',           path: '/leads' },
    { label: 'Qualified Lead',  endpoint: 'convert-to-qualified-lead', path: '/qualified-leads' },
    { label: 'Proposal',        endpoint: 'convert-to-proposal',       path: '/proposals' },
    { label: 'Account',         endpoint: 'convert-to-account',        path: '/accounts' },
  ];

  const handleConvertTo = async (option) => {
    setConvertOpen(false);
    setConverting(true);
    try {
      const res = await api.post(`/contacts/${id}/${option.endpoint}`);
      const record = res.data?.data;
      showToast(`Converted to ${option.label}`, 'success');
      const newId = record?.id;
      router.push(newId ? `${option.path}/${newId}` : option.path);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setConverting(false);
    }
  };

  if (!contact) return <CRMLayout><RecordDetailSkeleton /></CRMLayout>;

  return (
    <CRMLayout>
      <RecordDetailLayout
        backHref="/contacts" backLabel="Contacts"
        title={`${contact.first_name} ${contact.last_name}`}
        subtitle={contact.title ? `${contact.title}${contact.account_name ? ` at ${contact.account_name}` : ''}` : contact.account_name}
        avatarLabel={`${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`}
        lastUpdated={contact.updated_at ? new Date(contact.updated_at).toLocaleString() : undefined}
        recordNotes={{ relatedType: 'contact', recordId: id, canEdit }}
        recordActivities={{ entityType: 'contact', recordId: id }}
        recordHistory={{ entityType: 'contact', recordId: id }}
        actions={
          <div className="flex items-center gap-2">
            <CallRecordButton phone={contact.phone} mobile={contact.mobile} label="Call Contact" />
            {canEdit && (
              <div className="relative" ref={convertRef}>
                <button
                  onClick={() => setConvertOpen((o) => !o)}
                  disabled={converting}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  {converting ? 'Converting…' : 'Convert'}
                  <ChevronDownIcon className="w-3.5 h-3.5" />
                </button>
                {convertOpen && (
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-zoho-border rounded-lg shadow-lg z-50 py-1">
                    {CONVERT_OPTIONS.map((opt) => (
                      <button
                        key={opt.endpoint}
                        onClick={() => handleConvertTo(opt)}
                        className="w-full text-left px-3 py-2 text-xs text-zoho-text hover:bg-gray-50 transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {canDelete && (
              <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5">
                <TrashIcon className="w-4 h-4" /> Delete
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <EditableFieldSection
            title="Contact Information"
            canEdit={canEdit}
            saving={saving}
            values={contact}
            onSave={saveSection}
            fields={[
              { name: 'salutation', label: 'Salutation' },
              { name: 'first_name', label: 'First Name' },
              { name: 'last_name', label: 'Last Name', required: true },
              { name: 'account_id', label: 'Account', format: () => contact.account_name, render: (d, set) => (
                <AccountNameCombobox
                  options={accounts}
                  valueId={d.account_id ?? ''}
                  valueLabel={
                    d.account_name
                    || accounts.find((a) => String(a.value) === String(d.account_id))?.label
                    || contact.account_name
                    || ''
                  }
                  onChange={({ account_id, account_name }) => {
                    set((p) => ({ ...p, account_id, account_name }));
                  }}
                />
              ) },
              { name: 'title', label: 'Designation' },
              { name: 'department', label: 'Department' },
              { name: 'lead_source', label: 'Lead Source', render: (d, set) => (
                <select className="input" value={d.lead_source ?? ''} onChange={(e) => set((p) => ({ ...p, lead_source: e.target.value }))}>
                  <option value="">--None--</option>
                  {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) },
              { name: 'owner_name', label: 'Owner', readOnly: true, format: () => contact.owner_name },
            ]}
          />
          <EditableFieldSection
            title="Contact Details"
            canEdit={canEdit}
            saving={saving}
            values={contact}
            onSave={saveSection}
            fields={[
              { name: 'email', label: 'Email', render: (d, set) => (
                <EditableEmailField
                  value={d.email}
                  onChange={(e) => set((p) => ({ ...p, email: e.target.value }))}
                  excludeContactId={id}
                />
              ) },
              { name: 'secondary_email', label: 'Secondary Email' },
              { name: 'phone', label: 'Phone', format: (v) => <PhoneDisplay value={v} label="Call phone" /> },
              { name: 'other_phone', label: 'Other Phone', format: (v) => <PhoneDisplay value={v} label="Call other phone" /> },
              { name: 'mobile', label: 'Mobile', format: (v) => <PhoneDisplay value={v} label="Call mobile" /> },
              { name: 'home_phone', label: 'Home Phone', format: (v) => <PhoneDisplay value={v} label="Call home phone" /> },
              { name: 'fax', label: 'Fax' },
              { name: 'assistant', label: 'Assistant' },
              { name: 'asst_phone', label: 'Asst Phone', format: (v) => <PhoneDisplay value={v} label="Call assistant phone" /> },
              { name: 'website', label: 'Website', format: (v) => formatExternalLink(v), render: (d, set) => (
                <input className="input" type="url" placeholder="https://" value={d.website ?? ''} onChange={(e) => set((p) => ({ ...p, website: e.target.value }))} />
              ) },
              { name: 'skype_id', label: 'LinkedIn', format: (v) => formatExternalLink(v, 'linkedin'), render: (d, set) => (
                <input className="input" type="url" placeholder="https://linkedin.com/in/…" value={d.skype_id ?? ''} onChange={(e) => set((p) => ({ ...p, skype_id: e.target.value }))} />
              ) },
              { name: 'twitter', label: 'Twitter', format: (v) => formatExternalLink(v, 'twitter'), render: (d, set) => (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-zoho-muted">@</span>
                  <input className="input flex-1" placeholder="handle" value={d.twitter ?? ''} onChange={(e) => set((p) => ({ ...p, twitter: e.target.value }))} />
                </div>
              ) },
              { name: 'date_of_birth', label: 'Date of Birth', render: (d, set) => (
                <input className="input" type="date" value={(d.date_of_birth ?? '').slice(0, 10)} onChange={(e) => set((p) => ({ ...p, date_of_birth: e.target.value }))} />
              ) },
              { name: 'email_opt_out', label: 'Email Opt Out', format: (v) => (v ? 'Yes' : 'No'), render: (d, set) => (
                <input type="checkbox" className="w-4 h-4" checked={!!d.email_opt_out} onChange={(e) => set((p) => ({ ...p, email_opt_out: e.target.checked }))} />
              ) },
            ]}
          />
          <EditableFieldSection
            title="Mailing Address"
            canEdit={canEdit}
            saving={saving}
            values={contact}
            onSave={saveSection}
            fields={[
              { name: 'mailing_street', label: 'Street' },
              { name: 'mailing_city', label: 'City' },
              { name: 'mailing_state', label: 'State' },
              { name: 'mailing_zip', label: 'Zip' },
              { name: 'mailing_country', label: 'Country' },
            ]}
          />
          <EditableFieldSection
            title="Other Address"
            canEdit={canEdit}
            saving={saving}
            values={contact}
            onSave={saveSection}
            fields={[
              { name: 'other_street', label: 'Street' },
              { name: 'other_city', label: 'City' },
              { name: 'other_state', label: 'State' },
              { name: 'other_zip', label: 'Zip' },
              { name: 'other_country', label: 'Country' },
            ]}
          />
          <EditableFieldSection
            title="Description"
            canEdit={canEdit}
            saving={saving}
            values={contact}
            onSave={saveSection}
            fields={[
              { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
                <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
              ) },
            ]}
          />

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-zoho-text mb-3">Related Deals</h3>
            {deals.length === 0 ? (
              <p className="text-sm text-zoho-muted">No deals linked to this contact.</p>
            ) : (
              <ul className="divide-y divide-zoho-border">
                {deals.map((deal) => (
                  <li key={deal.id} className="py-2 flex items-center justify-between gap-3">
                    <Link href={`/deals/${deal.id}`} className={`text-sm font-medium ${tableLinkClass}`}>
                      {deal.name || deal.deal_name}
                    </Link>
                    <span className="text-xs text-zoho-muted">{formatMoney(deal.amount, deal.currency)} · {deal.stage}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </RecordDetailLayout>

      <ConfirmDialog open={deleteConfirm} message={`Delete ${contact.first_name} ${contact.last_name}?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => {
          try { await contactsApi.deleteContact(id); router.push('/contacts'); showToast('Contact deleted', 'success'); }
          catch (err) { showToast(getApiError(err)); }
        }} onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
