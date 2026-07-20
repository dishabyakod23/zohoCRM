'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CRMLayout from '../../components/layout/CRMLayout.js';
import BulkUpload from '../../components/records/BulkUpload.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import { useToast } from '../../components/ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { getApiError } from '../../lib/api.js';
import ListToolbar from '../../components/layout/ListToolbar.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import { LIST_VIEWS, DEFAULT_PAGE_SIZE } from '../../lib/constants.js';
import * as contactsApi from '../../lib/services/contacts.js';
import { filterUnreadRecords } from '../../lib/recordViewTracker.js';
import { fetchAccountLookups, accountMapFromLookups, fetchUsers } from '../../lib/services/lookups.js';
import PhoneCell from '../../components/cloudtalk/PhoneCell.js';
import { tableLinkClass, tableEmailClass, tableAvatarClass } from '../../lib/tableStyles.js';
import { TextFilter, OwnerFilter } from '../../components/layout/ListFilterFields.js';
import { EMPTY_CONTACT_FILTERS, countActiveFilters } from '../../lib/listRecordFilters.js';
import { DEFAULT_LIST_SORT, getSortApiParams, sortRecords } from '../../lib/listSortHelpers.js';

const LIMIT = DEFAULT_PAGE_SIZE;

export default function ContactsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { canEdit } = usePermissions();
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [activeView, setActiveView] = useState('All Contacts');
  const [filters, setFilters] = useState(EMPTY_CONTACT_FILTERS);
  const [users, setUsers] = useState([]);
  const [sort, setSort] = useState(DEFAULT_LIST_SORT);

  const accountMap = useMemo(() => accountMapFromLookups(accounts), [accounts]);

  useEffect(() => {
    fetchAccountLookups().then(setAccounts).catch(() => setAccounts([]));
    fetchUsers().then(setUsers).catch(() => setUsers([]));
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
      const isUnreadView = activeView === 'Unread Contacts';
      const params = {
        page: isUnreadView ? 1 : page,
        page_size: isUnreadView ? DEFAULT_PAGE_SIZE : LIMIT,
        search: debouncedSearch || undefined,
      };
      if (activeView === 'My Contacts' && user?.id) params.owner_id = user.id;
      Object.assign(params, getSortApiParams(sort, 'contacts'));
      if (activeView !== 'My Contacts') {
        params.filters = filters;
      }
      const result = isUnreadView
        ? await contactsApi.listAllContacts({
          search: params.search,
          owner_id: params.owner_id,
          sort_by: params.sort_by,
          sort_order: params.sort_order,
        }, accountMap)
        : await contactsApi.listContacts(params, accountMap);
      if (isUnreadView) {
        const unread = sortRecords(filterUnreadRecords(result.data, 'contact'), sort, 'contacts');
        const start = (page - 1) * LIMIT;
        setContacts(unread.slice(start, start + LIMIT));
        setTotal(unread.length);
      } else {
        setContacts(result.data);
        setTotal(result.total);
      }
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, accountMap, showToast, activeView, user?.id, filters, sort]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const initials = (c) => `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase();
  const totalPages = Math.ceil(total / LIMIT) || 1;

  const columns = useMemo(() => [
    { id: 'contact', header: 'Contact', cell: (c) => (
      <div className="flex items-center gap-2.5">
        <div className={tableAvatarClass}>{initials(c)}</div>
        <Link href={`/contacts/${c.id}`} className={tableLinkClass}>{c.first_name} {c.last_name}</Link>
      </div>
    ) },
    { id: 'title', header: 'Designation', cell: (c) => c.title || '—' },
    { id: 'company', header: 'Company', cell: (c) => c.account_name || '—' },
    { id: 'email', header: 'Email', cell: (c) => <span className={tableEmailClass}>{c.email || '—'}</span> },
    { id: 'phone', header: 'Phone', cell: (c) => <PhoneCell value={c.phone} label="Call contact" /> },
    { id: 'owner', header: 'Owner', cell: (c) => c.owner_name || '—' },
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Contacts"
          subtitle="People linked to your accounts and deals."
          secondaryActions={canEdit ? <BulkUpload onDone={fetchContacts} /> : null}
          primaryAction={canEdit ? (
            <button type="button" onClick={() => router.push('/contacts/create')} className="btn-primary-sm">
              Create Contact
            </button>
          ) : null}
        />

        <ListToolbar
          moduleName="Contacts"
          total={total}
          views={LIST_VIEWS.contacts}
          activeView={activeView}
          onViewChange={(v) => {
            setActiveView(v);
            setPage(1);
            if (v === 'Recently Created') setSort('created_desc');
          }}
          searchValue={search}
          onSearch={(v) => { setSearch(v); setPage(1); }}
          sort={sort}
          onSortChange={(v) => { setSort(v); setPage(1); }}
          hasActiveFilters={countActiveFilters(filters) > 0}
          onClearFilters={() => { setFilters(EMPTY_CONTACT_FILTERS); setPage(1); }}
          table={(
            <RecordDataTable
              moduleKey="contacts"
              records={contacts}
              loading={loading}
              columns={columns}
              onRefresh={fetchContacts}
              emptyMessage="No contacts found"
              pagination={{ page, totalPages, onPageChange: setPage, label: `Page ${page} of ${totalPages}` }}
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
