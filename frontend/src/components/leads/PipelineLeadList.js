'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CRMLayout from '../layout/CRMLayout.js';
import Modal from '../ui/Modal.js';
import Badge from '../ui/Badge.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import * as leadsApi from '../../lib/services/leads.js';
import { fetchUsers } from '../../lib/services/lookups.js';
import { getPipelineConfig, RAW_LEAD_CSV_HEADERS } from '../../lib/pipelineHelpers.js';

export default function PipelineLeadList({ stage, description }) {
  const config = getPipelineConfig(stage);
  const { showToast } = useToast();
  const { user } = useAuth();
  const { canAssignLeads } = usePermissions();
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
        lead_status: stage,
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

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-semibold text-zoho-text">{config?.listTitle}</h1>
            {description && <p className="text-sm text-zoho-muted mt-1">{description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Name</th>
                  <th className="table-th">Company</th>
                  <th className="table-th">Email</th>
                  <th className="table-th">Phone</th>
                  <th className="table-th">Source</th>
                  <th className="table-th">Owner</th>
                  {config?.allowAssign && canAssignLeads && <th className="table-th">Assign</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={config?.allowAssign && canAssignLeads ? 7 : 6} className="table-td text-center py-12 text-zoho-muted">Loading…</td></tr>
                ) : leads.length === 0 ? (
                  <tr><td colSpan={config?.allowAssign && canAssignLeads ? 7 : 6} className="table-td text-center py-12 text-zoho-muted">No records found</td></tr>
                ) : leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-brand-50/30 transition-colors">
                    <td className="table-td font-medium">
                      <Link href={config.detailPath(lead.id)} className="text-brand-600 hover:text-brand-700">
                        {lead.first_name} {lead.last_name}
                      </Link>
                    </td>
                    <td className="table-td">{lead.company || '—'}</td>
                    <td className="table-td text-brand-600">{lead.email || '—'}</td>
                    <td className="table-td">{lead.phone || '—'}</td>
                    <td className="table-td">{lead.source || '—'}</td>
                    <td className="table-td">{lead.owner_name || 'Unassigned'}</td>
                    {config?.allowAssign && canAssignLeads && (
                      <td className="table-td">
                        <button
                          type="button"
                          onClick={() => { setAssignModal(lead); setAssignUserId(lead.owner_id || user?.id || ''); }}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          Assign
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-zoho-border/60">
            <p className="text-xs text-zoho-muted">{total ? `${((page - 1) * limit) + 1}–${Math.min(page * limit, total)} of ${total}` : '0 records'}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="btn-secondary-sm disabled:opacity-40">← Prev</button>
              <span className="btn-secondary-sm pointer-events-none">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="btn-secondary-sm disabled:opacity-40">Next →</button>
            </div>
          </div>
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
