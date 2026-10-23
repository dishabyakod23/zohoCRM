'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import ListToolbar from '../../components/layout/ListToolbar.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import RecordDetailLink from '../../components/records/RecordDetailLink.js';
import PhoneCell from '../../components/cloudtalk/PhoneCell.js';
import { useToast } from '../../components/ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useListRefresh } from '../../hooks/useListRefresh.js';
import { useDefaultOwnerFilters } from '../../hooks/useDefaultOwnerFilters.js';
import { getApiError } from '../../lib/api.js';
import { DEFAULT_PAGE_SIZE } from '../../lib/constants.js';
import { DND_LEAD_STATUS } from '../../lib/statusHelpers.js';
import * as contactDirectoryApi from '../../lib/services/contactDirectory.js';
import * as contactsApi from '../../lib/services/contacts.js';
import { fetchLeadStatuses, FALLBACK_LEAD_STATUSES, fetchUsers } from '../../lib/services/lookups.js';
import { accountMapFromLookups, fetchCompanyLookups } from '../../lib/services/lookups.js';
import { EMPTY_CONTACT_FILTERS, countActiveFilters } from '../../lib/listRecordFilters.js';
import { DEFAULT_LIST_SORT, getSortApiParams } from '../../lib/listSortHelpers.js';
import { tableLinkClass, tableEmailClass, tableAvatarClass } from '../../lib/tableStyles.js';
import { OwnerFilter, TextFilter } from '../../components/layout/ListFilterFields.js';
import { recordTimestampColumns } from '../../lib/listTimestampHelpers.js';
import { useTableSelection } from '../../hooks/useTableSelection.js';

const LIMIT = DEFAULT_PAGE_SIZE;

export default function DndPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const { filters, setFilters, clearFilters } = useDefaultOwnerFilters({
    ...EMPTY_CONTACT_FILTERS,
    lead_status: DND_LEAD_STATUS,
  });
  const [users, setUsers] = useState([]);
  const [sort, setSort] = useState(DEFAULT_LIST_SORT);
  const [accounts, setAccounts] = useState([]);
  const leadStatusOptionsRef = useRef(FALLBACK_LEAD_STATUSES);
  const fetchGenRef = useRef(0);
  const accountMap = useMemo(() => accountMapFromLookups(accounts), [accounts]);
  const accountMapRef = useRef(accountMap);
  accountMapRef.current = accountMap;

  useEffect(() => {
    fetchCompanyLookups().then(setAccounts).catch(() => setAccounts([]));
    fetchUsers().then(setUsers).catch(() => setUsers([]));
    fetchLeadStatuses().then((options) => { leadStatusOptionsRef.current = options; }).catch(() => {});
  }, []);

  const directoryFilters = useMemo(
    () => ({ ...filters, lead_status: DND_LEAD_STATUS }),
    [filters],
  );

  const fetchRows = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    setLoading(true);
    try {
      const result = await contactDirectoryApi.listContactDirectory({
        page,
        page_size: LIMIT,
        search: debouncedSearch || undefined,
        filters: directoryFilters,
        sort_key: sort,
        ...getSortApiParams(sort, 'contacts'),
      }, accountMapRef.current);
      if (gen !== fetchGenRef.current) return;
      setRows(result.data);
      setTotal(result.total);
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      showToast(getApiError(err));
      setRows([]);
      setTotal(0);
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [page, debouncedSearch, directoryFilters, sort, showToast]);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useListRefresh(fetchRows);

  const listParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    filters: directoryFilters,
    ...getSortApiParams(sort, 'contacts'),
  }), [debouncedSearch, directoryFilters, sort]);

  const tableSelection = useTableSelection({
    total,
    resetDeps: [debouncedSearch, directoryFilters, sort],
    fetchAllIds: () => contactDirectoryApi.listAllMatchingContactDirectoryIds(listParams, accountMapRef.current),
  });

  const initials = (c) => `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase();
  const totalPages = Math.ceil(total / LIMIT) || 1;

  const columns = useMemo(() => [
    { id: 'contact', header: 'Name', cell: (c) => (
      <div className="flex items-center gap-2.5">
        <div className={tableAvatarClass}>{initials(c)}</div>
        <RecordDetailLink href={c._detailHref || `/contacts/${c.id}`} className={tableLinkClass}>
          {c.first_name} {c.last_name}
        </RecordDetailLink>
      </div>
    ) },
    { id: 'company', header: 'Company', cell: (c) => c.account_name || c.company || '—' },
    { id: 'lead_status', header: 'Lead Status', cell: () => 'DND' },
    { id: 'email', header: 'Email', sortField: 'email', cell: (c) => <span className={tableEmailClass}>{c.email || '—'}</span> },
    { id: 'phone', header: 'Phone', cell: (c) => <PhoneCell value={c.phone || c.mobile} label="Call" /> },
    { id: 'owner', header: 'Owner', cell: (c) => c.owner_name || '—' },
    ...recordTimestampColumns(),
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader title="DND" />
        <p className="text-sm text-zoho-muted mb-4">
          People marked Do Not Disturb. They stay off Contacts and pipeline lists until you change Lead Status.
        </p>
        <ListToolbar
          moduleName="DND"
          total={total}
          searchValue={search}
          onSearch={(v) => { setSearch(v); setPage(1); }}
          sort={sort}
          onSortChange={(v) => { setSort(v); setPage(1); }}
          hasActiveFilters={countActiveFilters({ ...filters, lead_status: '' }, user) > 0}
          onClearFilters={() => { clearFilters(); setPage(1); }}
          table={(
            <RecordDataTable
              moduleKey="contacts"
              records={rows}
              loading={loading}
              columns={columns}
              onRefresh={fetchRows}
              emptyMessage="No DND contacts yet"
              sort={sort}
              onSortChange={(v) => { setSort(v); setPage(1); }}
              {...tableSelection}
              massUpdateHandler={(ids, field, value, extras) => contactsApi.applyContactDirectoryMassUpdate(ids, field, value, {
                ...extras,
                statusOptions: leadStatusOptionsRef.current,
              })}
              pagination={{
                page,
                totalPages,
                onPageChange: setPage,
                label: total ? `${((page - 1) * LIMIT) + 1}–${Math.min(page * LIMIT, total)} of ${total}` : '0 records',
              }}
            />
          )}
        >
          <TextFilter label="Company" value={filters.company} onChange={(v) => { setFilters((f) => ({ ...f, company: v })); setPage(1); }} />
          <OwnerFilter users={users} value={filters.owner_id} onChange={(v) => { setFilters((f) => ({ ...f, owner_id: v })); setPage(1); }} />
        </ListToolbar>
      </div>
    </CRMLayout>
  );
}
