'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import ListSearchBar from '../../components/layout/ListSearchBar.js';
import Badge from '../../components/ui/Badge.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { getApiError } from '../../lib/api.js';
import * as accountsApi from '../../lib/services/accounts.js';
import { ACCOUNT_TYPES, INDUSTRIES } from '../../lib/constants.js';
import { tableLinkClass, tableEmailClass, avatarInitialClass } from '../../lib/tableStyles.js';
import { TextFilter, SelectFilter, OwnerFilter } from '../../components/layout/ListFilterFields.js';
import { fetchUsers } from '../../lib/services/lookups.js';
import { EMPTY_ACCOUNT_FILTERS, countActiveFilters } from '../../lib/listRecordFilters.js';

const LIMIT = 15;

const ACCOUNT_STATUS_OPTIONS = ACCOUNT_TYPES.map((t) => ({ value: t, label: t }));

export default function AccountsPage() {
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(EMPTY_ACCOUNT_FILTERS);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await accountsApi.listAccounts({
        page,
        page_size: LIMIT,
        search: debouncedSearch || undefined,
        filters,
      });
      setAccounts(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filters, showToast]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const columns = useMemo(() => [
    { id: 'name', header: 'Company', cell: (a) => (
      <div className="flex items-center gap-2.5">
        <div className={avatarInitialClass(a.name, 'md')}>{(a.name || '?')[0]}</div>
        <Link href={`/accounts/${a.id}`} className={tableLinkClass}>{a.name}</Link>
      </div>
    ) },
    { id: 'industry', header: 'Industry', cell: (a) => a.industry || '—' },
    { id: 'website', header: 'Website', cell: (a) => a.website ? <a href={a.website} target="_blank" rel="noreferrer" className={`${tableEmailClass} text-xs hover:text-zoho-text hover:underline`}>{a.website.replace('https://', '')}</a> : '—' },
    { id: 'email', header: 'Email', cell: (a) => <span className={tableEmailClass}>{a.email || '—'}</span> },
    { id: 'status', header: 'Status', cell: (a) => <Badge label={a.account_type || '—'} /> },
    { id: 'city', header: 'City', cell: (a) => a.billing_city || a.city || '—' },
    { id: 'owner', header: 'Owner', cell: (a) => a.owner_name || '—' },
  ], []);

  const industryOptions = INDUSTRIES.map((value) => ({ value, label: value }));
  const statusOptions = ACCOUNT_STATUS_OPTIONS;

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Accounts"
          subtitle="Companies and organizations in your CRM."
          primaryAction={canEdit ? (
            <Link href="/accounts/create" className="btn-primary-sm">Create Account</Link>
          ) : null}
        />

        <ListSearchBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search accounts…"
          total={total}
          totalLabel="accounts"
          filterTitle="Filter Accounts by"
          hasActiveFilters={countActiveFilters(filters) > 0}
          onClearFilters={() => { setFilters(EMPTY_ACCOUNT_FILTERS); setPage(1); }}
          filterFields={(
            <>
              <SelectFilter label="Industry" value={filters.industry} onChange={(v) => updateFilter('industry', v)} options={industryOptions} emptyLabel="All industries" />
              <TextFilter label="Website" value={filters.website} onChange={(v) => updateFilter('website', v)} />
              <TextFilter label="Email" value={filters.email} onChange={(v) => updateFilter('email', v)} />
              <SelectFilter label="Status" value={filters.status} onChange={(v) => updateFilter('status', v)} options={statusOptions} emptyLabel="All statuses" />
              <TextFilter label="City" value={filters.city} onChange={(v) => updateFilter('city', v)} />
              <OwnerFilter users={users} value={filters.owner_id} onChange={(v) => updateFilter('owner_id', v)} />
            </>
          )}
          table={(
            <RecordDataTable
              moduleKey="accounts"
              records={accounts}
              loading={loading}
              columns={columns}
              statusOptions={ACCOUNT_STATUS_OPTIONS}
              onRefresh={fetchAccounts}
              emptyMessage="No accounts found"
              pagination={{ page, totalPages, onPageChange: setPage, label: `Page ${page} of ${totalPages}` }}
            />
          )}
        />
      </div>
    </CRMLayout>
  );
}
