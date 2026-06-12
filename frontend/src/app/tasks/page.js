'use client';
import { useEffect, useState, useCallback } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import Badge from '../../components/ui/Badge.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import ApiPendingBanner from '../../components/ui/ApiPendingBanner.js';
import { TASK_STATUSES, TASK_PRIORITIES } from '../../lib/constants.js';
import { validateRequired, validatePastDate } from '../../lib/validators.js';

const EMPTY = { title: '', due_date: '', assigned_to: '', status: 'Not Started', priority: 'Normal', description: '' };
const REQUIRED = { title: 'Task Title', due_date: 'Due Date', assigned_to: 'Assigned To', status: 'Status' };

export default function TasksPage() {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchTasks = useCallback(async () => {
    setLoading(false);
    setTasks([]);
    setTotal(0);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleSave = async () => {
    const errs = validateRequired(REQUIRED, form);
    const dateErr = validatePastDate(form.due_date?.split('T')[0], 'Due Date');
    if (dateErr) errs.due_date = dateErr;
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    showToast('Tasks is not available on the Sales CRM API yet');
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <ApiPendingBanner module="Tasks" />
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold">Tasks</h1>
          <button onClick={() => { setForm(EMPTY); setEditing(null); setModal(true); }} className="btn-primary">+ Create Task</button>
        </div>
        <div className="card">
          <div className="p-4 border-b"><input className="input max-w-xs" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <table className="w-full">
            <thead className="bg-gray-50"><tr>
              <th className="table-th">Title</th><th className="table-th">Due Date</th><th className="table-th">Assigned To</th>
              <th className="table-th">Status</th><th className="table-th">Priority</th><th className="table-th">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? <tr><td colSpan={6} className="table-td text-center py-8">Loading...</td></tr>
              : tasks.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 group">
                  <td className="table-td font-medium">{t.title}</td>
                  <td className={`table-td ${new Date(t.due_date) < new Date() && t.status !== 'Completed' ? 'text-red-600 font-medium' : ''}`}>
                    {new Date(t.due_date).toLocaleString()}
                  </td>
                  <td className="table-td">{t.assigned_name}</td>
                  <td className="table-td"><Badge label={t.status} /></td>
                  <td className="table-td">{t.priority}</td>
                  <td className="table-td">
                    <div className="flex gap-3">
                      <button onClick={() => { setForm({ ...t, assigned_to: String(t.assigned_to) }); setEditing(t.id); setModal(true); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => setDeleteTarget(t)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Task' : 'Create Task'} onClose={() => setModal(false)}>
          <div className="space-y-3">
            <FormField label="Task Title" required error={errors.title} name="title"><input className={inputClass(errors.title)} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></FormField>
            <FormField label="Due Date & Time" required error={errors.due_date} name="due_date"><input className={inputClass(errors.due_date)} type="datetime-local" value={form.due_date?.slice(0,16)} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></FormField>
            <FormField label="Assigned To" required error={errors.assigned_to} name="assigned_to">
              <select className={inputClass(errors.assigned_to)} value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                <option value="">Select</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </FormField>
            <FormField label="Status" required><select className="input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>{TASK_STATUSES.map(s => <option key={s}>{s}</option>)}</select></FormField>
            <FormField label="Priority"><select className="input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>{TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></FormField>
            <FormField label="Description"><textarea className="input" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></FormField>
          </div>
          <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSave} className="btn-primary">Save</button></div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleteTarget} message={`Are you sure you want to delete ${deleteTarget?.title}? This action cannot be undone.`} confirmLabel="Confirm Delete" danger
        onConfirm={() => { setDeleteTarget(null); showToast('Tasks is not available on the Sales CRM API yet'); }} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
