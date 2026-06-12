'use client';
import { useEffect, useState, useCallback } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import ApiPendingBanner from '../../components/ui/ApiPendingBanner.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../components/ui/Toast.js';

export default function RecycleBinPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permDelete, setPermDelete] = useState(null);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  const fetch = useCallback(() => {
    setLoading(false);
    setItems([]);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const restore = () => {
    showToast('Recycle Bin is not available on the Sales CRM API yet');
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <ApiPendingBanner module="Recycle Bin" />
        <h1 className="text-xl font-bold mb-2">Recycle Bin</h1>
        <p className="text-sm text-gray-500 mb-6">Deleted records are retained for 30 days before permanent removal.</p>
        <div className="card overflow-x-auto">
          <table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">Name</th><th className="table-th">Type</th><th className="table-th">Deleted</th><th className="table-th">Actions</th></tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={4} className="table-td text-center py-10 text-gray-400">Loading...</td></tr>
              : items.length === 0 ? <tr><td colSpan={4} className="table-td text-center py-10 text-gray-400">Recycle bin is empty</td></tr>
              : items.map(item => (
                <tr key={`${item.record_type}-${item.id}`}>
                  <td className="table-td font-medium">{item.name}</td>
                  <td className="table-td capitalize">{item.record_type}</td>
                  <td className="table-td text-xs">{new Date(item.deleted_at).toLocaleString()}</td>
                  <td className="table-td flex gap-2">
                    <button onClick={() => restore(item)} className="text-xs text-brand-600">Restore</button>
                    {isAdmin && <button onClick={() => setPermDelete(item)} className="text-xs text-red-600">Delete Forever</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmDialog open={!!permDelete} message={`Permanently delete ${permDelete?.name}? This cannot be undone.`} confirmLabel="Delete Forever" danger
        onConfirm={() => { setPermDelete(null); showToast('Recycle Bin is not available on the Sales CRM API yet'); }} onCancel={() => setPermDelete(null)} />
    </CRMLayout>
  );
}
