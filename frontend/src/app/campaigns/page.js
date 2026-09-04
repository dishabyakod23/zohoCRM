'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import ListToolbar from '../../components/layout/ListToolbar.js';
import Badge from '../../components/ui/Badge.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import RecordDetailLink from '../../components/records/RecordDetailLink.js';
import { useToast } from '../../components/ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { getApiError } from '../../lib/api.js';
import * as campaignsApi from '../../lib/services/campaigns.js';
import { fetchCampaignStatuses, fetchUsers } from '../../lib/services/lookups.js';
import { tableLinkClass } from '../../lib/tableStyles.js';
import { DEFAULT_PAGE_SIZE } from '../../lib/constants.js';
import { DEFAULT_LIST_SORT, getSortApiParams } from '../../lib/listSortHelpers.js';
import { useTableSelection } from '../../hooks/useTableSelection.js';
import { navigateToRecord } from '../../lib/recordNavigation.js';
import { useDefaultOwnerFilters } from '../../hooks/useDefaultOwnerFilters.js';
import { countActiveFilters } from '../../lib/listRecordFilters.js';
import { OwnerFilter } from '../../components/layout/ListFilterFields.js';

const LIMIT = DEFAULT_PAGE_SIZE;
const EMPTY_CAMPAIGN_FILTERS = { owner_id: '' };

export default function CampaignsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { can } = usePermissions();
  const canCreate = can('campaigns', 'create');
  const [items, setItems] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(DEFAULT_LIST_SORT);
  const { filters, setFilters, clearFilters } = useDefaultOwnerFilters(EMPTY_CAMPAIGN_FILTERS);

  useEffect(() => {
    fetchCampaignStatuses().then(setStatusOptions).catch(() => {});
    fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await campaignsApi.listCampaigns({
        page,
        page_size: LIMIT,
        search: debouncedSearch || undefined,
        owner_id: filters.owner_id || undefined,
        ...getSortApiParams(sort, 'campaigns'),
      });
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sort, filters.owner_id, showToast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const campaignListParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    owner_id: filters.owner_id || undefined,
    ...getSortApiParams(sort, 'campaigns'),
  }), [debouncedSearch, sort, filters.owner_id]);

  const fetchAllMatchingCampaignIds = useCallback(
    () => campaignsApi.listAllMatchingCampaignIds(campaignListParams),
    [campaignListParams],
  );

  const tableSelection = useTableSelection({
    total,
    resetDeps: [debouncedSearch, sort, filters.owner_id],
    fetchAllIds: fetchAllMatchingCampaignIds,
  });

  const columns = useMemo(() => [
    { id: 'name', header: 'Name', cell: (c) => <RecordDetailLink href={`/campaigns/${c.id}`} className={tableLinkClass}>{c.name}</RecordDetailLink> },
    { id: 'type', header: 'Type', cell: (c) => c.type_label },
    { id: 'status', header: 'Status', cell: (c) => <Badge label={c.status_label} /> },
    { id: 'owner', header: 'Owner', cell: (c) => c.owner_name || '—' },
    { id: 'dates', header: 'Dates', cell: (c) => <span className="text-xs">{c.start_date} → {c.end_date}</span> },
    { id: 'members', header: 'Members', cell: (c) => c.member_count || 0 },
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Campaigns"
          primaryAction={canCreate ? (
            <button type="button" onClick={() => navigateToRecord('/campaigns/create')} className="btn-primary-sm">
              Create Campaign
            </button>
          ) : null}
        />

        <ListToolbar
          moduleName="Campaigns"
          total={total}
          searchValue={search}
          onSearch={(v) => { setSearch(v); setPage(1); }}
          filterListSearch
          sort={sort}
          onSortChange={(v) => { setSort(v); setPage(1); }}
          hasActiveFilters={countActiveFilters(filters, user) > 0}
          onClearFilters={() => { clearFilters(); setPage(1); }}
          table={(
            <RecordDataTable
              moduleKey="campaigns"
              records={items}
              loading={loading}
              columns={columns}
              statusOptions={statusOptions}
              onRefresh={fetchItems}
              emptyMessage="No campaigns found"
              {...tableSelection}
              pagination={{ page, totalPages, onPageChange: setPage, label: total ? `${((page - 1) * LIMIT) + 1}–${Math.min(page * LIMIT, total)} of ${total}` : '0 records' }}
            />
          )}
        >
          <OwnerFilter users={users} value={filters.owner_id} onChange={(v) => { setFilters((f) => ({ ...f, owner_id: v })); setPage(1); }} />
        </ListToolbar>
      </div>
    </CRMLayout>
  );
}
