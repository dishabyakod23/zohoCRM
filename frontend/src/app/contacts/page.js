'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
import { DEFAULT_PAGE_SIZE } from '../../lib/constants.js';
import * as contactDirectoryApi from '../../lib/services/contactDirectory.js';
import * as contactsApi from '../../lib/services/contacts.js';
import { fetchPeopleStatusOptions } from '../../lib/services/people.js';
import { fetchLeadStatuses, FALLBACK_LEAD_STATUSES, fetchPipelineConvertTargets } from '../../lib/services/lookups.js';
import { normalizeContact } from '../../lib/contactHelpers.js';
import { fetchCompanyLookups, accountMapFromLookups, fetchUsers } from '../../lib/services/lookups.js';
import PhoneCell from '../../components/cloudtalk/PhoneCell.js';
import LinkedInCell from '../../components/records/LinkedInCell.js';
import { tableLinkClass, tableEmailClass, tableAvatarClass } from '../../lib/tableStyles.js';
import { TextFilter, SelectFilter, OwnerFilter, CampaignFilter, DateFilter, CreatedUpdatedDateFilters } from '../../components/layout/ListFilterFields.js';
import { EMPTY_CONTACT_FILTERS, countActiveFilters, matchLeadStatus, hasTimestampFilters, applyContactDirectoryPostFetchFilters } from '../../lib/listRecordFilters.js';
import { recordTimestampColumns } from '../../lib/listTimestampHelpers.js';
import { DIRECTORY_STATUS_OPTIONS } from '../../lib/contactDirectoryHelpers.js';
import { outreachLeadStatusOptions } from '../../lib/pipelineHelpers.js';
import { useDefaultOwnerFilters } from '../../hooks/useDefaultOwnerFilters.js';
import { DEFAULT_LIST_SORT, getSortApiParams } from '../../lib/listSortHelpers.js';
import { useCampaignLookups } from '../../hooks/useCampaignLookups.js';
import { useCampaignMemberFilter } from '../../hooks/useCampaignMemberFilter.js';
import { useTableSelection } from '../../hooks/useTableSelection.js';
import { listCloudTalkCallsLastDays } from '../../lib/services/cloudTalkCalls.js';
import {
  enrichContactDirectoryRows,
  filterRowsByActivityDate,
} from '../../lib/contactActivityEnrichment.js';
import { buildOutreachActivityIndex, formatLinkedInRequestLabel, getLinkedInRequestSent } from '../../lib/outreachActivity.js';
import { navigateToRecord } from '../../lib/recordNavigation.js';

const LIMIT = DEFAULT_PAGE_SIZE;
const ACTIVITY_LOOKBACK_DAYS = 120;
/** Stable member types for directory campaign filter (avoids effect loops). */
const CONTACT_DIRECTORY_CAMPAIGN_MEMBER_TYPES = ['contact', 'lead'];

export default function ContactsPage() {
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
  const { filters, setFilters, clearFilters } = useDefaultOwnerFilters(EMPTY_CONTACT_FILTERS);
  const [users, setUsers] = useState([]);
  const [sort, setSort] = useState(DEFAULT_LIST_SORT);
  const [statusOptions, setStatusOptions] = useState(DIRECTORY_STATUS_OPTIONS);
  const [leadStatusOptions, setLeadStatusOptions] = useState(FALLBACK_LEAD_STATUSES);
  const leadStatusOptionsRef = useRef(FALLBACK_LEAD_STATUSES);
  const { campaigns } = useCampaignLookups();
  const {
    memberIds: campaignMemberIds,
    memberGroups: campaignMemberGroups,
    ready: campaignMembersReady,
  } = useCampaignMemberFilter(
    filters.campaign_id,
    CONTACT_DIRECTORY_CAMPAIGN_MEMBER_TYPES,
  );
  const activityCallsRef = useRef([]);
  const activityCallsLoadedRef = useRef(false);
  const fetchGenRef = useRef(0);
  const matchingIdsRef = useRef([]);

  const accountMap = useMemo(() => accountMapFromLookups(accounts), [accounts]);
  const accountMapRef = useRef(accountMap);
  accountMapRef.current = accountMap;

  const campaignMemberIdsKey = useMemo(() => {
    if (!campaignMemberIds) return '';
    return [...campaignMemberIds].sort().join(',');
  }, [campaignMemberIds]);

  useEffect(() => {
    fetchCompanyLookups().then((rows) => {
      setAccounts(rows);
      const map = accountMapFromLookups(rows);
      setContacts((prev) => prev.map((contact) => normalizeContact(contact, map)));
    }).catch(() => setAccounts([]));
    fetchUsers().then(setUsers).catch(() => setUsers([]));
    fetchPeopleStatusOptions().then(setStatusOptions).catch(() => setStatusOptions(DIRECTORY_STATUS_OPTIONS));
    fetchLeadStatuses().then((options) => {
      leadStatusOptionsRef.current = options;
      setLeadStatusOptions(options);
    }).catch(() => setLeadStatusOptions(FALLBACK_LEAD_STATUSES));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !canCreateContact) return;
    if (new URLSearchParams(window.location.search).get('create') === '1') {
      navigateToRecord('/contacts/create');
    }
  }, [canCreateContact]);

  const needsActivityData = Boolean(filters.activity_from || filters.activity_to);
  const needsNotesFilter = Boolean(filters.notes_q?.trim());
  const needsClientPagination = needsActivityData || needsNotesFilter || hasTimestampFilters(filters);

  const loadActivityCalls = useCallback(async () => {
    if (activityCallsLoadedRef.current && activityCallsRef.current.length) {
      return activityCallsRef.current;
    }
    try {
      const canSeeAll = isSuperAdmin || isSalesManager;
      const calls = await listCloudTalkCallsLastDays(ACTIVITY_LOOKBACK_DAYS, {
        ...(canSeeAll ? {} : { user_id: user?.id }),
      }, { limit: 500 });
      activityCallsRef.current = calls;
      activityCallsLoadedRef.current = true;
      return calls;
    } catch {
      activityCallsRef.current = [];
      activityCallsLoadedRef.current = true;
      return [];
    }
  }, [isSalesManager, isSuperAdmin, user?.id]);

  // Calls are matched to rows by phone number, so the list doesn't need the CRM-wide phone-name
  // lookup (it downloaded every contact, lead and account and slowed every filter change).
  const enrichRowsWithActivity = useCallback(async (rows) => {
    try {
      const calls = await loadActivityCalls();
      const outreachIndex = buildOutreachActivityIndex();
      return enrichContactDirectoryRows(rows, {
        calls,
        outreachIndex,
        statusOptions: leadStatusOptionsRef.current,
      });
    } catch {
      return rows;
    }
  }, [loadActivityCalls]);

  const loadMassUpdateFields = useCallback(async () => ([
    { value: 'lead_status', label: 'Lead Status' },
    { value: 'convert', label: 'Convert', type: 'convert' },
    { value: 'campaign', label: 'Campaign' },
    { value: 'linkedin_request_sent', label: 'LinkedIn Connection Sent' },
  ]), []);

  const fetchContacts = useCallback(async () => {
    if (filters.campaign_id && !campaignMembersReady) return;

    const gen = ++fetchGenRef.current;
    matchingIdsRef.current = [];
    setLoading(true);
    try {
      const directoryFilters = filters;

      const listParams = {
        search: debouncedSearch || undefined,
        filters: directoryFilters,
        campaignMemberIds,
        memberGroups: campaignMemberGroups,
        sort_key: sort,
        ...getSortApiParams(sort, 'contacts'),
      };
      const result = needsClientPagination
        ? await contactDirectoryApi.listContactDirectoryForClientFilters(listParams, accountMapRef.current)
        : await contactDirectoryApi.listContactDirectory({ ...listParams, page, page_size: LIMIT }, accountMapRef.current);

      if (gen !== fetchGenRef.current) return;

      let rows = result.data;

      if (directoryFilters.lead_status) {
        rows = rows.filter((row) => matchLeadStatus(row, directoryFilters.lead_status));
      }

      rows = applyContactDirectoryPostFetchFilters(rows, filters);

      if (needsClientPagination && needsActivityData) {
        // Activity dates need call history before rows can be filtered.
        const enrichedRows = await enrichRowsWithActivity(rows);
        if (gen !== fetchGenRef.current) return;
        const calls = activityCallsRef.current;
        const outreachIndex = buildOutreachActivityIndex();
        const filteredRows = filterRowsByActivityDate(enrichedRows, filters, { outreachIndex, calls });
        const start = (page - 1) * LIMIT;
        matchingIdsRef.current = filteredRows.map((row) => row.id).filter(Boolean);
        setTotal(matchingIdsRef.current.length);
        setContacts(filteredRows.slice(start, start + LIMIT));
      } else if (needsClientPagination) {
        // Date/notes filters are already applied: show the page now, add call info after.
        const start = (page - 1) * LIMIT;
        const pageRows = rows.slice(start, start + LIMIT);
        matchingIdsRef.current = rows.map((row) => row.id).filter(Boolean);
        setTotal(matchingIdsRef.current.length);
        setContacts(enrichContactDirectoryRows(pageRows, {
          calls: activityCallsRef.current || [],
          outreachIndex: buildOutreachActivityIndex(),
          statusOptions: leadStatusOptionsRef.current,
        }));
        enrichRowsWithActivity(pageRows).then((enriched) => {
          if (gen !== fetchGenRef.current) return;
          setContacts(enriched);
        }).catch(() => {});
      } else {
        const syncEnriched = enrichContactDirectoryRows(rows, {
          calls: activityCallsRef.current || [],
          outreachIndex: buildOutreachActivityIndex(),
          statusOptions: leadStatusOptionsRef.current,
        });
        setContacts(syncEnriched);
        matchingIdsRef.current = [];
        setTotal(result.total);
        enrichRowsWithActivity(rows).then((enriched) => {
          if (gen !== fetchGenRef.current) return;
          setContacts((current) => {
            if (current.length !== enriched.length) return current;
            const currentIds = current.map((row) => row.id).join('|');
            const enrichedIds = enriched.map((row) => row.id).join('|');
            return currentIds === enrichedIds ? enriched : current;
          });
        }).catch(() => {});
      }
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      showToast(getApiError(err));
      setContacts([]);
      setTotal(0);
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [
    page,
    debouncedSearch,
    showToast,
    filters,
    sort,
    campaignMemberIds,
    campaignMemberIdsKey,
    campaignMemberGroups,
    campaignMembersReady,
    needsClientPagination,
    enrichRowsWithActivity,
  ]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);
  useListRefresh(fetchContacts);

  const initials = (c) => `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase();
  const totalPages = Math.ceil(total / LIMIT) || 1;

  const contactListParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    sort_by: getSortApiParams(sort, 'contacts').sort_by,
    sort_order: getSortApiParams(sort, 'contacts').sort_order,
    filters,
    campaignMemberIds,
    memberGroups: campaignMemberGroups,
  }), [debouncedSearch, sort, filters, campaignMemberIdsKey, campaignMemberGroups]);

  const fetchAllMatchingContactIds = useCallback(async () => {
    if (needsClientPagination && matchingIdsRef.current.length) {
      return matchingIdsRef.current.slice();
    }
    const activityCtx = {};
    if (filters.activity_from || filters.activity_to) {
      activityCtx.calls = await loadActivityCalls();
      activityCtx.outreachIndex = buildOutreachActivityIndex();
    }
    return contactDirectoryApi.listAllMatchingContactDirectoryIds(
      contactListParams,
      accountMapRef.current,
      leadStatusOptionsRef.current,
      activityCtx,
    );
  }, [contactListParams, filters.activity_from, filters.activity_to, loadActivityCalls, needsClientPagination]);

  const tableSelection = useTableSelection({
    total,
    resetDeps: [debouncedSearch, filters, sort, campaignMemberIdsKey],
    fetchAllIds: fetchAllMatchingContactIds,
  });

  const columns = useMemo(() => [
    { id: 'contact', header: 'Contact Name', cell: (c) => (
      <div className="flex items-center gap-2.5">
        <div className={tableAvatarClass}>{initials(c)}</div>
        <RecordDetailLink href={c._detailHref || `/contacts/${c.record_id || c.id}`} className={tableLinkClass}>{c.first_name} {c.last_name}</RecordDetailLink>
      </div>
    ) },
    { id: 'title', header: 'Designation', cell: (c) => (
      <span className="block max-w-[10rem] truncate" title={c.title || ''}>{c.title || '—'}</span>
    ) },
    { id: 'company', header: 'Company', cell: (c) => c.account_name || '—' },
    { id: 'status', header: 'Current Status', cell: (c) => c.current_status || '—' },
    { id: 'lead_status', header: 'Lead Status', cell: (c) => c.lead_status_label || '—' },
    { id: 'email', header: 'Email', sortField: 'email', cell: (c) => <span className={tableEmailClass}>{c.email || '—'}</span> },
    { id: 'phone', header: 'Phone', cell: (c) => <PhoneCell value={c.phone || c.mobile} label="Call contact" /> },
    { id: 'linkedin_url', header: 'LinkedIn', cell: (c) => <LinkedInCell value={c.skype_id || c.linkedin_url || c.linkedin} record={c} /> },
    { id: 'last_call', header: 'Last Call', cell: (c) => (
      <span className="text-xs text-zoho-text whitespace-nowrap">{c.last_call_label || '—'}</span>
    ) },
    { id: 'linkedin', header: 'LinkedIn Request', cell: (c) => {
      const recordId = c.record_id || String(c.id || '').split(':').pop();
      const entry = (c.linkedin_request_sent_at
        ? { sent_at: c.linkedin_request_sent_at }
        : null) || getLinkedInRequestSent(recordId);
      return (
        <span className="text-xs">{formatLinkedInRequestLabel(entry)}</span>
      );
    } },
    { id: 'campaign', header: 'Campaign', cell: (c) => c.campaign_name || '—' },
    { id: 'owner', header: 'Owner', cell: (c) => c.owner_name || '—' },
    ...recordTimestampColumns(),
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Contacts"
          secondaryActions={canImportContacts ? <BulkUpload onDone={fetchContacts} /> : null}
          primaryAction={canCreateContact ? (
            <button type="button" onClick={() => navigateToRecord('/contacts/create')} className="btn-primary-sm">
              Create Contact
            </button>
          ) : null}
        />

        <ListToolbar
          moduleName="Contacts"
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
              moduleKey="contacts"
              records={contacts}
              loading={loading}
              columns={columns}
              statusOptions={outreachLeadStatusOptions(leadStatusOptions)}
              onRefresh={fetchContacts}
              emptyMessage="No contacts found"
              sort={sort}
              onSortChange={(v) => { setSort(v); setPage(1); }}
              {...tableSelection}
              massUpdateFieldsLoader={loadMassUpdateFields}
              convertTargetsLoader={fetchPipelineConvertTargets}
              massUpdateHandler={(ids, field, value, extras) => contactsApi.applyContactDirectoryMassUpdate(ids, field, value, {
                ...extras,
                statusOptions: leadStatusOptionsRef.current,
              })}
              pagination={{ page, totalPages, onPageChange: setPage, label: `Page ${page} of ${totalPages}` }}
            />
          )}
        >
          <TextFilter label="Company" value={filters.company} onChange={(v) => { setFilters((f) => ({ ...f, company: v })); setPage(1); }} />
          <TextFilter label="Designation" value={filters.designation} onChange={(v) => { setFilters((f) => ({ ...f, designation: v })); setPage(1); }} />
          <TextFilter
            label="Notes / Follow-up"
            value={filters.notes_q}
            onChange={(v) => { setFilters((f) => ({ ...f, notes_q: v })); setPage(1); }}
            placeholder="e.g. follow up next week"
          />
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
            options={outreachLeadStatusOptions(leadStatusOptions)}
            emptyLabel="All lead statuses"
          />
          <DateFilter label="Activity from" value={filters.activity_from} onChange={(v) => { setFilters((f) => ({ ...f, activity_from: v })); setPage(1); }} />
          <DateFilter label="Activity to" value={filters.activity_to} onChange={(v) => { setFilters((f) => ({ ...f, activity_to: v })); setPage(1); }} />
          <CreatedUpdatedDateFilters
            filters={filters}
            onChange={(key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); }}
          />
          <CampaignFilter
            campaigns={campaigns}
            value={filters.campaign_id}
            onChange={(v) => {
              // Campaign membership is across owners — clear default "My records" owner scope.
              setFilters((f) => ({ ...f, campaign_id: v, ...(v ? { owner_id: '' } : {}) }));
              setPage(1);
            }}
          />
          <OwnerFilter users={users} value={filters.owner_id} onChange={(v) => { setFilters((f) => ({ ...f, owner_id: v })); setPage(1); }} />
        </ListToolbar>
      </div>
    </CRMLayout>
  );
}
