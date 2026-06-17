'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CRMLayout from '../../components/layout/CRMLayout.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { getApiError } from '../../lib/api.js';
import * as accountsApi from '../../lib/services/accounts.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';

const LIMIT = 15;

export default function AccountsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined' || !canEdit) return;
    if (new URLSearchParams(window.location.search).get('create') === '1') {
      router.replace('/accounts/create');
    }
  }, [canEdit, router]);

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
        <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-semibold shrink-0">{(a.name || '?')[0]}</div>
        <Link href={`/accounts/${a.id}`} className="font-medium text-brand-600 hover:text-brand-700">{a.name}</Link>
      </div>
    ) },
    { id: 'industry', header: 'Industry', cell: (a) => a.industry || '—' },
    { id: 'website', header: 'Website', cell: (a) => a.website ? <a href={a.website} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700 text-xs">{a.website.replace('https://', '')}</a> : '—' },
    { id: 'phone', header: 'Phone', cell: (a) => a.phone || '—' },
    { id: 'city', header: 'City', cell: (a) => a.city || '—' },
    { id: 'owner', header: 'Owner', cell: (a) => a.owner_name || '—' },
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div><h1 className="text-xl font-bold text-gray-900">Accounts</h1><p className="text-xs text-gray-500">{total} accounts</p></div>
          {canEdit && <Link href="/accounts/create" className="btn-primary">+ New account</Link>}
        </div>

        <div className="card">
          <div className="px-4 py-3 border-b border-zoho-border">
            <div className="relative max-w-xs">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zoho-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input className="input pl-8 py-1.5 text-xs" placeholder="Search accounts…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>
          <RecordDataTable
            moduleKey="accounts"
            records={accounts}
            loading={loading}
            columns={columns}
            onRefresh={fetchAccounts}
            emptyMessage="No accounts found"
            pagination={{ page, totalPages, onPageChange: setPage, label: `Page ${page} of ${totalPages}` }}
          />
        </div>
      </div>
    </CRMLayout>
  );
}
