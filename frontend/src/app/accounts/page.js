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
import { ACCOUNT_TYPES } from '../../lib/constants.js';
import { tableLinkClass, tableEmailClass, tableAvatarSmClass } from '../../lib/tableStyles.js';

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

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await accountsApi.listAccounts({
        page,
        page_size: LIMIT,
        search: debouncedSearch || undefined,
      });
      setAccounts(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, showToast]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const columns = useMemo(() => [
    { id: 'name', header: 'Company', cell: (a) => (
      <div className="flex items-center gap-2.5">
        <div className={tableAvatarSmClass}>{(a.name || '?')[0]}</div>
        <Link href={`/accounts/${a.id}`} className={tableLinkClass}>{a.name}</Link>
      </div>
    ) },
    { id: 'industry', header: 'Industry', cell: (a) => a.industry || '—' },
    { id: 'website', header: 'Website', cell: (a) => a.website ? <a href={a.website} target="_blank" rel="noreferrer" className={`${tableEmailClass} text-xs hover:text-zoho-text hover:underline`}>{a.website.replace('https://', '')}</a> : '—' },
    { id: 'phone', header: 'Phone', cell: (a) => a.phone || '—' },
    { id: 'status', header: 'Status', cell: (a) => <Badge label={a.account_type || '—'} /> },
    { id: 'city', header: 'City', cell: (a) => a.city || '—' },
    { id: 'owner', header: 'Owner', cell: (a) => a.owner_name || '—' },
  ], []);

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
        />

        <div className="card">
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
        </div>
      </div>
    </CRMLayout>
  );
}
