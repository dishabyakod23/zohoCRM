'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout from '../../../components/records/RecordDetailLayout.js';
import EditableFieldSection from '../../../components/records/EditableFieldSection.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { useMarkRecordViewed } from '../../../hooks/useMarkRecordViewed.js';
import { getApiError } from '../../../lib/api.js';
import * as contactsApi from '../../../lib/services/contacts.js';
import { fetchAccountLookups, accountMapFromLookups } from '../../../lib/services/lookups.js';
import { LEAD_SOURCES } from '../../../lib/constants.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';
import { TrashIcon } from '@heroicons/react/24/outline';

export default function ContactDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [contact, setContact] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => { fetchAccountLookups().then(setAccounts).catch(() => {}); }, []);
  useEffect(() => { if (accounts.length >= 0) loadContact(); }, [loadContact, accounts]);

  const saveSection = async (payload) => {
    setSaving(true);
    try {
      await contactsApi.updateContact(id, payload);
      loadContact();
      showToast('Contact updated', 'success');
    } catch (err) {
      showToast(getApiError(err));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (!contact) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

  return (
    <CRMLayout>
      <RecordDetailLayout
        backHref="/contacts" backLabel="Contacts"
        title={`${contact.first_name} ${contact.last_name}`}
        subtitle={contact.title ? `${contact.title}${contact.account_name ? ` at ${contact.account_name}` : ''}` : contact.account_name}
        avatarLabel={`${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`}
        lastUpdated={contact.updated_at ? new Date(contact.updated_at).toLocaleString() : undefined}
        recordNotes={{ relatedType: 'contact', recordId: id, canEdit }}
        actions={canDelete && (
          <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5">
            <TrashIcon className="w-4 h-4" /> Delete
          </button>
        )}
      >
        <div className="space-y-4">
          <EditableFieldSection
            title="Contact Information"
            canEdit={canEdit}
            saving={saving}
            values={contact}
            onSave={saveSection}
            fields={[
              { name: 'first_name', label: 'First Name' },
              { name: 'last_name', label: 'Last Name', required: true },
              { name: 'account_id', label: 'Account', format: () => contact.account_name, render: (d, set) => (
                <select className="input" value={d.account_id ?? ''} onChange={(e) => set((p) => ({ ...p, account_id: e.target.value }))}>
                  <option value="">--None--</option>
                  {accounts.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              ) },
              { name: 'title', label: 'Job Title' },
              { name: 'department', label: 'Department' },
              { name: 'lead_source', label: 'Lead Source', render: (d, set) => (
                <select className="input" value={d.lead_source ?? ''} onChange={(e) => set((p) => ({ ...p, lead_source: e.target.value }))}>
                  <option value="">--None--</option>
                  {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) },
              { name: 'owner_name', label: 'Owner', format: () => contact.owner_name },
            ]}
          />
          <EditableFieldSection
            title="Contact Details"
            canEdit={canEdit}
            saving={saving}
            values={contact}
            onSave={saveSection}
            fields={[
              { name: 'email', label: 'Email' },
              { name: 'phone', label: 'Phone' },
              { name: 'mobile', label: 'Mobile' },
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
