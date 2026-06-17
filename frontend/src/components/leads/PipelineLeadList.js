'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CRMLayout from '../layout/CRMLayout.js';
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
import { getPipelineConfig, RAW_LEAD_CSV_HEADERS, PIPELINE_RAW, PIPELINE_QUALIFIED, PIPELINE_PROPOSAL } from '../../lib/pipelineHelpers.js';
import { fetchLeadStatuses, FALLBACK_LEAD_STATUSES } from '../../lib/services/lookups.js';

const STAGE_MODULE_KEY = {
  [PIPELINE_RAW]: 'raw-leads',
  [PIPELINE_QUALIFIED]: 'qualified-leads',
  [PIPELINE_PROPOSAL]: 'proposals',
};

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
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [assignModal, setAssignModal] = useState(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [statusOptions, setStatusOptions] = useState(FALLBACK_LEAD_STATUSES);

  useEffect(() => {
    fetchLeadStatuses().then(setStatusOptions).catch(() => setStatusOptions(FALLBACK_LEAD_STATUSES));
  }, []);

  useEffect(() => {
    if (canAssignLeads) fetchUsers().then(setUsers).catch(() => {});
  }, [canAssignLeads]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const result = await leadsApi.listLeads({
        page,
        page_size: limit,
        search: debouncedSearch || undefined,
        lead_status: config?.apiStatus || stage,
        pipeline_stage: [PIPELINE_QUALIFIED, PIPELINE_PROPOSAL].includes(stage) ? stage : undefined,
      });
      setLeads(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, stage, showToast]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleImport = async () => {
    if (!csvText.trim()) { showToast('Choose a CSV file first'); return; }
    setImporting(true);
    try {
      const rows = leadsApi.parseLeadCsv(csvText);
      if (!rows.length) { showToast('No data rows found in CSV'); return; }
      const result = await leadsApi.importRawLeads(rows);
      showToast(`Imported ${result.success} lead(s)${result.failed ? `, ${result.failed} failed` : ''}`, result.success ? 'success' : undefined);
      if (result.errors.length) console.warn('Import errors', result.errors);
      setUploadOpen(false);
      setCsvText('');
      fetchLeads();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setImporting(false);
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

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target.result);
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([RAW_LEAD_CSV_HEADERS.join(',') + '\n'], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'raw-leads-template.csv';
    a.click();
  };

  const totalPages = Math.ceil(total / limit) || 1;
  const moduleKey = STAGE_MODULE_KEY[stage] || 'raw-leads';

  const columns = useMemo(() => {
    const cols = [
      { id: 'name', header: 'Name', cell: (lead) => <Link href={config.detailPath(lead.id)} className="font-medium text-brand-600 hover:text-brand-700">{lead.first_name} {lead.last_name}</Link> },
      { id: 'company', header: 'Company', cell: (lead) => lead.company || '—' },
      { id: 'email', header: 'Email', cell: (lead) => <span className="text-brand-600">{lead.email || '—'}</span> },
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
          <button type="button" onClick={() => { setAssignModal(lead); setAssignUserId(lead.owner_id || user?.id || ''); }} className="text-xs text-brand-600 hover:underline">Assign</button>
        ),
      });
    }
    return cols;
  }, [config, canAssignLeads, user?.id]);

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-semibold text-zoho-text">{config?.listTitle}</h1>
            {description && <p className="text-sm text-zoho-muted mt-1">{description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {stage === PIPELINE_RAW && canEdit && (
              <Link href="/raw-leads/create" className="btn-primary text-xs">+ Create Raw Lead</Link>
            )}
            {stage === PIPELINE_QUALIFIED && canEdit && (
              <Link href="/qualified-leads/create" className="btn-primary text-xs">+ Create Qualified Lead</Link>
            )}
            {stage === PIPELINE_PROPOSAL && canEdit && (
              <Link href="/proposals/create" className="btn-primary text-xs">+ Create Proposal</Link>
            )}
            {config?.allowUpload && canAssignLeads && (
              <button onClick={() => setUploadOpen(true)} className="btn-secondary text-xs">Upload CSV</button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            className="input max-w-xs text-sm"
            placeholder="Search..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select className="input w-28 text-xs" value={limit} onChange={(e) => { setLimit(+e.target.value); setPage(1); }}>
            {[10, 15, 25, 50].map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
          <span className="text-xs text-zoho-muted ml-auto">{total} record{total === 1 ? '' : 's'}</span>
        </div>

        <div className="card">
          <RecordDataTable
            moduleKey={moduleKey}
            records={leads}
            loading={loading}
            columns={columns}
            statusOptions={statusOptions}
            onRefresh={fetchLeads}
            pagination={{
              page,
              totalPages,
              onPageChange: setPage,
              label: total ? `${((page - 1) * limit) + 1}–${Math.min(page * limit, total)} of ${total}` : '0 records',
            }}
          />
        </div>
      </div>

      {uploadOpen && (
        <Modal title="Upload Raw Leads" onClose={() => setUploadOpen(false)}>
          <div className="space-y-3">
            <p className="text-sm text-zoho-muted">Upload a CSV with columns: {RAW_LEAD_CSV_HEADERS.join(', ')}. Required: last_name, company.</p>
            <button type="button" onClick={downloadTemplate} className="text-xs text-brand-600 hover:underline">Download CSV template</button>
            <input type="file" accept=".csv" onChange={handleFile} className="text-sm" />
            {csvText && <p className="text-xs text-zoho-muted">{leadsApi.parseLeadCsv(csvText).length} row(s) ready to import</p>}
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setUploadOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleImport} disabled={importing || !csvText} className="btn-primary">{importing ? 'Importing...' : 'Import Leads'}</button>
            </div>
          </div>
        </Modal>
      )}

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
