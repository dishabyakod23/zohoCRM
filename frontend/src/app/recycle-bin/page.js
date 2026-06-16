'use client';
import { useEffect, useState, useCallback } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import * as recycleBinApi from '../../lib/services/recycleBin.js';

export default function RecycleBinPage() {
  const { showToast } = useToast();
  const { isSuperAdmin } = usePermissions();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await recycleBinApi.listRecycleBin({ page: 1, page_size: 50 });
      setItems(result.data);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleRestore = async (item) => {
    setRestoring(item.id);
    try {
      await recycleBinApi.restoreRecycleItem(item.id);
      fetchItems();
      showToast(`${item.name} restored`, 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async () => {
    setDeleting(true);
    try {
      await recycleBinApi.deleteRecycleItem(deleteTarget.id);
      setDeleteTarget(null);
      fetchItems();
      showToast('Record permanently deleted', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <h1 className="text-xl font-bold mb-2">Recycle Bin</h1>
        <p className="text-sm text-gray-500 mb-6">Deleted records are retained for 30 days before permanent removal.</p>
        <div className="card overflow-x-auto">
          <table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">Name</th><th className="table-th">Type</th><th className="table-th">Deleted</th><th className="table-th">Actions</th></tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={4} className="table-td text-center py-10 text-gray-400">Loading...</td></tr>
              : items.length === 0 ? <tr><td colSpan={4} className="table-td text-center py-10 text-gray-400">Recycle bin is empty</td></tr>
              : items.map(item => (
                <tr key={item.id}>
                  <td className="table-td font-medium">{item.name}</td>
                  <td className="table-td capitalize">{item.record_type || item.entity_type}</td>
                  <td className="table-td text-xs">{item.deleted_at ? new Date(item.deleted_at).toLocaleString() : '—'}</td>
                  <td className="table-td">
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleRestore(item)}
                        disabled={restoring === item.id}
                        className="text-xs text-brand-600 hover:underline disabled:opacity-50"
                      >
                        {restoring === item.id ? 'Restoring...' : 'Restore'}
                      </button>
                      {isSuperAdmin && (
                        <button onClick={() => setDeleteTarget(item)} className="text-xs text-red-500 hover:underline">Delete Forever</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        message={`Permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete Forever'}
        danger
        onConfirm={handlePermanentDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </CRMLayout>
  );
}
