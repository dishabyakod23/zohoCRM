'use client';
import { useCallback, useEffect, useState } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import ListSearchBar from '../../components/layout/ListSearchBar.js';
import Modal from '../../components/ui/Modal.js';
import Badge from '../../components/ui/Badge.js';
import { SelectFilter } from '../../components/layout/ListFilterFields.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import * as recycleBinApi from '../../lib/services/recycleBin.js';
import { RECYCLE_ENTITY_TYPES } from '../../lib/services/recycleBin.js';
import { tableActionClass } from '../../lib/tableStyles.js';

const LIMIT = 15;

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function RecycleBinPage() {
  const { showToast } = useToast();
  const { canDelete } = usePermissions();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [restoringId, setRestoringId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await recycleBinApi.listRecycleBin({
        page,
        page_size: LIMIT,
        entity_type: entityType || undefined,
      });
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, entityType, showToast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleRestore = async (item) => {
    setRestoringId(item.id);
    try {
      const result = await recycleBinApi.restoreRecycleItem(item.id);
      showToast(result?.message || `${item.entity_name} restored`, 'success');
      fetchItems();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setRestoringId('');
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      const result = await recycleBinApi.deleteRecycleItem(confirmDelete.id);
      showToast(result?.message || `${confirmDelete.entity_name} permanently deleted`, 'success');
      setConfirmDelete(null);
      fetchItems();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setDeletingId('');
    }
  };

  const totalPages = Math.ceil(total / LIMIT) || 1;

  if (!canDelete) {
    return (
      <CRMLayout>
        <div className="p-6">
          <h1 className="text-xl font-bold mb-2">Recycle Bin</h1>
          <p className="text-gray-500 text-sm">Your role does not have access to the recycle bin.</p>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Recycle Bin"
          subtitle="Review, restore, or permanently delete records removed from the CRM."
        />

        <ListSearchBar
          total={total}
          totalLabel="deleted records"
          filterFields={(
            <SelectFilter
              label="Record type"
              value={entityType}
              onChange={(v) => { setEntityType(v); setPage(1); }}
              options={RECYCLE_ENTITY_TYPES.filter((t) => t.value)}
              emptyLabel="All types"
              className="w-44"
            />
          )}
          hasActiveFilters={!!entityType}
          onClearFilters={() => { setEntityType(''); setPage(1); }}
        />

        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Name</th>
                <th className="table-th">Type</th>
                <th className="table-th">Deleted at</th>
                <th className="table-th">Expires at</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={5} className="table-td text-center py-10 text-gray-400">Loading deleted records…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="table-td text-center py-10 text-gray-400">Recycle bin is empty</td></tr>
              ) : items.map((item) => (
                <tr key={item.id}>
                  <td className="table-td font-medium">{item.entity_name}</td>
                  <td className="table-td">
                    <Badge label={item.entity_type_label || item.entity_type} />
                  </td>
                  <td className="table-td text-xs text-zoho-muted">{formatDateTime(item.deleted_at)}</td>
                  <td className="table-td text-xs text-zoho-muted">{formatDateTime(item.expires_at)}</td>
                  <td className="table-td text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleRestore(item)}
                      disabled={restoringId === item.id || deletingId === item.id}
                      className={`${tableActionClass} mr-3`}
                    >
                      {restoringId === item.id ? 'Restoring…' : 'Restore'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(item)}
                      disabled={restoringId === item.id || deletingId === item.id}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      Delete forever
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex justify-between items-center px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-zoho-muted">
                {total} record{total === 1 ? '' : 's'}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="btn-secondary text-xs py-1">← Prev</button>
                <span className="text-xs self-center text-zoho-muted">Page {page} of {totalPages}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="btn-secondary text-xs py-1">Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <Modal title="Permanently delete record?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-zoho-muted">
            <span className="font-medium text-zoho-text">{confirmDelete.entity_name}</span>
            {' '}({confirmDelete.entity_type_label}) will be permanently removed. This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end pt-4 mt-2 border-t border-gray-100">
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancel</button>
            <button
              type="button"
              onClick={handlePermanentDelete}
              disabled={deletingId === confirmDelete.id}
              className="btn-primary bg-red-600 hover:bg-red-700 border-red-600"
            >
              {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </Modal>
      )}
    </CRMLayout>
  );
}
