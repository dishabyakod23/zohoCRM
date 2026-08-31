'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import ListSearchBar from '../../components/layout/ListSearchBar.js';
import Badge from '../../components/ui/Badge.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import RecordDetailLink from '../../components/records/RecordDetailLink.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { getApiError } from '../../lib/api.js';
import * as sequencesApi from '../../lib/services/sequences.js';
import { tableLinkClass } from '../../lib/tableStyles.js';
import { DEFAULT_PAGE_SIZE } from '../../lib/constants.js';
import { DEFAULT_LIST_SORT, getSortApiParams } from '../../lib/listSortHelpers.js';
import { useTableSelection } from '../../hooks/useTableSelection.js';
import { navigateToRecord, sequenceDetailHref } from '../../lib/recordNavigation.js';
import { SEQUENCE_STATUSES, replyRatePercent } from '../../lib/sequenceHelpers.js';

const LIMIT = DEFAULT_PAGE_SIZE;

export default function SequencesPage() {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canCreate = can('sequences', 'create');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(DEFAULT_LIST_SORT);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await sequencesApi.listSequences({
        page,
        page_size: LIMIT,
        search: debouncedSearch || undefined,
        ...getSortApiParams(sort, 'sequences'),
      });
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sort, showToast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const tableSelection = useTableSelection({
    total,
    resetDeps: [debouncedSearch, sort],
  });

  const columns = useMemo(() => [
    {
      id: 'name',
      header: 'Name',
      cell: (s) => (
        <RecordDetailLink href={sequenceDetailHref(s.id)} className={tableLinkClass}>
          {s.name}
        </RecordDetailLink>
      ),
    },
    { id: 'status', header: 'Status', cell: (s) => <Badge label={s.status_label || s.status} /> },
    { id: 'owner', header: 'Owner', cell: (s) => s.owner_name || '—' },
    { id: 'enrolled', header: 'Total Leads', cell: (s) => s.enrollment_count ?? 0 },
    { id: 'active', header: 'Active', cell: (s) => s.active_enrollment_count ?? 0 },
    { id: 'completed', header: 'Completed', cell: (s) => s.completed_count ?? '—' },
    { id: 'reply_rate', header: 'Reply Rate', cell: (s) => replyRatePercent(s) },
    { id: 'created', header: 'Created', cell: (s) => s.created_at ? new Date(s.created_at).toLocaleDateString() : '—' },
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Sequences"
          subtitle="Automated multi-step outreach for leads and contacts."
          primaryAction={canCreate ? (
            <button type="button" onClick={() => navigateToRecord('/sequences/create')} className="btn-primary-sm">
              Create Sequence
            </button>
          ) : null}
        />

        <ListSearchBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search sequences…"
          total={total}
          totalLabel="sequences"
          sort={sort}
          onSortChange={(v) => { setSort(v); setPage(1); }}
          table={(
            <RecordDataTable
              moduleKey="sequences"
              records={items}
              loading={loading}
              columns={columns}
              statusOptions={SEQUENCE_STATUSES}
              onRefresh={fetchItems}
              emptyMessage="No sequences found"
              {...tableSelection}
              pagination={{
                page,
                totalPages,
                onPageChange: setPage,
                label: total ? `${((page - 1) * LIMIT) + 1}–${Math.min(page * LIMIT, total)} of ${total}` : '0 records',
              }}
            />
          )}
        />
      </div>
    </CRMLayout>
  );
}
