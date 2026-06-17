'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import Badge from '../../../components/ui/Badge.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout from '../../../components/records/RecordDetailLayout.js';
import EditableFieldSection from '../../../components/records/EditableFieldSection.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { getApiError } from '../../../lib/api.js';
import * as accountsApi from '../../../lib/services/accounts.js';
import { ACCOUNT_TYPES } from '../../../lib/constants.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';
import { TrashIcon } from '@heroicons/react/24/outline';

const INDUSTRIES = ['IT Services', 'E-Commerce', 'Automotive', 'EdTech', 'FinTech', 'Healthcare', 'Manufacturing', 'Retail', 'Other'];

export default function AccountDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [account, setAccount] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadAccount = useCallback(() => {
    accountsApi.getAccount(id).then((r) => {
      setAccount({ ...r, account_name: r.name || r.account_name });
      trackRecentItem({ type: 'account', id, name: r.name });
    }).catch(() => {
      showToast('Account not found');
      router.push('/accounts');
    });
  }, [id, router, showToast]);

  useEffect(() => { loadAccount(); }, [loadAccount]);

  const saveSection = async (payload) => {
    setSaving(true);
    try {
      await accountsApi.updateAccount(id, payload);
      loadAccount();
      showToast('Account updated', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!account) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

  return (
    <CRMLayout>
      <RecordDetailLayout
        backHref="/accounts" backLabel="Accounts"
        title={account.name}
        subtitle={account.industry || 'Account'}
        avatarLabel={account.name?.[0]}
        badges={account.account_type ? <Badge label={account.account_type} /> : null}
        lastUpdated={account.updated_at ? new Date(account.updated_at).toLocaleString() : undefined}
        recordNotes={{ relatedType: 'account', recordId: id, canEdit }}
        actions={canDelete && (
          <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5">
            <TrashIcon className="w-4 h-4" /> Delete
          </button>
        )}
      >
        <div className="space-y-4">
          <EditableFieldSection
            title="Account Information"
            canEdit={canEdit}
            saving={saving}
            values={account}
            onSave={saveSection}
            fields={[
              { name: 'account_name', label: 'Account Name', required: true },
              { name: 'phone', label: 'Phone' },
              { name: 'website', label: 'Website' },
              { name: 'account_type', label: 'Status', render: (d, set) => (
                <select className="input" value={d.account_type ?? ''} onChange={(e) => set((p) => ({ ...p, account_type: e.target.value }))}>
                  <option value="">--None--</option>
                  {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              ) },
              { name: 'industry', label: 'Industry', render: (d, set) => (
                <select className="input" value={d.industry ?? ''} onChange={(e) => set((p) => ({ ...p, industry: e.target.value }))}>
                  <option value="">--None--</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              ) },
              { name: 'annual_revenue', label: 'Annual Revenue' },
              { name: 'owner_name', label: 'Owner', format: () => account.owner_name },
            ]}
          />
          <EditableFieldSection
            title="Address Information"
            canEdit={canEdit}
            saving={saving}
            values={account}
            onSave={saveSection}
            fields={[
              { name: 'city', label: 'City' },
              { name: 'state', label: 'State' },
              { name: 'zip_code', label: 'Zip Code' },
              { name: 'country', label: 'Country' },
            ]}
          />
          <EditableFieldSection
            title="Description"
            canEdit={canEdit}
            saving={saving}
            values={account}
            onSave={saveSection}
            fields={[
              { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
                <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
              ) },
            ]}
          />
        </div>
      </RecordDetailLayout>

      <ConfirmDialog open={deleteConfirm} message={`Delete ${account.name}?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => {
          try { await accountsApi.deleteAccount(id); router.push('/accounts'); showToast('Account deleted', 'success'); }
          catch (err) { showToast(getApiError(err)); }
        }} onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
