'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { LIST_VIEWS } from '../../lib/constants.js';
import { PIPELINE_LEAD } from '../../lib/pipelineHelpers.js';
import * as leadsApi from '../../lib/services/leads.js';
import { filterUnreadRecords } from '../../lib/recordViewTracker.js';
import { fetchLeadStatuses, FALLBACK_LEAD_STATUSES, fetchLeadMassUpdateFields } from '../../lib/services/lookups.js';
import { tableLinkClass, tableEmailClass } from '../../lib/tableStyles.js';

export default function LeadsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { canEdit, canAssignLeads } = usePermissions();
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [activeView, setActiveView] = useState('All Leads');
  const [statusOptions, setStatusOptions] = useState(FALLBACK_LEAD_STATUSES);
  const fetchRequestId = useRef(0);

  useEffect(() => {
    fetchLeadStatuses().then(setStatusOptions).catch(() => setStatusOptions(FALLBACK_LEAD_STATUSES));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !canEdit) return;
    if (new URLSearchParams(window.location.search).get('create') === '1') {
      router.replace('/leads/create');
    }
  }, [canEdit, router]);

  const fetchLeads = useCallback(async () => {
    const requestId = ++fetchRequestId.current;
    setLoading(true);
    try {
      const isUnreadView = activeView === 'Unread Leads';
      const params = {
        page: isUnreadView ? 1 : page,
        page_size: isUnreadView ? 200 : limit,
        search: debouncedSearch || undefined,
        lead_status: isUnreadView ? undefined : (statusFilter || PIPELINE_LEAD),
      };
      if (activeView === 'My Leads' && user?.id) params.owner_id = user.id;
      if (activeView === 'Recently Created') {
        params.sort_by = 'created_at';
        params.sort_order = 'desc';
      }
      if (activeView === 'Recently Modified') {
        params.sort_by = 'updated_at';
        params.sort_order = 'desc';
      }
      const result = await leadsApi.listLeads({
        ...params,
        statusOptions,
      });
      if (requestId !== fetchRequestId.current) return;
      if (isUnreadView) {
        const unread = filterUnreadRecords(result.data, 'lead');
        const start = (page - 1) * limit;
        setLeads(unread.slice(start, start + limit));
        setTotal(unread.length);
      } else {
        setLeads(result.data);
        setTotal(result.total);
      }
    } catch (err) {
      if (requestId !== fetchRequestId.current) return;
      showToast(getApiError(err));
    } finally {
      if (requestId === fetchRequestId.current) setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, activeView, user?.id, showToast, statusOptions]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const totalPages = Math.ceil(total / limit) || 1;

  const loadMassUpdateFields = useCallback(
    () => fetchLeadMassUpdateFields({ canChangeOwner: canAssignLeads }),
    [canAssignLeads],
  );

  const columns = useMemo(() => [
    { id: 'name', header: 'Lead Name', cell: (lead) => <Link href={`/leads/${lead.id}`} className={tableLinkClass}>{lead.first_name} {lead.last_name}</Link> },
    { id: 'company', header: 'Company', cell: (lead) => lead.company || '—' },
    { id: 'email', header: 'Email', cell: (lead) => <span className={tableEmailClass}>{lead.email || '—'}</span> },
    { id: 'phone', header: 'Phone', cell: (lead) => lead.phone || '—' },
    { id: 'source', header: 'Source', cell: (lead) => lead.source || '—' },
    { id: 'status', header: 'Status', cell: (lead) => <Badge label={lead.status} /> },
    { id: 'owner', header: 'Owner', cell: (lead) => lead.owner_name || '—' },
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Leads"
          subtitle="Manage and track sales leads through the pipeline."
          primaryAction={canEdit ? (
            <button type="button" onClick={() => router.push('/leads/create')} className="btn-primary-sm">
              Create Lead
            </button>
          ) : null}
        />

        <ListToolbar
          moduleName="Leads"
          total={total}
          views={LIST_VIEWS.leads}
          activeView={activeView}
          onViewChange={(v) => { setActiveView(v); setPage(1); }}
          searchValue={search}
          onSearch={(v) => { setSearch(v); setPage(1); }}
        >
          <select className="input w-40 text-xs" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Active leads</option>
            {statusOptions.filter(s => !['raw_prospect', 'qualified_lead', 'deal_lost'].includes(s.value)).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="input w-28 text-xs" value={limit} onChange={e => { setLimit(+e.target.value); setPage(1); }}>
            {[10, 15, 25, 50].map(n => <option key={n} value={n}>{n} per page</option>)}
          </select>
        </ListToolbar>

        <div className="card rounded-tl-none rounded-tr-none border-t-0 mb-4">
          <RecordDataTable
            moduleKey="leads"
            records={leads}
            loading={loading}
            columns={columns}
            statusOptions={statusOptions}
            onRefresh={fetchLeads}
            emptyMessage="No leads found"
            massUpdateFieldsLoader={loadMassUpdateFields}
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
