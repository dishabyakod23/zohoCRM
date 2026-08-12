'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CRMLayout from '../../components/layout/CRMLayout.js';
import BulkUpload from '../../components/records/BulkUpload.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import RecordDetailLink from '../../components/records/RecordDetailLink.js';
import { useToast } from '../../components/ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useListRefresh } from '../../hooks/useListRefresh.js';
import { getApiError } from '../../lib/api.js';
import ListToolbar from '../../components/layout/ListToolbar.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import { LIST_VIEWS, DEFAULT_PAGE_SIZE } from '../../lib/constants.js';
import * as contactDirectoryApi from '../../lib/services/contactDirectory.js';
import { fetchPeopleStatusOptions } from '../../lib/services/people.js';
import { fetchLeadStatuses, FALLBACK_LEAD_STATUSES } from '../../lib/services/lookups.js';
import { normalizeContact } from '../../lib/contactHelpers.js';
import { fetchCompanyLookups, accountMapFromLookups, fetchUsers } from '../../lib/services/lookups.js';
import PhoneCell from '../../components/cloudtalk/PhoneCell.js';
import { tableLinkClass, tableEmailClass, tableAvatarClass } from '../../lib/tableStyles.js';
import { TextFilter, SelectFilter, OwnerFilter, CampaignFilter, DateFilter, CreatedUpdatedDateFilters } from '../../components/layout/ListFilterFields.js';
import { EMPTY_CONTACT_FILTERS, countActiveFilters, matchLeadStatus, hasTimestampFilters, matchesRecordTimestampFilters } from '../../lib/listRecordFilters.js';
import { recordTimestampColumns } from '../../lib/listTimestampHelpers.js';
import { DIRECTORY_STATUS_OPTIONS } from '../../lib/contactDirectoryHelpers.js';
import { useDefaultOwnerFilters } from '../../hooks/useDefaultOwnerFilters.js';
import { DEFAULT_LIST_SORT, getSortApiParams } from '../../lib/listSortHelpers.js';
import { useCampaignLookups } from '../../hooks/useCampaignLookups.js';
import { useCampaignMemberFilter } from '../../hooks/useCampaignMemberFilter.js';
import { useTableSelection } from '../../hooks/useTableSelection.js';
import { listCloudTalkCallsLastDays } from '../../lib/services/cloudTalkCalls.js';
import { getCrmPhoneLookup, enrichActivityLogsWithPhoneNames } from '../../lib/services/phoneDirectory.js';
import {
  enrichContactDirectoryRows,
  filterRowsByActivityDate,
} from '../../lib/contactActivityEnrichment.js';
import { buildOutreachActivityIndex, formatLinkedInRequestLabel } from '../../lib/outreachActivity.js';

const LIMIT = DEFAULT_PAGE_SIZE;
const ACTIVITY_LOOKBACK_DAYS = 120;

export default function ContactsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { can, isSuperAdmin, isSalesManager } = usePermissions();
  const canCreateContact = can('contacts', 'create');
  const canImportContacts = can('contacts', 'import');
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [activeView, setActiveView] = useState('All Contacts');
  const { filters, setFilters, clearFilters } = useDefaultOwnerFilters(EMPTY_CONTACT_FILTERS);
  const [users, setUsers] = useState([]);
  const [sort, setSort] = useState(DEFAULT_LIST_SORT);
  const [statusOptions, setStatusOptions] = useState(DIRECTORY_STATUS_OPTIONS);
  const [leadStatusOptions, setLeadStatusOptions] = useState(FALLBACK_LEAD_STATUSES);
  const { campaigns } = useCampaignLookups();
  const campaignMemberIds = useCampaignMemberFilter(filters.campaign_id, 'contact');
  const activityCallsRef = useRef([]);

  const accountMap = useMemo(() => accountMapFromLookups(accounts), [accounts]);
  const accountMapRef = useRef(accountMap);
  accountMapRef.current = accountMap;

  useEffect(() => {
    fetchCompanyLookups().then((rows) => {
      setAccounts(rows);
      const map = accountMapFromLookups(rows);
      setContacts((prev) => prev.map((contact) => normalizeContact(contact, map)));
    }).catch(() => setAccounts([]));
    fetchUsers().then(setUsers).catch(() => setUsers([]));
    fetchPeopleStatusOptions().then(setStatusOptions).catch(() => setStatusOptions(DIRECTORY_STATUS_OPTIONS));
    fetchLeadStatuses().then(setLeadStatusOptions).catch(() => setLeadStatusOptions(FALLBACK_LEAD_STATUSES));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !canCreateContact) return;
    if (new URLSearchParams(window.location.search).get('create') === '1') {
      router.replace('/contacts/create');
    }
  }, [canCreateContact, router]);

  const loadActivityCalls = useCallback(async () => {
    try {
      const canSeeAll = isSuperAdmin || isSalesManager;
      const calls = await listCloudTalkCallsLastDays(ACTIVITY_LOOKBACK_DAYS, {
        ...(canSeeAll ? {} : { user_id: user?.id }),
      }, { limit: 500 });
      activityCallsRef.current = calls;
      return calls;
    } catch {
      activityCallsRef.current = [];
      return [];
    }
  }, [isSalesManager, isSuperAdmin, user?.id]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const directoryFilters = activeView === 'My Contacts' && user?.id
        ? { ...filters, owner_id: user.id }
        : filters;
      const [result, calls] = await Promise.all([
        contactDirectoryApi.listContactDirectory({
          page: 1,
          page_size: filters.activity_from || filters.activity_to || hasTimestampFilters(filters) ? 100000 : LIMIT,
          search: debouncedSearch || undefined,
          filters: directoryFilters,
          campaignMemberIds,
          sort_key: sort,
          ...getSortApiParams(sort, 'contacts'),
        }, accountMapRef.current),
        loadActivityCalls(),
      ]);

      let enrichedCalls = calls;
      try {
        const lookup = await getCrmPhoneLookup();
        enrichedCalls = enrichActivityLogsWithPhoneNames(calls, lookup);
      } catch {
        enrichedCalls = calls;
      }

      const outreachIndex = buildOutreachActivityIndex();
      let rows = enrichContactDirectoryRows(result.data, {
        calls: enrichedCalls,
        outreachIndex,
        statusOptions: leadStatusOptions,
      });

      if (directoryFilters.lead_status) {
        rows = rows.filter((row) => matchLeadStatus(row, directoryFilters.lead_status));
      }

      if (hasTimestampFilters(filters)) {
        rows = rows.filter((row) => matchesRecordTimestampFilters(row, filters));
      }

      const needsClientPagination = filters.activity_from || filters.activity_to || hasTimestampFilters(filters);
      if (needsClientPagination) {
        if (filters.activity_from || filters.activity_to) {
          rows = filterRowsByActivityDate(rows, filters, { outreachIndex, calls: enrichedCalls });
        }
        const start = (page - 1) * LIMIT;
        setTotal(rows.length);
        setContacts(rows.slice(start, start + LIMIT));
      } else {
        setContacts(rows);
        setTotal(result.total);
      }
    } catch (err) {
      showToast(getApiError(err));
      setContacts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    debouncedSearch,
    showToast,
    activeView,
    user?.id,
    filters,
    sort,
    campaignMemberIds,
    loadActivityCalls,
    leadStatusOptions,
  ]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);
  useListRefresh(fetchContacts);

  const initials = (c) => `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase();
  const totalPages = Math.ceil(total / LIMIT) || 1;

  const contactListParams = useMemo(() => {
    const params = {
      search: debouncedSearch || undefined,
      sort_by: getSortApiParams(sort, 'contacts').sort_by,
      sort_order: getSortApiParams(sort, 'contacts').sort_order,
      filters: activeView === 'My Contacts' && user?.id
        ? { ...filters, owner_id: user.id }
        : filters,
      campaignMemberIds,
    };
    if (activeView === 'My Contacts' && user?.id) params.owner_id = user.id;
    return params;
  }, [debouncedSearch, sort, activeView, user?.id, filters, campaignMemberIds]);

  const fetchAllMatchingContactIds = useCallback(
    () => contactDirectoryApi.listAllMatchingContactDirectoryIds(contactListParams, accountMapRef.current),
    [contactListParams],
  );

  const tableSelection = useTableSelection({
    total,
    resetDeps: [activeView, debouncedSearch, filters, sort, campaignMemberIds],
    fetchAllIds: fetchAllMatchingContactIds,
  });

  const columns = useMemo(() => [
    { id: 'contact', header: 'Contact Name', cell: (c) => (
      <div className="flex items-center gap-2.5">
        <div className={tableAvatarClass}>{initials(c)}</div>
        <RecordDetailLink href={c._detailHref || `/contacts/${c.id}`} className={tableLinkClass}>{c.first_name} {c.last_name}</RecordDetailLink>
      </div>
    ) },
    { id: 'title', header: 'Designation', cell: (c) => c.title || '—' },
    { id: 'company', header: 'Company', cell: (c) => c.account_name || '—' },
    { id: 'status', header: 'Current Status', cell: (c) => c.current_status || '—' },
    { id: 'lead_status', header: 'Lead Status', cell: (c) => c.lead_status_label || '—' },
    { id: 'email', header: 'Email', sortField: 'email', cell: (c) => <span className={tableEmailClass}>{c.email || '—'}</span> },
    { id: 'phone', header: 'Phone', cell: (c) => <PhoneCell value={c.phone || c.mobile} label="Call contact" /> },
    { id: 'last_call', header: 'Last Call', cell: (c) => (
      <span className="text-xs text-zoho-text whitespace-nowrap">{c.last_call_label || '—'}</span>
    ) },
    { id: 'linkedin', header: 'LinkedIn Request', cell: (c) => (
      <span className="text-xs">{formatLinkedInRequestLabel(c.linkedin_request_sent_at ? { sent_at: c.linkedin_request_sent_at } : null)}</span>
    ) },
    { id: 'campaign', header: 'Campaign', cell: (c) => c.campaign_name || '—' },
    { id: 'owner', header: 'Owner', cell: (c) => c.owner_name || '—' },
    ...recordTimestampColumns(),
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Contacts"
          subtitle="Central pool of all people in the CRM — contacts, pipeline leads, deals, and accounts."
          secondaryActions={canImportContacts ? <BulkUpload onDone={fetchContacts} /> : null}
          primaryAction={canCreateContact ? (
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
          hasActiveFilters={countActiveFilters(filters, user) > 0}
          onClearFilters={() => { clearFilters(); setPage(1); }}
          table={(
            <RecordDataTable
              moduleKey="contacts"
              records={contacts}
              loading={loading}
              columns={columns}
              statusOptions={leadStatusOptions}
              onRefresh={fetchContacts}
              emptyMessage="No contacts found"
              sort={sort}
              onSortChange={(v) => { setSort(v); setPage(1); }}
              {...tableSelection}
              pagination={{ page, totalPages, onPageChange: setPage, label: `Page ${page} of ${totalPages}` }}
            />
          )}
        >
          <TextFilter label="Company" value={filters.company} onChange={(v) => { setFilters((f) => ({ ...f, company: v })); setPage(1); }} />
          <TextFilter label="Designation" value={filters.designation} onChange={(v) => { setFilters((f) => ({ ...f, designation: v })); setPage(1); }} />
          <SelectFilter
            label="Current Status"
            value={filters.current_status}
            onChange={(v) => { setFilters((f) => ({ ...f, current_status: v })); setPage(1); }}
            options={statusOptions}
            emptyLabel="All statuses"
          />
          <SelectFilter
            label="Lead Status"
            value={filters.lead_status}
            onChange={(v) => { setFilters((f) => ({ ...f, lead_status: v })); setPage(1); }}
            options={leadStatusOptions}
            emptyLabel="All lead statuses"
          />
          <DateFilter label="Activity from" value={filters.activity_from} onChange={(v) => { setFilters((f) => ({ ...f, activity_from: v })); setPage(1); }} />
          <DateFilter label="Activity to" value={filters.activity_to} onChange={(v) => { setFilters((f) => ({ ...f, activity_to: v })); setPage(1); }} />
          <CreatedUpdatedDateFilters
            filters={filters}
            onChange={(key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); }}
          />
          <CampaignFilter campaigns={campaigns} value={filters.campaign_id} onChange={(v) => { setFilters((f) => ({ ...f, campaign_id: v })); setPage(1); }} />
          <OwnerFilter users={users} value={filters.owner_id} onChange={(v) => { setFilters((f) => ({ ...f, owner_id: v })); setPage(1); }} />
        </ListToolbar>
      </div>
    </CRMLayout>
  );
}
