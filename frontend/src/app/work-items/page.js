'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Badge from '../../components/ui/Badge.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import { useToast } from '../../components/ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import ListToolbar from '../../components/layout/ListToolbar.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import { WORK_ITEM_VIEWS } from '../../lib/constants.js';
import {
  PIPELINE_RAW,
  PIPELINE_LEAD,
  PIPELINE_QUALIFIED,
  PIPELINE_PROPOSAL,
  getLeadDetailPath,
} from '../../lib/pipelineHelpers.js';
import * as leadsApi from '../../lib/services/leads.js';
import { fetchLeadMassUpdateFields, fetchPipelineConvertTargets, FALLBACK_LEAD_STATUSES, fetchLeadSources } from '../../lib/services/lookups.js';
import { tableLinkClass, tableEmailClass } from '../../lib/tableStyles.js';
import { TextFilter, SelectFilter } from '../../components/layout/ListFilterFields.js';
import { EMPTY_LEAD_FILTERS, countActiveFilters } from '../../lib/listRecordFilters.js';

const STAGE_BY_VIEW = {
  'All Work Items': null,
  'Raw Leads': PIPELINE_RAW,
  Leads: PIPELINE_LEAD,
  'Qualified Leads': PIPELINE_QUALIFIED,
  Proposals: PIPELINE_PROPOSAL,
};

export default function WorkItemsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { canAssignLeads } = usePermissions();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [filters, setFilters] = useState(EMPTY_LEAD_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [activeView, setActiveView] = useState('All Work Items');
  const [statusOptions, setStatusOptions] = useState(FALLBACK_LEAD_STATUSES);
  const [sourceOptions, setSourceOptions] = useState([]);
  const fetchRequestId = useRef(0);

  useEffect(() => {
    fetchLeadSources().then(setSourceOptions).catch(() => setSourceOptions([]));
  }, []);

  const fetchWorkItems = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const requestId = ++fetchRequestId.current;
    setLoading(true);
    try {
      const result = await leadsApi.listWorkItems({
        userId: user.id,
        page,
        page_size: limit,
        search: debouncedSearch || undefined,
        pipeline_stage: STAGE_BY_VIEW[activeView] || undefined,
        filters,
        statusOptions,
      });
      if (requestId !== fetchRequestId.current) return;
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      if (requestId !== fetchRequestId.current) return;
      showToast(getApiError(err));
    } finally {
      if (requestId === fetchRequestId.current) setLoading(false);
    }
  }, [user?.id, page, limit, debouncedSearch, filters, activeView, showToast, statusOptions]);

  useEffect(() => { fetchWorkItems(); }, [fetchWorkItems]);

  const totalPages = Math.ceil(total / limit) || 1;

  const loadMassUpdateFields = useCallback(
    () => fetchLeadMassUpdateFields({ canChangeOwner: canAssignLeads }),
    [canAssignLeads],
  );

  const columns = useMemo(() => [
    {
      id: 'name',
      header: 'Lead Name',
      cell: (lead) => (
        <Link href={getLeadDetailPath(lead, lead.id)} className={tableLinkClass}>
          {lead.first_name} {lead.last_name}
        </Link>
      ),
    },
    { id: 'company', header: 'Company', cell: (lead) => lead.company || '—' },
    { id: 'email', header: 'Email', cell: (lead) => <span className={tableEmailClass}>{lead.email || '—'}</span> },
    { id: 'source', header: 'Source', cell: (lead) => lead.source || '—' },
    { id: 'status', header: 'Status', cell: (lead) => <Badge label={lead.status} /> },
    {
      id: 'updated',
      header: 'Last Updated',
      cell: (lead) => (lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : '—'),
    },
  ], []);

  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'you';

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Work Items"
          subtitle={`Leads assigned to ${userName} across every pipeline stage.`}
        />

        <ListToolbar
          moduleName="work items"
          total={total}
          views={WORK_ITEM_VIEWS}
          activeView={activeView}
          onViewChange={(v) => { setActiveView(v); setPage(1); }}
          searchValue={search}
          onSearch={(v) => { setSearch(v); setPage(1); }}
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
            options={statusOptions}
            emptyLabel="All statuses"
          />
          <select className="input w-28 text-xs" value={limit} onChange={(e) => { setLimit(+e.target.value); setPage(1); }}>
            {[10, 15, 25, 50].map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
          {countActiveFilters(filters) > 0 && (
            <button type="button" onClick={() => { setFilters(EMPTY_LEAD_FILTERS); setPage(1); }} className="btn-secondary text-xs py-1.5">
              Clear filters
            </button>
          )}
        </ListToolbar>

        <div className="card rounded-tl-none rounded-tr-none border-t-0 mb-4">
          <RecordDataTable
            moduleKey="leads"
            records={items}
            loading={loading}
            columns={columns}
            statusOptions={statusOptions}
            onRefresh={fetchWorkItems}
            emptyMessage="No leads assigned to you"
            massUpdateFieldsLoader={loadMassUpdateFields}
            convertTargetsLoader={fetchPipelineConvertTargets}
            massUpdateHandler={(ids, field, value, extras) => leadsApi.applyLeadMassUpdate(ids, field, value, extras)}
            pagination={{
              page,
              totalPages,
              onPageChange: setPage,
              label: total ? `${((page - 1) * limit) + 1}–${Math.min(page * limit, total)} of ${total} records` : '0 records',
            }}
          />
        </div>
      </div>
    </CRMLayout>
  );
}
