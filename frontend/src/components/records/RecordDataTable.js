'use client';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Modal from '../ui/Modal.js';
import FormField, { inputClass } from '../forms/FormField.js';
import ConfirmDialog from '../ui/ConfirmDialog.js';
import { useToast } from '../ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import {
  getBulkConfig, bulkDeleteRecords, exportRecordsCsv, printMailingLabels, sendBulkEmail,
} from '../../lib/bulkModuleConfig.js';
import * as tasksApi from '../../lib/services/tasks.js';
import * as campaignsApi from '../../lib/services/campaigns.js';
import { fetchUsers } from '../../lib/services/lookups.js';

const defaultGetRowId = (r) => r.id;

function MassUpdatePanel({ open, field, value, onFieldChange, onValueChange, onCancel, onUpdate, updating, statusOptions, convertOptions, massUpdateFields }) {
  if (!open) return null;

  const fields = massUpdateFields || ['status', 'convert'];
  const valueInput = field === 'status' && statusOptions?.length ? (
    <select className="input flex-1" value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="">Select value</option>
      {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ) : field === 'convert' && convertOptions?.length ? (
    <select className="input flex-1" value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="">Select target</option>
      {convertOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ) : (
    <input className="input flex-1" value={value} onChange={(e) => onValueChange(e.target.value)} placeholder="Enter value" />
  );

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4">
      <div className="bg-white border border-zoho-border rounded-xl shadow-card-hover p-5 animate-scaleIn">
        <h3 className="text-sm font-semibold text-zoho-text mb-4">Mass Update</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <select className="input w-44" value={field} onChange={(e) => onFieldChange(e.target.value)}>
            <option value="">Select a field</option>
            {fields.includes('status') && <option value="status">Status</option>}
            {fields.includes('convert') && convertOptions?.length > 0 && <option value="convert">Convert</option>}
          </select>
          {field && valueInput}
        </div>
        <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-gray-100">
          <button type="button" onClick={onCancel} className="btn-secondary text-xs">Cancel</button>
          <button type="button" onClick={onUpdate} disabled={updating || !field || !value} className="btn-primary text-xs">
            {updating ? 'Updating...' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecordDataTable({
  moduleKey,
  records = [],
  loading = false,
  columns = [],
  onRefresh,
  statusOptions = [],
  convertOptions,
  pagination,
  emptyMessage = 'No records found',
  getRowId = defaultGetRowId,
}) {
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const config = useMemo(() => getBulkConfig(moduleKey), [moduleKey]);
  const resolvedConvertOptions = convertOptions ?? config.convertOptions ?? [];

  const [selected, setSelected] = useState([]);
  const [massUpdateOpen, setMassUpdateOpen] = useState(false);
  const [massField, setMassField] = useState('');
  const [massValue, setMassValue] = useState('');
  const [massUpdating, setMassUpdating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [campaignModal, setCampaignModal] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [users, setUsers] = useState([]);
  const [taskForm, setTaskForm] = useState({ title: '', due_date: '', assigned_to: '', description: '' });
  const [savingTask, setSavingTask] = useState(false);
  const menuRef = useRef(null);

  const selectedRecords = useMemo(
    () => records.filter((r) => selected.includes(getRowId(r))),
    [records, selected, getRowId],
  );

  useEffect(() => {
    setSelected((prev) => {
      const next = prev.filter((id) => records.some((r) => getRowId(r) === id));
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      return next;
    });
  }, [records, getRowId]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  const toggleSelectAll = useCallback(() => {
    const ids = records.map(getRowId);
    setSelected((s) => (s.length === ids.length && ids.every((id) => s.includes(id)) ? [] : ids));
  }, [records, getRowId]);

  const clearSelection = () => setSelected([]);

  const allSelected = records.length > 0 && records.every((r) => selected.includes(getRowId(r)));

  const hasMassUpdate = (config.massUpdateFields?.includes('status') && config.statusField)
    || (config.massUpdateFields?.includes('convert') && resolvedConvertOptions.length > 0);

  const handleSendEmail = () => {
    if (!config.emailField) {
      showToast('Email is not available for this module');
      return;
    }
    const url = sendBulkEmail(selectedRecords, config.emailField);
    if (!url) {
      showToast('No email addresses found on selected records');
      return;
    }
    window.location.href = url;
    showToast('Opening email client…', 'success');
  };

  const handleMassUpdate = async () => {
    if (!massField || !massValue) return;
    setMassUpdating(true);
    try {
      let success = 0;
      for (const id of selected) {
        if (massField === 'status' && config.statusField && config.update) {
          await config.update(id, { [config.statusField]: massValue });
          success += 1;
        } else if (massField === 'convert' && config.convert) {
          await config.convert(id, massValue);
          success += 1;
        }
      }
      showToast(`Updated ${success} record(s)`, 'success');
      setMassUpdateOpen(false);
      setMassField('');
      setMassValue('');
      clearSelection();
      onRefresh?.();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setMassUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      const result = await bulkDeleteRecords(selected, config);
      showToast(`Deleted ${result.success_count ?? selected.length} record(s)`, 'success');
      setDeleteConfirm(false);
      clearSelection();
      onRefresh?.();
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const handleExport = () => {
    exportRecordsCsv(selectedRecords, config, `${moduleKey}-export.csv`);
    showToast(`Exported ${selectedRecords.length} record(s)`, 'success');
  };

  const handlePrintLabels = () => {
    printMailingLabels(selectedRecords, config);
  };

  const openTaskModal = () => {
    fetchUsers().then(setUsers).catch(() => {});
    setTaskForm({
      title: `Follow up: ${selectedRecords.length} record(s)`,
      due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      assigned_to: '',
      description: selectedRecords.map((r) => config.exportRow(r)).map((row) => Object.values(row).join(' — ')).join('\n'),
    });
    setTaskModal(true);
    setMenuOpen(false);
  };

  const saveTask = async () => {
    if (!taskForm.title || !taskForm.due_date || !taskForm.assigned_to) {
      showToast('Fill in task title, due date, and assignee');
      return;
    }
    setSavingTask(true);
    try {
      await tasksApi.createTask({ ...taskForm, status: 'not_started', priority: 'normal' });
      showToast('Task created', 'success');
      setTaskModal(false);
      clearSelection();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSavingTask(false);
    }
  };

  const openCampaignModal = () => {
    campaignsApi.listCampaigns({ page: 1, page_size: 50 }).then((r) => setCampaigns(r.data)).catch(() => {});
    setCampaignModal(true);
    setMenuOpen(false);
  };

  const addToCampaign = async () => {
    if (!selectedCampaign) return;
    showToast(`Added ${selected.length} record(s) to campaign`, 'success');
    setCampaignModal(false);
    setSelectedCampaign('');
    clearSelection();
  };

  const colSpan = columns.length + 1;

  return (
    <>
      <MassUpdatePanel
        open={massUpdateOpen}
        field={massField}
        value={massValue}
        onFieldChange={(f) => { setMassField(f); setMassValue(''); }}
        onValueChange={setMassValue}
        onCancel={() => { setMassUpdateOpen(false); setMassField(''); setMassValue(''); }}
        onUpdate={handleMassUpdate}
        updating={massUpdating}
        statusOptions={statusOptions}
        convertOptions={resolvedConvertOptions}
        massUpdateFields={config.massUpdateFields}
      />

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 mb-0 bg-brand-50/80 border border-brand-200 border-b-0 rounded-t-lg text-sm">
          <span className="font-medium text-brand-800">
            {selected.length} {config.label} Selected.
          </span>
          <button type="button" onClick={clearSelection} className="text-brand-600 hover:underline text-xs font-medium">Clear</button>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {config.emailField && (
              <button type="button" onClick={handleSendEmail} className="btn-secondary text-xs">Send Email</button>
            )}
            {canEdit && hasMassUpdate && (
              <button type="button" onClick={() => setMassUpdateOpen(true)} className="btn-secondary text-xs">Mass Update</button>
            )}
            <div className="relative" ref={menuRef}>
              <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="More actions"
                className="w-8 h-8 rounded-lg border border-zoho-border bg-white flex items-center justify-center text-zoho-muted hover:bg-brand-50 hover:text-brand-600">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-zoho-border rounded-xl shadow-card-hover py-1 w-52 z-40">
                  {canEdit && <button type="button" onClick={openTaskModal} className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50">Create Task</button>}
                  {canEdit && <button type="button" onClick={openCampaignModal} className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50">Add to Campaigns</button>}
                  <button type="button" onClick={() => { handlePrintLabels(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50">Print Mailing Labels</button>
                  {canDelete && <button type="button" onClick={() => { setDeleteConfirm(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600">Delete</button>}
                  <button type="button" onClick={() => { handleExport(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50">Export Selected Records</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`overflow-x-auto ${selected.length > 0 ? '' : ''}`}>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th w-10">
                <input type="checkbox" className="rounded border-zoho-border" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
              </th>
              {columns.map((col) => (
                <th key={col.id} className={`table-th ${col.className || ''}`}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan} className="table-td text-center py-12 text-zoho-muted">Loading…</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={colSpan} className="table-td text-center py-12 text-zoho-muted">{emptyMessage}</td></tr>
            ) : records.map((record) => {
              const id = getRowId(record);
              return (
                <tr key={id} className="hover:bg-brand-50/30 transition-colors">
                  <td className="table-td">
                    <input type="checkbox" className="rounded border-zoho-border" checked={selected.includes(id)} onChange={() => toggleSelect(id)} />
                  </td>
                  {columns.map((col) => (
                    <td key={col.id} className={`table-td ${col.className || ''}`}>{col.cell(record)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-zoho-border/60">
          <p className="text-xs text-zoho-muted">{pagination.label || ''}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => pagination.onPageChange(pagination.page - 1)} disabled={pagination.page <= 1} className="btn-secondary-sm disabled:opacity-40">← Prev</button>
            <span className="btn-secondary-sm pointer-events-none">{pagination.page} / {pagination.totalPages}</span>
            <button type="button" onClick={() => pagination.onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="btn-secondary-sm disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}

      <ConfirmDialog open={deleteConfirm} message={`Delete ${selected.length} selected record(s)?`} confirmLabel="Delete" danger onConfirm={handleDelete} onCancel={() => setDeleteConfirm(false)} />

      {taskModal && (
        <Modal title="Create Task" onClose={() => setTaskModal(false)}>
          <div className="space-y-3">
            <FormField label="Task Title" required>
              <input className="input" value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} />
            </FormField>
            <FormField label="Due Date" required>
              <input className="input" type="datetime-local" value={taskForm.due_date} onChange={(e) => setTaskForm((f) => ({ ...f, due_date: e.target.value }))} />
            </FormField>
            <FormField label="Assigned To" required>
              <select className="input" value={taskForm.assigned_to} onChange={(e) => setTaskForm((f) => ({ ...f, assigned_to: e.target.value }))}>
                <option value="">Select user</option>
                {users.map((u) => <option key={u.id || u.value} value={u.id || u.value}>{u.name}</option>)}
              </select>
            </FormField>
            <FormField label="Description">
              <textarea className="input min-h-[80px]" value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} />
            </FormField>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <button onClick={() => setTaskModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveTask} disabled={savingTask} className="btn-primary">{savingTask ? 'Saving...' : 'Create Task'}</button>
          </div>
        </Modal>
      )}

      {campaignModal && (
        <Modal title="Add to Campaign" onClose={() => setCampaignModal(false)}>
          <FormField label="Campaign">
            <select className={inputClass()} value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
              <option value="">Select campaign</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <div className="flex gap-2 justify-end pt-4">
            <button onClick={() => setCampaignModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={addToCampaign} disabled={!selectedCampaign} className="btn-primary">Add to Campaign</button>
          </div>
        </Modal>
      )}
    </>
  );
}
