'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import Badge from '../../../components/ui/Badge.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import api from '../../../lib/api.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';

export default function AccountDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [account, setAccount] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    api.get(`/accounts/${id}`).then(r => {
      setAccount(r.data);
      trackRecentItem({ type: 'account', id, name: r.data.name });
    }).catch(() => router.push('/accounts'));
  }, [id, router]);

  if (!account) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

  return (
    <CRMLayout>
      <div className="p-6 max-w-5xl">
        <Link href="/accounts" className="text-xs text-gray-400 hover:text-brand-600">← Back to Accounts</Link>
        <div className="flex justify-between items-start mt-2 mb-6">
          <div><h1 className="text-2xl font-bold">{account.name}</h1><p className="text-sm text-gray-500">{account.industry} · {account.city}, {account.country}</p></div>
          <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs">Delete</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <h2 className="font-semibold mb-4">Account Information</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[['Owner', account.owner_name], ['Phone', account.phone], ['Website', account.website], ['Industry', account.industry], ['Annual Revenue', account.annual_revenue], ['Employees', account.employees]].map(([k,v]) => (
                <div key={k}><dt className="text-gray-400 text-xs">{k}</dt><dd>{v || '—'}</dd></div>
              ))}
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold mb-4">Linked Contacts ({account.contacts?.length || 0})</h2>
            <div className="space-y-2">{account.contacts?.map(c => (
              <div key={c.id} className="text-sm flex justify-between"><Link href={`/contacts/${c.id}`} className="text-brand-600">{c.first_name} {c.last_name}</Link><span className="text-gray-400">{c.email}</span></div>
            ))}</div>
          </div>

          <div className="card p-5 col-span-full">
            <h2 className="font-semibold mb-4">Deals</h2>
            <table className="w-full text-sm"><thead><tr className="text-left text-gray-400 text-xs"><th className="pb-2">Deal Name</th><th>Amount</th><th>Stage</th><th>Close Date</th><th>Probability</th></tr></thead>
              <tbody>{account.deals?.map(d => (
                <tr key={d.id} className="border-t border-gray-50"><td className="py-2"><Link href={`/deals/${d.id}`} className="text-brand-600">{d.name}</Link></td>
                  <td>₹{Number(d.amount).toLocaleString()}</td><td><Badge label={d.stage} /></td><td>{d.close_date?.slice(0,10)}</td><td>{d.probability}%</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>
      <ConfirmDialog open={deleteConfirm}
        message={`This Account has ${account.contacts?.length || 0} linked Contacts and ${account.deals?.length || 0} Deals. Deleting it will unlink all related records. Proceed?`}
        confirmLabel="Confirm Delete" danger
        onConfirm={async () => { await api.delete(`/accounts/${id}`); router.push('/accounts'); }} onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
