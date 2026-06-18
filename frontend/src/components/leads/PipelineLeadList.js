'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import CRMLayout from '../layout/CRMLayout.js';
import ListPageHeader from '../layout/ListPageHeader.js';
import ListSearchBar from '../layout/ListSearchBar.js';
import Modal from '../ui/Modal.js';
import Badge from '../ui/Badge.js';
import FormField, { inputClass } from '../forms/FormField.js';
import RecordDataTable from '../records/RecordDataTable.js';
import { useToast } from '../ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import * as leadsApi from '../../lib/services/leads.js';
import { fetchUsers } from '../../lib/services/lookups.js';
import { getPipelineConfig, RAW_LEAD_CSV_HEADERS, PIPELINE_RAW, PIPELINE_QUALIFIED, PIPELINE_PROPOSAL, proposalDealStatusLabel } from '../../lib/pipelineHelpers.js';
import { fetchLeadStatuses, FALLBACK_LEAD_STATUSES, fetchLeadMassUpdateFields } from '../../lib/services/lookups.js';
import CsvImportModal from '../records/CsvImportModal.js';
import { tableLinkClass, tableEmailClass, tableActionClass } from '../../lib/tableStyles.js';

const STAGE_MODULE_KEY = {
  [PIPELINE_RAW]: 'raw-leads',
  [PIPELINE_QUALIFIED]: 'qualified-leads',
  [PIPELINE_PROPOSAL]: 'proposals',
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function formatDealSize(value) {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return `Rs. ${num.toLocaleString('en-IN')}`;
}

export default function PipelineLeadList({ stage, description }) {
  const config = getPipelineConfig(stage);
  const { showToast } = useToast();
  const { user } = useAuth();
  const { canAssignLeads, canEdit } = usePermissions();
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [assignModal, setAssignModal] = useState(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [statusOptions, setStatusOptions] = useState(FALLBACK_LEAD_STATUSES);
  const fetchRequestId = useRef(0);

  useEffect(() => {
    fetchLeadStatuses().then(setStatusOptions).catch(() => setStatusOptions(FALLBACK_LEAD_STATUSES));
  }, []);

  useEffect(() => {
    if (canAssignLeads) fetchUsers().then(setUsers).catch(() => {});
  }, [canAssignLeads]);

  const fetchLeads = useCallback(async () => {
    const requestId = ++fetchRequestId.current;
    setLoading(true);
    try {
      const result = await leadsApi.listLeads({
        page,
        page_size: limit,
        search: debouncedSearch || undefined,
        pipeline_stage: [PIPELINE_QUALIFIED, PIPELINE_PROPOSAL].includes(stage) ? stage : stage === PIPELINE_RAW ? PIPELINE_RAW : undefined,
        lead_status: [PIPELINE_QUALIFIED, PIPELINE_PROPOSAL, PIPELINE_RAW].includes(stage) ? undefined : (config?.apiStatus || stage),
        statusOptions,
      });
      if (requestId !== fetchRequestId.current) return;
      setLeads(result.data);
      setTotal(result.total);
    } catch (err) {
      if (requestId !== fetchRequestId.current) return;
      showToast(getApiError(err));
    } finally {
      if (requestId === fetchRequestId.current) setLoading(false);
    }
  }, [page, limit, debouncedSearch, stage, config?.apiStatus, showToast, statusOptions]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const downloadTemplate = async () => {
    try {
      await leadsApi.downloadLeadImportTemplate();
    } catch {
      const blob = new Blob([RAW_LEAD_CSV_HEADERS.join(',') + '\n'], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'raw-leads-template.csv';
      a.click();
    }
  };

  const handleAssign = async () => {
    if (!assignModal || !assignUserId) return;
    setAssigning(true);
    try {
      await leadsApi.assignLead(assignModal.id, assignUserId);
      showToast('Lead assigned', 'success');
      setAssignModal(null);
      setAssignUserId('');
      fetchLeads();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setAssigning(false);
    }
  };

  const loadMassUpdateFields = useCallback(
    () => fetchLeadMassUpdateFields({ canChangeOwner: canAssignLeads }),
    [canAssignLeads],
  );

  const totalPages = Math.ceil(total / limit) || 1;
  const moduleKey = STAGE_MODULE_KEY[stage] || 'raw-leads';

  const columns = useMemo(() => {
    if (stage === PIPELINE_PROPOSAL) {
      const cols = [
        { id: 'name', header: 'Name', cell: (lead) => <Link href={config.detailPath(lead.id)} className={tableLinkClass}>{lead.first_name} {lead.last_name}</Link> },
        { id: 'company', header: 'Company', cell: (lead) => lead.company || '—' },
        { id: 'proposal_date', header: 'Proposal Date', cell: (lead) => formatDate(lead.proposal_date) },
        { id: 'deal_size', header: 'Deal Size', cell: (lead) => formatDealSize(lead.deal_size ?? lead.proposal_amount) },
        { id: 'closure_date', header: 'Closure Date', cell: (lead) => formatDate(lead.closure_date) },
        { id: 'deal_status', header: 'Deal Status', cell: (lead) => <Badge label={lead.deal_status_label || proposalDealStatusLabel(lead.deal_status)} /> },
        { id: 'owner', header: 'Owner', cell: (lead) => lead.owner_name || 'Unassigned' },
      ];
      return cols;
    }

    const cols = [
      { id: 'name', header: 'Name', cell: (lead) => <Link href={config.detailPath(lead.id)} className={tableLinkClass}>{lead.first_name} {lead.last_name}</Link> },
      { id: 'company', header: 'Company', cell: (lead) => lead.company || '—' },
      { id: 'email', header: 'Email', cell: (lead) => <span className={tableEmailClass}>{lead.email || '—'}</span> },
      { id: 'phone', header: 'Phone', cell: (lead) => lead.phone || '—' },
      { id: 'source', header: 'Source', cell: (lead) => lead.source || '—' },
      { id: 'status', header: 'Status', cell: (lead) => <Badge label={lead.status} /> },
      { id: 'owner', header: 'Owner', cell: (lead) => lead.owner_name || 'Unassigned' },
    ];
    if (config?.allowAssign && canAssignLeads) {
      cols.push({
        id: 'assign',
        header: 'Assign',
        cell: (lead) => (
          <button type="button" onClick={() => { setAssignModal(lead); setAssignUserId(lead.owner_id || user?.id || ''); }} className={tableActionClass}>Assign</button>
        ),
      });
    }
    return cols;
  }, [config, canAssignLeads, user?.id]);

  const createLabel = stage === PIPELINE_RAW
    ? 'Create Raw Lead'
    : stage === PIPELINE_QUALIFIED
      ? 'Create Qualified Lead'
      : 'Create Proposal';

  const createHref = stage === PIPELINE_RAW
    ? '/raw-leads/create'
    : stage === PIPELINE_QUALIFIED
      ? '/qualified-leads/create'
      : '/proposals/create';

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title={config?.listTitle}
          subtitle={description}
          secondaryActions={config?.allowUpload && canEdit ? (
            <button type="button" onClick={() => setUploadOpen(true)} className="btn-secondary-sm">
              Bulk Upload
            </button>
          ) : null}
          primaryAction={canEdit ? (
            <Link href={createHref} className="btn-primary-sm">{createLabel}</Link>
          ) : null}
        />

        <ListSearchBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search…"
          limit={limit}
          onLimitChange={(n) => { setLimit(n); setPage(1); }}
          total={total}
        />

        <div className="card">
          <RecordDataTable
            moduleKey={moduleKey}
            records={leads}
            loading={loading}
            columns={columns}
            statusOptions={statusOptions}
            onRefresh={fetchLeads}
            massUpdateFieldsLoader={loadMassUpdateFields}
            massUpdateHandler={(ids, field, value, extras) => leadsApi.applyLeadMassUpdate(ids, field, value, extras)}
            pagination={{
              page,
              totalPages,
              onPageChange: setPage,
              label: total ? `${((page - 1) * limit) + 1}–${Math.min(page * limit, total)} of ${total}` : '0 records',
            }}
          />
        </div>
      </div>

      <CsvImportModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Import CSV — Raw Leads"
        module="leads"
        importFn={leadsApi.importLeadsFile}
        downloadTemplate={downloadTemplate}
        onDone={fetchLeads}
      />

      {assignModal && (
        <Modal title={`Assign ${assignModal.first_name} ${assignModal.last_name}`} onClose={() => setAssignModal(null)}>
          <FormField label="Assign to" name="owner_id">
            <select className={inputClass()} value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
              <option value="">Select user</option>
              {users.map((u) => <option key={u.id || u.value} value={u.id || u.value}>{u.name}</option>)}
            </select>
          </FormField>
          <div className="flex gap-2 justify-end pt-4">
            <button onClick={() => setAssignModal(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleAssign} disabled={assigning || !assignUserId} className="btn-primary">{assigning ? 'Assigning...' : 'Assign'}</button>
          </div>
        </Modal>
      )}
    </CRMLayout>
  );
}
