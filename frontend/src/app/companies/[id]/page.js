'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRecordId } from '../../../hooks/useRecordId.js';
import { useRecordIdGuard } from '../../../hooks/useRecordIdGuard.js';
import RecordDetailLink from '../../../components/records/RecordDetailLink.js';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout from '../../../components/records/RecordDetailLayout.js';
import RecordDetailSkeleton from '../../../components/records/RecordDetailSkeleton.js';
import EditableFieldSection from '../../../components/records/EditableFieldSection.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { getApiError } from '../../../lib/api.js';
import * as companiesApi from '../../../lib/services/companies.js';
import * as contactsApi from '../../../lib/services/contacts.js';
import { fetchUsers } from '../../../lib/services/lookups.js';
import { ownerFieldConfig } from '../../../components/forms/ownerField.js';
import { DEFAULT_PAGE_SIZE } from '../../../lib/constants.js';
import { IndustrySelectControl } from '../../../components/forms/IndustryField.js';
import {
  AddressCountrySelect,
  AddressStateSelect,
} from '../../../components/forms/AddressCountryStateFields.js';
import { nextStateForCountry } from '../../../lib/addressRegions.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';
import { TrashIcon } from '@heroicons/react/24/outline';
import ReadOnlyRecordBanner from '../../../components/records/ReadOnlyRecordBanner.js';

export default function CompanyDetailPage() {
  const id = useRecordId();
  const ready = useRecordIdGuard(id, { fallbackPath: '/companies', message: 'Company not found' });
  const router = useRouter();
  const { showToast } = useToast();
  const { canEditRecord, canDeleteRecord, canAssignLeads } = usePermissions();
  const [company, setCompany] = useState(null);
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCompany = useCallback(async () => {
    if (!ready) return;
    try {
      const [record, contactResult] = await Promise.all([
        companiesApi.getCompany(id),
        contactsApi.listContacts({ company_id: id, page_size: DEFAULT_PAGE_SIZE }),
      ]);
      setCompany({ ...record, account_name: record.name || record.account_name });
      setContacts(contactResult.data || []);
      trackRecentItem({ type: 'company', id, name: record.name });
    } catch {
      showToast('Company not found');
      router.push('/companies');
    }
  }, [id, ready, router, showToast]);

  useEffect(() => { if (ready) loadCompany(); }, [ready, loadCompany]);

  useEffect(() => {
    if (canAssignLeads) fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, [canAssignLeads]);

  const saveSection = async (payload) => {
    setSaving(true);
    try {
      await companiesApi.updateCompany(id, payload);
      loadCompany();
      showToast('Company updated', 'success');
    } catch (err) {
      showToast(getApiError(err));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !company) return <CRMLayout><RecordDetailSkeleton /></CRMLayout>;

  const editable = canEditRecord(company);
  const deletable = canDeleteRecord(company);

  return (
    <CRMLayout>
      <ReadOnlyRecordBanner show={!editable} />
      <RecordDetailLayout
        backHref="/companies"
        backLabel="Companies"
        title={company.name}
        subtitle={company.industry || 'Company'}
        avatarLabel={company.name?.[0]}
        lastUpdated={company.updated_at ? new Date(company.updated_at).toLocaleString() : undefined}
        recordNotes={{ relatedType: 'company', recordId: id, canEdit: editable }}
        recordHistory={{ entityType: 'company', recordId: id }}
        actions={deletable && (
          <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5">
            <TrashIcon className="w-4 h-4" /> Delete
          </button>
        )}
      >
        <div className="space-y-4">
          <EditableFieldSection
            title="Company Information"
            canEdit={editable}
            saving={saving}
            values={company}
            onSave={saveSection}
            fields={[
              { name: 'company_name', label: 'Company Name', required: true },
              { name: 'phone', label: 'Phone' },
              { name: 'website', label: 'Website' },
              { name: 'industry', label: 'Industry', render: (d, set) => (
                <IndustrySelectControl
                  value={d.industry ?? ''}
                  onChange={(industry) => set((p) => ({ ...p, industry }))}
                />
              ) },
              ownerFieldConfig({ users, canAssign: canAssignLeads, ownerName: company.owner_name }),
            ]}
          />

          <EditableFieldSection
            title="Address Information"
            canEdit={editable}
            saving={saving}
            values={company}
            onSave={saveSection}
            fields={[
              { name: 'billing_street', label: 'Billing Street' },
              { name: 'billing_city', label: 'Billing City' },
              { name: 'billing_country', label: 'Billing Country', render: (d, set) => (
                <AddressCountrySelect
                  value={d.billing_country ?? ''}
                  onChange={(country) => set((p) => ({
                    ...p,
                    billing_country: country,
                    billing_state: nextStateForCountry(country, p.billing_state),
                  }))}
                />
              ) },
              { name: 'billing_state', label: 'Billing State', render: (d, set) => (
                <AddressStateSelect
                  country={d.billing_country}
                  value={d.billing_state ?? ''}
                  onChange={(state) => set((p) => ({ ...p, billing_state: state }))}
                />
              ) },
              { name: 'billing_zip', label: 'Billing Zip' },
            ]}
          />

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-zoho-text mb-3">Contacts</h3>
            {contacts.length === 0 ? (
              <p className="text-sm text-zoho-muted">No contacts linked to this company yet.</p>
            ) : (
              <ul className="divide-y divide-zoho-border">
                {contacts.map((contact) => (
                  <li key={contact.id} className="py-2 flex items-center justify-between gap-3">
                    <RecordDetailLink href={`/contacts/${contact.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || 'Contact'}
                    </RecordDetailLink>
                    <span className="text-xs text-zoho-muted">{contact.email || contact.phone || '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm text-zoho-muted">
            When a proposal is confirmed, convert it to an Account to move the customer into the Accounts module.
          </div>
        </div>
      </RecordDetailLayout>

      <ConfirmDialog
        open={deleteConfirm}
        message={`Delete ${company.name}?`}
        confirmLabel="Confirm Delete"
        danger
        onConfirm={async () => {
          try {
            await companiesApi.deleteCompany(id);
            router.push('/companies');
            showToast('Company deleted', 'success');
          } catch (err) {
            showToast(getApiError(err));
          }
        }}
        onCancel={() => setDeleteConfirm(false)}
      />
    </CRMLayout>
  );
}
