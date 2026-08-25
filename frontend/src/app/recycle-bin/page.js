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
import { DEFAULT_PAGE_SIZE } from '../../lib/constants.js';
import { DEFAULT_LIST_SORT, getSortApiParams, sortRecords } from '../../lib/listSortHelpers.js';

const LIMIT = DEFAULT_PAGE_SIZE;

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function isNameSort(sort) {
  return sort === 'name_asc' || sort === 'name_desc';
}

export default function RecycleBinPage() {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canViewRecycleBin = can('recycle_bin', 'view');
  const canRestore = can('recycle_bin', 'restore');
  const canPermanentDelete = can('recycle_bin', 'permanent_delete');
  const [items, setItems] = useState([]);
  const [allNameSorted, setAllNameSorted] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [restoringId, setRestoringId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sort, setSort] = useState(DEFAULT_LIST_SORT);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      if (isNameSort(sort)) {
        const result = await recycleBinApi.listAllRecycleBin({
          entity_type: entityType || undefined,
        });
        const sorted = sortRecords(result.data, sort, 'recycle-bin');
        setAllNameSorted(sorted);
        setTotal(sorted.length);
      } else {
        setAllNameSorted(null);
        const result = await recycleBinApi.listRecycleBin({
          page,
          page_size: LIMIT,
          entity_type: entityType || undefined,
          ...getSortApiParams(sort, 'recycle-bin'),
        });
        setItems(sortRecords(result.data, sort, 'recycle-bin'));
        setTotal(result.total);
      }
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, entityType, sort, showToast]);

  useEffect(() => {
    // Name sort: reload full list only when sort/filter changes (not on page flip).
    if (isNameSort(sort) && allNameSorted) return;
    fetchItems();
  }, [fetchItems, sort, entityType, allNameSorted]);

  useEffect(() => {
    if (!isNameSort(sort) || !allNameSorted) return;
    const start = (page - 1) * LIMIT;
    setItems(allNameSorted.slice(start, start + LIMIT));
  }, [page, sort, allNameSorted]);

  const handleRestore = async (item) => {
    setRestoringId(item.id);
    try {
      const result = await recycleBinApi.restoreRecycleItem(item.id);
      const restored = result?.restored;
      const conflict = result?.conflict || result?.duplicate || result?.skipped;
      const failed = restored === false
        || conflict
        || result?.success === false
        || result?.error
        || /already exist|conflict|duplicate|skip/i.test(String(result?.message || ''));
      if (failed) {
        showToast(
          result?.message
            || 'Could not restore — a matching record may already exist.',
          'warning',
        );
      } else {
        showToast(result?.message || `${item.entity_name} restored`, 'success');
      }
      setAllNameSorted(null);
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
      setAllNameSorted(null);
      fetchItems();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setDeletingId('');
    }
  };

  const totalPages = Math.ceil(total / LIMIT) || 1;

  if (!canViewRecycleBin) {
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
          sort={sort}
          onSortChange={(v) => { setSort(v); setPage(1); setAllNameSorted(null); }}
          filterTitle="Filter Recycle Bin by"
          filterFields={(
            <SelectFilter
              label="Record type"
              value={entityType}
              onChange={(v) => { setEntityType(v); setPage(1); setAllNameSorted(null); }}
              options={RECYCLE_ENTITY_TYPES.filter((t) => t.value)}
              emptyLabel="All types"
            />
          )}
          hasActiveFilters={!!entityType}
          onClearFilters={() => { setEntityType(''); setPage(1); setAllNameSorted(null); }}
          table={(
            <div className="record-data-table-shell">
              <div className="record-data-table-scroll">
                <table className="record-data-table w-full">
                  <thead>
                    <tr>
                      <th className="table-th">Name</th>
                      <th className="table-th">Type</th>
                      <th className="table-th">Deleted at</th>
                      <th className="table-th">Expires at</th>
                      <th className="table-th text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={5} className="table-td text-center py-10 text-zoho-muted">Loading deleted records…</td></tr>
                    ) : items.length === 0 ? (
                      <tr><td colSpan={5} className="table-td text-center py-10 text-zoho-muted">Recycle bin is empty</td></tr>
                    ) : items.map((item) => (
                      <tr key={item.id} className="list-table-row">
                        <td className="table-td font-medium">{item.entity_name}</td>
                        <td className="table-td">
                          <Badge label={item.entity_type_label || item.entity_type} />
                        </td>
                        <td className="table-td text-xs text-zoho-muted">{formatDateTime(item.deleted_at)}</td>
                        <td className="table-td text-xs text-zoho-muted">{formatDateTime(item.expires_at)}</td>
                        <td className="table-td text-right whitespace-nowrap">
                          {canRestore && (
                          <button
                            type="button"
                            onClick={() => handleRestore(item)}
                            disabled={restoringId === item.id || deletingId === item.id}
                            className={`${tableActionClass} mr-3`}
                          >
                            {restoringId === item.id ? 'Restoring…' : 'Restore'}
                          </button>
                          )}
                          {canPermanentDelete && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(item)}
                            disabled={restoringId === item.id || deletingId === item.id}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            Delete forever
                          </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="record-data-table-footer">
                <p className="text-xs text-zoho-muted">
                  {total} record{total === 1 ? '' : 's'}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="btn-secondary-sm disabled:opacity-40">← Prev</button>
                  <span className="btn-secondary-sm pointer-events-none">{page} / {totalPages}</span>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="btn-secondary-sm disabled:opacity-40">Next →</button>
                </div>
              </div>
            </div>
          )}
        />
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
