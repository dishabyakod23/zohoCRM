'use client';
import { useEffect, useState, useCallback } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import ApiPendingBanner from '../../components/ui/ApiPendingBanner.js';
import { CALL_TYPES } from '../../lib/constants.js';
import { validateRequired } from '../../lib/validators.js';

const EMPTY = { subject: '', call_type: 'Outbound', start_time: '', assigned_to: '', description: '' };

export default function CallsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetch = useCallback(() => {
    setLoading(false);
    setItems([]);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const save = async () => {
    const errs = validateRequired({ subject: 'Call Subject', call_type: 'Call Type', start_time: 'Call Date & Time', assigned_to: 'Assigned To' }, form);
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    showToast('Calls is not available on the Sales CRM API yet');
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <ApiPendingBanner module="Calls" />
        <div className="flex justify-between mb-5"><h1 className="text-xl font-bold">Calls</h1><button onClick={() => { setForm(EMPTY); setEditing(null); setModal(true); }} className="btn-primary">+ Log Call</button></div>
        <div className="card overflow-x-auto">
          <table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">Subject</th><th className="table-th">Type</th><th className="table-th">Date</th><th className="table-th">Assigned To</th><th className="table-th">Actions</th></tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={5} className="table-td text-center py-8">Loading...</td></tr>
              : items.length === 0 ? <tr><td colSpan={5} className="table-td text-center py-8 text-gray-400">No calls found</td></tr>
              : items.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 group">
                <td className="table-td font-medium">{c.subject}</td><td className="table-td">{c.call_type}</td>
                <td className="table-td">{new Date(c.start_time).toLocaleString()}</td><td className="table-td">{c.assigned_name}</td>
                <td className="table-td"><div className="flex gap-3">
                  <button onClick={() => { setForm({ ...c, assigned_to: String(c.assigned_to) }); setEditing(c.id); setModal(true); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => setDeleteTarget(c)} className="text-xs text-red-500 hover:underline">Delete</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {modal && <Modal title={editing ? 'Edit Call' : 'Log Call'} onClose={() => setModal(false)}>
        <div className="space-y-3">
          <FormField label="Call Subject" required error={errors.subject} name="subject"><input className={inputClass(errors.subject)} value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} /></FormField>
          <FormField label="Call Type" required><select className="input" value={form.call_type} onChange={e => setForm(p => ({ ...p, call_type: e.target.value }))}>{CALL_TYPES.map(t => <option key={t}>{t}</option>)}</select></FormField>
          <FormField label="Call Date & Time" required error={errors.start_time} name="start_time"><input className={inputClass(errors.start_time)} type="datetime-local" value={form.start_time?.slice(0,16)} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} /></FormField>
          <FormField label="Assigned To" required error={errors.assigned_to} name="assigned_to"><select className={inputClass(errors.assigned_to)} value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}><option value="">Select</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></FormField>
        </div>
        <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button onClick={save} className="btn-primary">Save</button></div>
      </Modal>}
      <ConfirmDialog open={!!deleteTarget} message={`Delete call "${deleteTarget?.subject}"?`} confirmLabel="Confirm Delete" danger
        onConfirm={() => { setDeleteTarget(null); showToast('Calls is not available on the Sales CRM API yet'); }} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
