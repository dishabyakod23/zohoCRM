'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CRMLayout from '../../components/layout/CRMLayout.js';
import BulkUpload from '../../components/records/BulkUpload.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { getApiError } from '../../lib/api.js';
import * as contactsApi from '../../lib/services/contacts.js';
import { fetchAccountLookups, accountMapFromLookups } from '../../lib/services/lookups.js';

const LIMIT = 15;

export default function ContactsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);

  const accountMap = useMemo(() => accountMapFromLookups(accounts), [accounts]);

  useEffect(() => {
    fetchAccountLookups().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !canEdit) return;
    if (new URLSearchParams(window.location.search).get('create') === '1') {
      router.replace('/contacts/create');
    }
  }, [canEdit, router]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await contactsApi.listContacts({
        page,
        page_size: LIMIT,
        search: debouncedSearch || undefined,
      }, accountMap);
      setContacts(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, accountMap, showToast]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const initials = (c) => `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase();
  const totalPages = Math.ceil(total / LIMIT) || 1;

  const columns = useMemo(() => [
    { id: 'contact', header: 'Contact', cell: (c) => (
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0">{initials(c)}</div>
        <Link href={`/contacts/${c.id}`} className="font-medium text-brand-600 hover:text-brand-700">{c.first_name} {c.last_name}</Link>
      </div>
    ) },
    { id: 'title', header: 'Title', cell: (c) => c.title || '—' },
    { id: 'company', header: 'Company', cell: (c) => c.account_name || '—' },
    { id: 'email', header: 'Email', cell: (c) => <span className="text-brand-600">{c.email || '—'}</span> },
    { id: 'phone', header: 'Phone', cell: (c) => c.phone || '—' },
    { id: 'owner', header: 'Owner', cell: (c) => c.owner_name || '—' },
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div><h1 className="text-xl font-bold text-gray-900">Contacts</h1><p className="text-xs text-gray-500">{total} contacts</p></div>
          <div className="flex gap-2">
            <BulkUpload onDone={fetchContacts} />
            {canEdit && <Link href="/contacts/create" className="btn-primary">+ New contact</Link>}
          </div>
        </div>

        <div className="card">
          <div className="px-4 py-3 border-b border-zoho-border">
            <div className="relative max-w-xs">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zoho-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input className="input pl-8 py-1.5 text-xs" placeholder="Search contacts…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>

          <RecordDataTable
            moduleKey="contacts"
            records={contacts}
            loading={loading}
            columns={columns}
            onRefresh={fetchContacts}
            emptyMessage="No contacts found"
            pagination={{ page, totalPages, onPageChange: setPage, label: `Page ${page} of ${totalPages}` }}
          />
        </div>
      </div>
    </CRMLayout>
  );
}
