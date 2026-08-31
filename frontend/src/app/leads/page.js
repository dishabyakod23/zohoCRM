'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Badge from '../../components/ui/Badge.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import RecordDetailLink from '../../components/records/RecordDetailLink.js';
import { useToast } from '../../components/ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useListRefresh } from '../../hooks/useListRefresh.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import ListToolbar from '../../components/layout/ListToolbar.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import { LIST_VIEWS, DEFAULT_PAGE_SIZE } from '../../lib/constants.js';
import { PIPELINE_LEAD } from '../../lib/pipelineHelpers.js';
import * as leadsApi from '../../lib/services/leads.js';
import { normalizeLead, hasOutreachStatusLabel } from '../../lib/leadHelpers.js';
import { fetchLeadStatuses, FALLBACK_LEAD_STATUSES, fetchLeadMassUpdateFields, fetchPipelineConvertTargets, fetchUsers, fetchLeadSources } from '../../lib/services/lookups.js';
import PhoneCell from '../../components/cloudtalk/PhoneCell.js';
import { tableLinkClass, tableEmailClass } from '../../lib/tableStyles.js';
import { TextFilter, SelectFilter, OwnerFilter, CampaignFilter, CreatedUpdatedDateFilters } from '../../components/layout/ListFilterFields.js';
import { recordTimestampColumns } from '../../lib/listTimestampHelpers.js';
import { EMPTY_LEAD_FILTERS, countActiveFilters } from '../../lib/listRecordFilters.js';
import { useDefaultOwnerFilters } from '../../hooks/useDefaultOwnerFilters.js';
import { DEFAULT_LIST_SORT, getSortApiParams } from '../../lib/listSortHelpers.js';
import { useCampaignLookups } from '../../hooks/useCampaignLookups.js';
import { useCampaignMemberFilter } from '../../hooks/useCampaignMemberFilter.js';
import { useTableSelection } from '../../hooks/useTableSelection.js';
import { navigateToRecord } from '../../lib/recordNavigation.js';

export default function LeadsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { can, canAssignLeads } = usePermissions();
  const canCreate = can('leads', 'create');
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const { filters, setFilters, clearFilters } = useDefaultOwnerFilters(EMPTY_LEAD_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [activeView, setActiveView] = useState('All Warm Leads');
  const [statusOptions, setStatusOptions] = useState(FALLBACK_LEAD_STATUSES);
  const statusOptionsRef = useRef(FALLBACK_LEAD_STATUSES);
  const [sourceOptions, setSourceOptions] = useState([]);
  const [users, setUsers] = useState([]);
  const [sort, setSort] = useState(DEFAULT_LIST_SORT);
  const fetchRequestId = useRef(0);
  const { campaigns } = useCampaignLookups();
  const { memberIds: campaignMemberIds } = useCampaignMemberFilter(filters.campaign_id, 'lead');

  useEffect(() => {
    fetchLeadStatuses().then((options) => {
      statusOptionsRef.current = options;
      setStatusOptions(options);
      setLeads((prev) => prev.map((lead) => normalizeLead(lead, options)));
    }).catch(() => setStatusOptions(FALLBACK_LEAD_STATUSES));
    fetchLeadSources().then(setSourceOptions).catch(() => setSourceOptions([]));
    fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !canCreate) return;
    if (new URLSearchParams(window.location.search).get('create') === '1') {
      navigateToRecord('/leads/create');
    }
  }, [canCreate]);

  const fetchLeads = useCallback(async () => {
    const requestId = ++fetchRequestId.current;
    setLoading(true);
    try {
      const params = {
        page,
        page_size: limit,
        search: debouncedSearch || undefined,
        lead_status: filters.status || PIPELINE_LEAD,
        filters,
      };
      if (activeView === 'My Warm Leads' && user?.id) params.owner_id = user.id;
      const sortParams = activeView === 'Recently Modified'
        ? { sort_by: 'updated_at', sort_order: 'desc' }
        : getSortApiParams(sort, 'leads');
      Object.assign(params, sortParams);
      const result = await leadsApi.listLeads({
        ...params,
        statusOptions: statusOptionsRef.current,
        campaignMemberIds,
      });
      if (requestId !== fetchRequestId.current) return;
      setLeads(result.data);
      setTotal(result.total);
    } catch (err) {
      if (requestId !== fetchRequestId.current) return;
      showToast(getApiError(err));
      setLeads([]);
      setTotal(0);
    } finally {
      if (requestId === fetchRequestId.current) setLoading(false);
    }
  }, [page, limit, debouncedSearch, filters, activeView, user?.id, showToast, sort, campaignMemberIds]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useListRefresh(fetchLeads);

  const totalPages = Math.ceil(total / limit) || 1;

  const leadListParams = useMemo(() => {
    const params = {
      search: debouncedSearch || undefined,
      lead_status: filters.status || PIPELINE_LEAD,
      filters,
      campaignMemberIds,
      ...(activeView === 'Recently Modified'
        ? { sort_by: 'updated_at', sort_order: 'desc' }
        : getSortApiParams(sort, 'leads')),
    };
    if (activeView === 'My Warm Leads' && user?.id) params.owner_id = user.id;
    return params;
  }, [debouncedSearch, filters, activeView, user?.id, sort, campaignMemberIds]);

  const fetchAllMatchingLeadIds = useCallback(
    () => leadsApi.listAllMatchingLeadIds(leadListParams, statusOptionsRef.current),
    [leadListParams],
  );

  const tableSelection = useTableSelection({
    total,
    resetDeps: [activeView, debouncedSearch, filters, sort, campaignMemberIds],
    fetchAllIds: fetchAllMatchingLeadIds,
  });

  const loadMassUpdateFields = useCallback(
    () => fetchLeadMassUpdateFields({ canChangeOwner: canAssignLeads, moduleKey: 'leads' }),
    [canAssignLeads],
  );

  const columns = useMemo(() => [
    { id: 'name', header: 'Lead Name', cell: (lead) => <RecordDetailLink href={`/leads/${lead.id}`} className={tableLinkClass}>{lead.first_name} {lead.last_name}</RecordDetailLink> },
    { id: 'company', header: 'Company', cell: (lead) => lead.company || '—' },
    { id: 'email', header: 'Email', sortField: 'email', cell: (lead) => <span className={tableEmailClass}>{lead.email || '—'}</span> },
    { id: 'phone', header: 'Phone', cell: (lead) => <PhoneCell value={lead.phone} label="Call lead" /> },
    { id: 'source', header: 'Source', cell: (lead) => lead.source || '—' },
    { id: 'status', header: 'Status', cell: (lead) => (
      hasOutreachStatusLabel(lead.status) ? <Badge label={lead.status} /> : '—'
    ) },
    { id: 'owner', header: 'Owner', cell: (lead) => lead.owner_name || '—' },
    ...recordTimestampColumns(),
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Warm Leads"
          primaryAction={canCreate ? (
            <button type="button" onClick={() => navigateToRecord('/leads/create')} className="btn-primary-sm">
              Create Warm Lead
            </button>
          ) : null}
        />

        <ListToolbar
          moduleName="Warm Leads"
          total={total}
          views={LIST_VIEWS.leads}
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
          extraActions={(
            <select className="input w-28 text-xs" value={limit} onChange={(e) => { setLimit(+e.target.value); setPage(1); }}>
              {[10, 15, 25, 50].map((n) => <option key={n} value={n}>{n} per page</option>)}
            </select>
          )}
          table={(
            <RecordDataTable
              moduleKey="leads"
              records={leads}
              loading={loading}
              columns={columns}
              statusOptions={statusOptions}
              onRefresh={fetchLeads}
              emptyMessage="No leads found"
              sort={sort}
              onSortChange={(v) => { setSort(v); setPage(1); }}
              {...tableSelection}
              massUpdateFieldsLoader={loadMassUpdateFields}
              convertTargetsLoader={fetchPipelineConvertTargets}
              massUpdateHandler={(ids, field, value, extras) => leadsApi.applyLeadMassUpdate(ids, field, value, { ...extras, statusOptions: statusOptionsRef.current })}
              pagination={{
                page,
                totalPages,
                onPageChange: setPage,
                label: total ? `${((page - 1) * limit) + 1}–${Math.min(page * limit, total)} of ${total} records` : '0 records',
              }}
            />
          )}
        >
          <TextFilter label="Company" value={filters.company} onChange={(v) => { setFilters((f) => ({ ...f, company: v })); setPage(1); }} />
          <SelectFilter
            label="Source"
            value={filters.source}
            onChange={(v) => { setFilters((f) => ({ ...f, source: v })); setPage(1); }}
            options={sourceOptions}
            emptyLabel="All sources"
          />
          <SelectFilter
            label="Status"
            value={filters.status}
            onChange={(v) => { setFilters((f) => ({ ...f, status: v })); setPage(1); }}
            options={statusOptions.filter((s) => !['raw_prospect', 'qualified_lead', 'deal_lost'].includes(s.value))}
            emptyLabel="Active leads"
          />
          <CampaignFilter campaigns={campaigns} value={filters.campaign_id} onChange={(v) => { setFilters((f) => ({ ...f, campaign_id: v })); setPage(1); }} />
          <OwnerFilter users={users} value={filters.owner_id} onChange={(v) => { setFilters((f) => ({ ...f, owner_id: v })); setPage(1); }} />
          <CreatedUpdatedDateFilters
            filters={filters}
            onChange={(key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); }}
          />
        </ListToolbar>
      </div>
    </CRMLayout>
  );
}
