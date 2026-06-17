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
import { getNoteMeta, notesApiSupported } from '../../lib/noteHelpers.js';
import RecordNoteRowIcon from './RecordNoteRowIcon.js';
import RecordNotesSidePanel from './RecordNotesSidePanel.js';
import * as tasksApi from '../../lib/services/tasks.js';
import * as campaignsApi from '../../lib/services/campaigns.js';
import { fetchUsers, fetchMassUpdateFieldOptions, fetchPipelineConvertTargets, fetchLostReasons, isConvertMassUpdateField, filterLeadMassUpdateFields } from '../../lib/services/lookups.js';
import { isLostLeadStatus, isLeadStatusMassField } from '../../lib/statusHelpers.js';

const defaultGetRowId = (r) => r.id;

const LEAD_MODULE_KEYS = new Set(['leads', 'raw-leads', 'qualified-leads', 'proposals']);

const CAMPAIGN_MEMBER_TYPES = {
  leads: 'lead',
  'raw-leads': 'lead',
  'qualified-leads': 'lead',
  proposals: 'lead',
  contacts: 'contact',
};

function MassUpdatePanel({
  open, field, value, onFieldChange, onValueChange, onCancel, onUpdate, updating,
  statusOptions, massUpdateFields, dynamicFields, loadingFields,
  valueOptions, loadingValueOptions, useDynamicFields, isConvertField,
  showLostReason, lostReason, lostReasonOptions, onLostReasonChange, loadingLostReasons,
}) {
  if (!open) return null;

  const isDynamic = useDynamicFields && Array.isArray(dynamicFields) && dynamicFields.length > 0;
  const valuePlaceholder = isConvertField ? 'Select target' : 'Select value';

  let valueInput = null;
  if (field) {
    if (loadingValueOptions) {
      valueInput = (
        <select className="input flex-1" disabled>
          <option>Loading options…</option>
        </select>
      );
    } else if (isConvertField) {
      valueInput = (
        <select className="input flex-1" value={value} onChange={(e) => onValueChange(e.target.value)}>
          <option value="">{valueOptions?.length ? 'Select target' : 'No options available'}</option>
          {(valueOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    } else if (useDynamicFields) {
      valueInput = (
        <select className="input flex-1" value={value} onChange={(e) => onValueChange(e.target.value)}>
          <option value="">{valueOptions?.length ? valuePlaceholder : 'No options available'}</option>
          {(valueOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    } else if (field === 'status' && statusOptions?.length) {
      valueInput = (
        <select className="input flex-1" value={value} onChange={(e) => onValueChange(e.target.value)}>
          <option value="">Select value</option>
          {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    } else {
      valueInput = <input className="input flex-1" value={value} onChange={(e) => onValueChange(e.target.value)} placeholder="Enter value" />;
    }
  }

  const staticFields = massUpdateFields || ['status', 'convert'];

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4">
      <div className="bg-white border border-zoho-border rounded-xl shadow-card-hover p-5 animate-scaleIn">
        <h3 className="text-sm font-semibold text-zoho-text mb-4">Mass Update</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <select className="input w-44" value={field} onChange={(e) => onFieldChange(e.target.value)} disabled={loadingFields}>
            <option value="">{loadingFields ? 'Loading fields…' : 'Select a field'}</option>
            {isDynamic
              ? dynamicFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)
              : <>
                  {staticFields.includes('status') && <option value="status">Status</option>}
                  {staticFields.includes('convert') && <option value="convert">Convert</option>}
                </>
            }
          </select>
          {field && valueInput}
          {showLostReason && (
            loadingLostReasons ? (
              <select className="input flex-1" disabled><option>Loading reasons…</option></select>
            ) : (
              <select className="input flex-1" value={lostReason} onChange={(e) => onLostReasonChange(e.target.value)}>
                <option value="">Select lost reason</option>
                {(lostReasonOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )
          )}
        </div>
        <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-gray-100">
          <button type="button" onClick={onCancel} className="btn-secondary text-xs">Cancel</button>
          <button type="button" onClick={onUpdate} disabled={updating || loadingValueOptions || loadingLostReasons || !field || !value || (showLostReason && !lostReason)} className="btn-primary text-xs">
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
  pagination,
  emptyMessage = 'No records found',
  getRowId = defaultGetRowId,
  massUpdateFieldsLoader,
  massUpdateHandler,
}) {
  const { showToast } = useToast();
  const { canEdit, canDelete, canAssignLeads } = usePermissions();
  const config = useMemo(() => getBulkConfig(moduleKey), [moduleKey]);
  const noteMeta = useMemo(() => getNoteMeta(moduleKey), [moduleKey]);
  const showNotes = notesApiSupported(moduleKey);

  const [selected, setSelected] = useState([]);
  const [panelRecord, setPanelRecord] = useState(null);
  const [massUpdateOpen, setMassUpdateOpen] = useState(false);
  const [massField, setMassField] = useState('');
  const [massValue, setMassValue] = useState('');
  const [massUpdating, setMassUpdating] = useState(false);
  const [dynamicMassFields, setDynamicMassFields] = useState([]);
  const [massValueOptions, setMassValueOptions] = useState([]);
  const [loadingMassFields, setLoadingMassFields] = useState(false);
  const [loadingMassValueOptions, setLoadingMassValueOptions] = useState(false);
  const [massLostReason, setMassLostReason] = useState('');
  const [lostReasonOptions, setLostReasonOptions] = useState([]);
  const [loadingLostReasons, setLoadingLostReasons] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [campaignModal, setCampaignModal] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [users, setUsers] = useState([]);
  const [taskForm, setTaskForm] = useState({ title: '', due_date: '', assigned_to: '', description: '' });
  const [savingTask, setSavingTask] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
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

  useEffect(() => {
    if (!massUpdateOpen || !massUpdateFieldsLoader) return;
    setLoadingMassFields(true);
    setDynamicMassFields([]);
    massUpdateFieldsLoader()
      .then((fields) => {
        const filtered = LEAD_MODULE_KEYS.has(moduleKey)
          ? filterLeadMassUpdateFields(fields, { canChangeOwner: canAssignLeads })
          : fields;
        setDynamicMassFields(filtered);
      })
      .catch(() => setDynamicMassFields([]))
      .finally(() => setLoadingMassFields(false));
  }, [massUpdateOpen, massUpdateFieldsLoader, moduleKey, canAssignLeads]);

  useEffect(() => {
    if (!massField) {
      setMassValueOptions([]);
      setLoadingMassValueOptions(false);
      return undefined;
    }

    const fieldDef = massUpdateFieldsLoader
      ? dynamicMassFields.find((f) => f.value === massField)
      : null;
    const isConvert = isConvertMassUpdateField(fieldDef) || String(massField).toLowerCase() === 'convert';

    if (isConvert) {
      let cancelled = false;
      setLoadingMassValueOptions(true);
      setMassValueOptions([]);
      fetchPipelineConvertTargets()
        .then((options) => { if (!cancelled) setMassValueOptions(options); })
        .catch(() => { if (!cancelled) setMassValueOptions([]); })
        .finally(() => { if (!cancelled) setLoadingMassValueOptions(false); });
      return () => { cancelled = true; };
    }

    if (!massUpdateFieldsLoader || !fieldDef) {
      setMassValueOptions([]);
      setLoadingMassValueOptions(false);
      return undefined;
    }

    let cancelled = false;
    setLoadingMassValueOptions(true);
    setMassValueOptions([]);

    fetchMassUpdateFieldOptions(fieldDef)
      .then((options) => { if (!cancelled) setMassValueOptions(options); })
      .catch(() => { if (!cancelled) setMassValueOptions([]); })
      .finally(() => { if (!cancelled) setLoadingMassValueOptions(false); });

    return () => { cancelled = true; };
  }, [massField, dynamicMassFields, massUpdateFieldsLoader]);

  const selectedMassFieldDef = dynamicMassFields.find((f) => f.value === massField);
  const massFieldKey = String(massField || '').toLowerCase();
  const isConvertMassField = isConvertMassUpdateField(selectedMassFieldDef)
    || massFieldKey === 'convert'
    || massFieldKey === 'pipeline_convert';
  const showLostReasonField = massUpdateFieldsLoader
    && isLeadStatusMassField(massField, selectedMassFieldDef)
    && isLostLeadStatus(massValue);

  useEffect(() => {
    if (!showLostReasonField) {
      setLostReasonOptions([]);
      setMassLostReason('');
      setLoadingLostReasons(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingLostReasons(true);
    fetchLostReasons()
      .then((options) => { if (!cancelled) setLostReasonOptions(options); })
      .catch(() => { if (!cancelled) setLostReasonOptions([]); })
      .finally(() => { if (!cancelled) setLoadingLostReasons(false); });
    return () => { cancelled = true; };
  }, [showLostReasonField, massValue]);

  const hasConvertField = massUpdateFieldsLoader
    ? dynamicMassFields.some(isConvertMassUpdateField)
    : config.massUpdateFields?.includes('convert');

  const hasMassUpdate = massUpdateFieldsLoader
    || (config.massUpdateFields?.includes('status') && config.statusField)
    || hasConvertField;

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
      if (massUpdateHandler) {
        const result = await massUpdateHandler(selected, massField, massValue, {
          lost_reason: showLostReasonField ? massLostReason : undefined,
        });
        const failed = result?.failed_count ?? 0;
        if (failed > 0) {
          showToast((result?.errors || []).join('; ') || `${failed} record(s) failed to update`);
          return;
        }
        const count = result?.success_count ?? result?.updated ?? selected.length;
        showToast(`Updated ${count} record(s)`, 'success');
      } else {
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
      }
      setMassUpdateOpen(false);
      setMassField('');
      setMassValue('');
      setMassLostReason('');
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
    const memberType = CAMPAIGN_MEMBER_TYPES[moduleKey];
    if (!memberType) {
      showToast('Add to Campaign is only supported for Leads and Contacts lists');
      return;
    }
    setSavingCampaign(true);
    try {
      await Promise.all(selected.map((id) => campaignsApi.addCampaignMember(selectedCampaign, {
        member_type: memberType,
        member_id: id,
      })));
      showToast(`Added ${selected.length} record(s) to campaign`, 'success');
      setCampaignModal(false);
      setSelectedCampaign('');
      clearSelection();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSavingCampaign(false);
    }
  };

  const colSpan = columns.length + 1;

  return (
    <>
      <MassUpdatePanel
        open={massUpdateOpen}
        field={massField}
        value={massValue}
        onFieldChange={(f) => { setMassField(f); setMassValue(''); setMassLostReason(''); }}
        onValueChange={(v) => { setMassValue(v); setMassLostReason(''); }}
        onCancel={() => { setMassUpdateOpen(false); setMassField(''); setMassValue(''); setMassLostReason(''); }}
        onUpdate={handleMassUpdate}
        updating={massUpdating}
        statusOptions={statusOptions}
        massUpdateFields={config.massUpdateFields}
        dynamicFields={dynamicMassFields}
        loadingFields={loadingMassFields}
        valueOptions={massValueOptions}
        loadingValueOptions={loadingMassValueOptions}
        useDynamicFields={!!massUpdateFieldsLoader}
        isConvertField={isConvertMassField}
        showLostReason={showLostReasonField}
        lostReason={massLostReason}
        lostReasonOptions={lostReasonOptions}
        onLostReasonChange={setMassLostReason}
        loadingLostReasons={loadingLostReasons}
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
              <th className={`table-th ${showNotes ? 'w-[4.5rem]' : 'w-10'}`}>
                <div className="flex items-center gap-2">
                  {showNotes && <span className="w-7 shrink-0" aria-hidden="true" />}
                  <input type="checkbox" className="rounded border-zoho-border" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
                </div>
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
              const recordLabel = noteMeta.getLabel(record);
              return (
                <tr key={id} className="hover:bg-brand-50/30 transition-colors">
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      {showNotes && (
                        <RecordNoteRowIcon
                          relatedType={noteMeta.relatedType}
                          recordId={id}
                          moduleLabel={noteMeta.moduleLabel}
                          recordLabel={recordLabel}
                          onOpen={() => setPanelRecord({ id, label: recordLabel })}
                        />
                      )}
                      <input type="checkbox" className="rounded border-zoho-border" checked={selected.includes(id)} onChange={() => toggleSelect(id)} />
                    </div>
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
            <button onClick={addToCampaign} disabled={!selectedCampaign || savingCampaign} className="btn-primary">
              {savingCampaign ? 'Adding...' : 'Add to Campaign'}
            </button>
          </div>
        </Modal>
      )}

      <RecordNotesSidePanel
        open={!!panelRecord && showNotes}
        onClose={() => setPanelRecord(null)}
        relatedType={noteMeta.relatedType}
        recordId={panelRecord?.id}
        recordLabel={panelRecord?.label}
        moduleLabel={noteMeta.moduleLabel}
        canEdit={canEdit}
      />
    </>
  );
}
