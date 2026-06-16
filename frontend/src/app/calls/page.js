'use client';
import { useEffect, useState, useCallback } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useOpenCreateParam } from '../../hooks/useOpenCreateParam.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';
import * as callsApi from '../../lib/services/calls.js';
import { fetchCallTypes, fetchUsers } from '../../lib/services/lookups.js';

const EMPTY = { subject: '', call_type: 'outbound', start_time: '', assigned_to: '', duration_minutes: 15, description: '' };
const LIMIT = 15;

export default function CallsPage() {
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [callTypes, setCallTypes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchCallTypes()]).then(([u, t]) => { setUsers(u); setCallTypes(t); }).catch(() => {});
  }, []);

  const openCreate = useCallback(() => { setForm(EMPTY); setEditing(null); setErrors({}); setModal(true); }, []);
  useOpenCreateParam(canEdit, openCreate);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callsApi.listCalls({ page, page_size: LIMIT, search: debouncedSearch || undefined });
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, showToast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const save = async () => {
    const errs = validateRequired({ subject: 'Call Subject', call_type: 'Call Type', start_time: 'Call Date & Time', assigned_to: 'Assigned To' }, form);
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    setSaving(true);
    try {
      if (editing) await callsApi.updateCall(editing, form);
      else await callsApi.createCall(form);
      setModal(false);
      fetchItems();
      showToast('Call saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await callsApi.deleteCall(deleteTarget.id);
      setDeleteTarget(null);
      fetchItems();
      showToast('Call deleted', 'success');
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const totalPages = Math.ceil(total / LIMIT) || 1;

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex justify-between mb-5">
          <div><h1 className="text-xl font-bold">Calls</h1><p className="text-xs text-gray-500">{total} calls</p></div>
          {canEdit && <button onClick={openCreate} className="btn-primary">+ Log Call</button>}
        </div>
        <div className="card overflow-x-auto">
          <div className="p-4 border-b"><input className="input max-w-xs" placeholder="Search calls..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
          <table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">Subject</th><th className="table-th">Type</th><th className="table-th">Date</th><th className="table-th">Duration</th><th className="table-th">Assigned To</th><th className="table-th">Actions</th></tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={6} className="table-td text-center py-8">Loading...</td></tr>
              : items.length === 0 ? <tr><td colSpan={6} className="table-td text-center py-8 text-gray-400">No calls found</td></tr>
              : items.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 group">
                <td className="table-td font-medium">{c.subject}</td>
                <td className="table-td">{c.call_type_label}</td>
                <td className="table-td">{new Date(c.start_time).toLocaleString()}</td>
                <td className="table-td">{c.duration_minutes} min</td>
                <td className="table-td">{c.assigned_name}</td>
                <td className="table-td">
                  {(canEdit || canDelete) && (
                  <div className="flex gap-3">
                    {canEdit && <button onClick={() => { setForm({ ...c, assigned_to: c.owner_id || '' }); setEditing(c.id); setModal(true); }} className="text-xs text-blue-600 hover:underline">Edit</button>}
                    {canDelete && <button onClick={() => setDeleteTarget(c)} className="text-xs text-red-500 hover:underline">Delete</button>}
                  </div>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {modal && <Modal title={editing ? 'Edit Call' : 'Log Call'} onClose={() => setModal(false)}>
        <div className="space-y-3">
          <FormField label="Call Subject" required error={errors.subject} name="subject"><input className={inputClass(errors.subject)} value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} /></FormField>
          <FormField label="Call Type" required><select className="input" value={form.call_type} onChange={e => setForm(p => ({ ...p, call_type: e.target.value }))}>{callTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></FormField>
          <FormField label="Call Date & Time" required error={errors.start_time} name="start_time"><input className={inputClass(errors.start_time)} type="datetime-local" value={form.start_time?.slice(0, 16)} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} /></FormField>
          <FormField label="Duration (minutes)"><input className="input" type="number" min={0} value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} /></FormField>
          <FormField label="Assigned To" required error={errors.assigned_to} name="assigned_to"><select className={inputClass(errors.assigned_to)} value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}><option value="">Select</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></FormField>
        </div>
        <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button></div>
      </Modal>}
      <ConfirmDialog open={!!deleteTarget} message={`Delete call "${deleteTarget?.subject}"?`} confirmLabel="Confirm Delete" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
