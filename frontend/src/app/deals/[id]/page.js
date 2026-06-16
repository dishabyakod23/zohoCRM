'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import Badge from '../../../components/ui/Badge.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import { useToast } from '../../../components/ui/Toast.js';
import { getApiError } from '../../../lib/api.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import * as dealsApi from '../../../lib/services/deals.js';
import { fetchDealStages, fetchAccountLookups, accountMapFromLookups } from '../../../lib/services/lookups.js';
import { FALLBACK_DEAL_STAGES } from '../../../lib/dealHelpers.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';

export default function DealDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [deal, setDeal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchAccountLookups(),
      fetchDealStages().catch(() => FALLBACK_DEAL_STAGES),
    ]).then(([accounts, stages]) => {
      const accountMap = accountMapFromLookups(accounts);
      return dealsApi.getDeal(id, accountMap, stages);
    }).then(r => {
      setDeal(r);
      trackRecentItem({ type: 'deal', id, name: r.name || r.deal_name });
    }).catch(() => {
      showToast('Deal not found');
      router.push('/deals');
    });
  }, [id, router, showToast]);

  const fmt = (n) => (n != null && n !== '' ? `₹${Number(n).toLocaleString()}` : '—');

  if (!deal) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

  return (
    <CRMLayout>
      <div className="p-6 max-w-3xl">
        <Link href="/deals" className="text-xs text-gray-400">← Back to Deals</Link>
        <div className="flex justify-between mt-2 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{deal.name || deal.deal_name}</h1>
            <p className="text-sm text-gray-500">{deal.account_name || 'No account linked'}</p>
          </div>
          {canEdit && (
            <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs">Delete</button>
          )}
        </div>
        <div className="card p-5">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-gray-400 text-xs">Stage</dt><dd><Badge label={deal.stage} /></dd></div>
            {[['Amount', fmt(deal.amount)], ['Closing Date', deal.close_date ? new Date(deal.close_date).toLocaleDateString() : '—'], ['Probability', deal.probability != null ? `${deal.probability}%` : '—'], ['Account', deal.account_name], ['Owner', deal.owner_name], ['Description', deal.description]].map(([k, v]) => (
              <div key={k}><dt className="text-gray-400 text-xs">{k}</dt><dd>{v || '—'}</dd></div>
            ))}
          </dl>
        </div>
      </div>
      <ConfirmDialog open={deleteConfirm} message={`Delete ${deal.name || deal.deal_name}?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => {
          try { await dealsApi.deleteDeal(id); router.push('/deals'); showToast('Deal deleted', 'success'); }
          catch (err) { showToast(getApiError(err)); }
        }} onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
