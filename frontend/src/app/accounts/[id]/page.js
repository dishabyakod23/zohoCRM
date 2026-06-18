'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
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
import * as contactsApi from '../../../lib/services/contacts.js';
import * as projectsApi from '../../../lib/services/projects.js';
import { ACCOUNT_TYPES } from '../../../lib/constants.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';
import { TrashIcon } from '@heroicons/react/24/outline';
import { formatMoney, CURRENCIES } from '../../../lib/currencies.js';

const INDUSTRIES = ['IT Services', 'E-Commerce', 'Automotive', 'EdTech', 'FinTech', 'Healthcare', 'Manufacturing', 'Retail', 'Other'];

export default function AccountDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [account, setAccount] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadAccount = useCallback(() => {
    Promise.all([
      accountsApi.getAccount(id),
      contactsApi.listContacts({ account_id: id, page_size: 100 }),
      projectsApi.listProjects({ account_id: id, page_size: 100 }),
    ]).then(([r, contactResult, projectResult]) => {
      setAccount({ ...r, account_name: r.name || r.account_name });
      setContacts(contactResult.data || []);
      setProjects(projectResult.data || []);
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
      throw err;
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
              { name: 'deal_size', label: 'Deal Size', format: (v) => formatMoney(v ?? account.deal_size, account.currency) },
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
              { name: 'annual_revenue', label: 'Annual Revenue', format: (v) => formatMoney(v, account.currency) },
              { name: 'currency', label: 'Currency', render: (d, set) => (
                <select className="input" value={d.currency ?? account.currency ?? 'INR'} onChange={(e) => set((p) => ({ ...p, currency: e.target.value }))}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </select>
              ) },
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

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-zoho-text mb-3">Contact List</h3>
            {contacts.length === 0 ? (
              <p className="text-sm text-zoho-muted">No contacts linked to this account.</p>
            ) : (
              <ul className="divide-y divide-zoho-border">
                {contacts.map((contact) => (
                  <li key={contact.id} className="py-2 flex items-center justify-between gap-3">
                    <Link href={`/contacts/${contact.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || 'Contact'}
                    </Link>
                    <span className="text-xs text-zoho-muted">{contact.email || contact.phone || '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-zoho-text mb-3">Projects</h3>
            {projects.length === 0 ? (
              <p className="text-sm text-zoho-muted">No projects linked to this account.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zoho-muted border-b border-zoho-border">
                      <th className="pb-2 font-medium">Project</th>
                      <th className="pb-2 font-medium">Deal Size</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zoho-border">
                    {projects.map((project) => (
                      <tr key={project.id}>
                        <td className="py-2">
                          <Link href={`/projects/${project.id}`} className="font-medium text-brand-600 hover:underline">
                            {project.name || project.project_name}
                          </Link>
                        </td>
                        <td className="py-2">{formatMoney(project.budget ?? project.deal_size, account.currency)}</td>
                        <td className="py-2">{project.status_label || project.status || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

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
