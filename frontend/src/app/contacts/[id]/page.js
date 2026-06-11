'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import api from '../../../lib/api.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';

export default function ContactDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [contact, setContact] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    api.get(`/contacts/${id}`).then(r => {
      setContact(r.data);
      trackRecentItem({ type: 'contact', id, name: `${r.data.first_name} ${r.data.last_name}` });
    }).catch(() => router.push('/contacts'));
  }, [id, router]);

  if (!contact) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

  return (
    <CRMLayout>
      <div className="p-6 max-w-3xl">
        <Link href="/contacts" className="text-xs text-gray-400">← Back to Contacts</Link>
        <div className="flex justify-between mt-2 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold">{contact.first_name?.[0]}{contact.last_name?.[0]}</div>
            <div><h1 className="text-2xl font-bold">{contact.first_name} {contact.last_name}</h1><p className="text-sm text-gray-500">{contact.title} at {contact.account_name || contact.company}</p></div>
          </div>
          <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs">Delete</button>
        </div>
        <div className="card p-5">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[['Email', contact.email], ['Phone', contact.phone], ['Mobile', contact.mobile], ['Account', contact.account_name], ['Department', contact.department], ['Lead Source', contact.lead_source], ['Owner', contact.owner_name]].map(([k,v]) => (
              <div key={k}><dt className="text-gray-400 text-xs">{k}</dt><dd>{v || '—'}</dd></div>
            ))}
          </dl>
        </div>
      </div>
      <ConfirmDialog open={deleteConfirm} message={`Delete ${contact.first_name} ${contact.last_name}?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { await api.delete(`/contacts/${id}`); router.push('/contacts'); }} onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
