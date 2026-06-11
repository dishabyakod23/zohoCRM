'use client';
import { useEffect, useState, useCallback } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import api from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';

const EMPTY = { title: '', from_datetime: '', to_datetime: '', host_id: '', location: '', description: '' };
const REQUIRED = { title: 'Meeting Title', from_datetime: 'From Date & Time', to_datetime: 'To Date & Time', host_id: 'Host' };

export default function MeetingsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetch = useCallback(() => api.get('/meetings').then(r => setItems(r.data.data)), []);
  useEffect(() => { fetch(); api.get('/users').then(r => setUsers(r.data)); }, [fetch]);

  const save = async () => {
    const errs = validateRequired(REQUIRED, form);
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    if (editing) await api.put(`/meetings/${editing}`, form);
    else await api.post('/meetings', form);
    setModal(false); fetch(); showToast('Meeting saved', 'success');
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex justify-between mb-5"><h1 className="text-xl font-bold">Meetings</h1><button onClick={() => { setForm(EMPTY); setEditing(null); setModal(true); }} className="btn-primary">+ Create Meeting</button></div>
        <div className="card overflow-x-auto">
          <table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">Title</th><th className="table-th">From</th><th className="table-th">To</th><th className="table-th">Host</th><th className="table-th">Location</th><th className="table-th">Actions</th></tr></thead>
            <tbody className="divide-y">{items.map(m => (
              <tr key={m.id} className="hover:bg-gray-50 group">
                <td className="table-td font-medium">{m.title}</td>
                <td className="table-td">{new Date(m.from_datetime).toLocaleString()}</td>
                <td className="table-td">{new Date(m.to_datetime).toLocaleString()}</td>
                <td className="table-td">{m.host_name}</td>
                <td className="table-td">{m.location || '—'}</td>
                <td className="table-td"><div className="flex gap-3">
                  <button onClick={() => { setForm({ ...m, host_id: String(m.host_id) }); setEditing(m.id); setModal(true); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => setDeleteTarget(m)} className="text-xs text-red-500 hover:underline">Delete</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {modal && <Modal title={editing ? 'Edit Meeting' : 'Create Meeting'} onClose={() => setModal(false)}>
        <div className="space-y-3">
          <FormField label="Meeting Title" required error={errors.title} name="title"><input className={inputClass(errors.title)} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></FormField>
          <FormField label="From" required error={errors.from_datetime} name="from_datetime"><input className={inputClass(errors.from_datetime)} type="datetime-local" value={form.from_datetime?.slice(0,16)} onChange={e => setForm(p => ({ ...p, from_datetime: e.target.value }))} /></FormField>
          <FormField label="To" required error={errors.to_datetime} name="to_datetime"><input className={inputClass(errors.to_datetime)} type="datetime-local" value={form.to_datetime?.slice(0,16)} onChange={e => setForm(p => ({ ...p, to_datetime: e.target.value }))} /></FormField>
          <FormField label="Host" required error={errors.host_id} name="host_id"><select className={inputClass(errors.host_id)} value={form.host_id} onChange={e => setForm(p => ({ ...p, host_id: e.target.value }))}><option value="">Select</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></FormField>
          <FormField label="Location"><input className="input" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} /></FormField>
        </div>
        <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button onClick={save} className="btn-primary">Save</button></div>
      </Modal>}
      <ConfirmDialog open={!!deleteTarget} message={`Are you sure you want to delete ${deleteTarget?.title}?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { await api.delete(`/meetings/${deleteTarget.id}`); setDeleteTarget(null); fetch(); }} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
