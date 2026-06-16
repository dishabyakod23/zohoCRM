'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import Badge from '../../components/ui/Badge.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';
import * as projectsApi from '../../lib/services/projects.js';
import { fetchAccountLookups, accountMapFromLookups, fetchProjectStatuses } from '../../lib/services/lookups.js';

const EMPTY = { name: '', account_id: '', status: 'planning', start_date: '', end_date: '', description: '' };

export default function ProjectsPage() {
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const accountMap = useMemo(() => accountMapFromLookups(accounts), [accounts]);

  useEffect(() => {
    Promise.all([fetchAccountLookups(), fetchProjectStatuses()])
      .then(([a, s]) => { setAccounts(a); setStatusOptions(s); })
      .catch(() => {});
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await projectsApi.listProjects({ page: 1, page_size: 50 }, accountMap);
      setItems(result.data);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [accountMap, showToast]);

  useEffect(() => { if (accounts.length) fetchItems(); }, [fetchItems, accounts.length]);

  const save = async () => {
    const errs = validateRequired({ name: 'Project Name', account_id: 'Account', start_date: 'Start Date' }, form);
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields.'); return; }
    setSaving(true);
    try {
      if (editing) await projectsApi.updateProject(editing, form);
      else await projectsApi.createProject(form);
      setModal(false);
      fetchItems();
      showToast('Project saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await projectsApi.deleteProject(deleteTarget.id);
      setDeleteTarget(null);
      fetchItems();
      showToast('Project deleted', 'success');
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex justify-between mb-5">
          <h1 className="text-xl font-bold">Projects</h1>
          {canEdit && <button onClick={() => { setForm(EMPTY); setEditing(null); setModal(true); }} className="btn-primary">+ Create Project</button>}
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">Name</th><th className="table-th">Account</th><th className="table-th">Status</th><th className="table-th">Dates</th><th className="table-th">Actions</th></tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={5} className="table-td text-center py-8">Loading...</td></tr>
              : items.length === 0 ? <tr><td colSpan={5} className="table-td text-center py-8 text-gray-400">No projects found</td></tr>
              : items.map(p => (
              <tr key={p.id}>
                <td className="table-td font-medium">{p.name}</td>
                <td className="table-td">{p.account_name || '—'}</td>
                <td className="table-td"><Badge label={p.status_label} /></td>
                <td className="table-td text-xs">{p.start_date || '—'} → {p.end_date || '—'}</td>
                <td className="table-td">
                  {(canEdit || canDelete) && (
                  <div className="flex gap-2">
                    {canEdit && <button onClick={() => { setForm({ ...p, name: p.project_name, start_date: p.start_date?.slice(0, 10), end_date: p.end_date?.slice(0, 10) || '' }); setEditing(p.id); setModal(true); }} className="text-xs text-blue-600">Edit</button>}
                    {canDelete && <button onClick={() => setDeleteTarget(p)} className="text-xs text-red-500">Delete</button>}
                  </div>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {modal && <Modal title={editing ? 'Edit Project' : 'Create Project'} onClose={() => setModal(false)}>
        <div className="space-y-3">
          <FormField label="Project Name" required error={errors.name}><input className={inputClass(errors.name)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></FormField>
          <FormField label="Account" required error={errors.account_id}>
            <select className={inputClass(errors.account_id)} value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}>
              <option value="">Select</option>{accounts.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </FormField>
          <FormField label="Status"><select className="input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>{statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></FormField>
          <FormField label="Start Date" required error={errors.start_date}><input className={inputClass(errors.start_date)} type="date" value={form.start_date?.slice(0, 10)} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></FormField>
          <FormField label="End Date"><input className="input" type="date" value={form.end_date?.slice(0, 10)} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} /></FormField>
          <FormField label="Description"><textarea className="input" value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></FormField>
        </div>
        <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button></div>
      </Modal>}
      <ConfirmDialog open={!!deleteTarget} message={`Delete project "${deleteTarget?.name}"?`} confirmLabel="Confirm Delete" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
