'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import { useToast } from '../../../components/ui/Toast.js';
import { getApiError } from '../../../lib/api.js';
import * as accountsApi from '../../../lib/services/accounts.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';

export default function AccountDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [account, setAccount] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    accountsApi.getAccount(id).then(r => {
      setAccount(r);
      trackRecentItem({ type: 'account', id, name: r.name });
    }).catch(() => router.push('/accounts'));
  }, [id, router]);

  if (!account) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

  return (
    <CRMLayout>
      <div className="p-6 max-w-3xl">
        <Link href="/accounts" className="text-xs text-gray-400">← Back to Accounts</Link>
        <div className="flex justify-between mt-2 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{account.name}</h1>
            <p className="text-sm text-gray-500">{account.industry || 'Account'}</p>
          </div>
          <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs">Delete</button>
        </div>
        <div className="card p-5">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[['Phone', account.phone], ['Website', account.website], ['Industry', account.industry], ['City', account.city], ['Country', account.country], ['Owner', account.owner_name]].map(([k, v]) => (
              <div key={k}><dt className="text-gray-400 text-xs">{k}</dt><dd>{v || '—'}</dd></div>
            ))}
          </dl>
        </div>
      </div>
      <ConfirmDialog open={deleteConfirm} message={`Delete ${account.name}?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => {
          try { await accountsApi.deleteAccount(id); router.push('/accounts'); }
          catch (err) { showToast(getApiError(err)); }
        }} onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
