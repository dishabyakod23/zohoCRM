'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import Badge from '../../components/ui/Badge.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useOpenCreateParam } from '../../hooks/useOpenCreateParam.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired, validatePastDate } from '../../lib/validators.js';
import * as tasksApi from '../../lib/services/tasks.js';
import { fetchTaskStatuses, fetchTaskPriorities, fetchUsers } from '../../lib/services/lookups.js';

const EMPTY = { title: '', due_date: '', assigned_to: '', status: 'not_started', priority: 'normal', description: '' };
const REQUIRED = { title: 'Task Title', due_date: 'Due Date', assigned_to: 'Assigned To', status: 'Status' };
const LIMIT = 15;

export default function TasksPage() {
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [priorityOptions, setPriorityOptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchTaskStatuses(), fetchTaskPriorities()])
      .then(([u, s, p]) => { setUsers(u); setStatusOptions(s); setPriorityOptions(p); })
      .catch(() => {});
  }, []);

  const openCreate = useCallback(() => { setForm(EMPTY); setErrors({}); setModal(true); }, []);
  useOpenCreateParam(canEdit, openCreate);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await tasksApi.listTasks({ page, page_size: LIMIT, search: debouncedSearch || undefined });
      setTasks(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, showToast]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleSave = async () => {
    const errs = validateRequired(REQUIRED, form);
    const dateErr = validatePastDate(form.due_date?.split('T')[0], 'Due Date');
    if (dateErr) errs.due_date = dateErr;
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    setSaving(true);
    try {
      await tasksApi.createTask(form);
      setModal(false);
      fetchTasks();
      showToast('Task saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT) || 1;

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div><h1 className="text-xl font-bold">Tasks</h1><p className="text-xs text-gray-500">{total} tasks</p></div>
          {canEdit && <button onClick={openCreate} className="btn-primary">+ Create Task</button>}
        </div>
        <div className="card">
          <div className="p-4 border-b"><input className="input max-w-xs" placeholder="Search tasks..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
          <table className="w-full">
            <thead className="bg-gray-50"><tr>
              <th className="table-th">Title</th><th className="table-th">Due Date</th><th className="table-th">Assigned To</th>
              <th className="table-th">Status</th><th className="table-th">Priority</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? <tr><td colSpan={5} className="table-td text-center py-8">Loading...</td></tr>
              : tasks.length === 0 ? <tr><td colSpan={5} className="table-td text-center py-8 text-gray-400">No tasks found</td></tr>
              : tasks.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 group">
                  <td className="table-td font-medium"><Link href={`/tasks/${t.id}`} className="text-brand-600 hover:underline">{t.title}</Link></td>
                  <td className={`table-td ${new Date(t.due_date) < new Date() && t.status !== 'completed' ? 'text-red-600 font-medium' : ''}`}>
                    {new Date(t.due_date).toLocaleString()}
                  </td>
                  <td className="table-td">{t.assigned_name}</td>
                  <td className="table-td"><Badge label={t.status_label} /></td>
                  <td className="table-td">{t.priority_label}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex justify-end gap-2 px-4 py-3 border-t">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs disabled:opacity-40">Prev</button>
              <span className="text-xs self-center">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <Modal title="Create Task" onClose={() => setModal(false)}>
          <div className="space-y-3">
            <FormField label="Task Title" required error={errors.title} name="title"><input className={inputClass(errors.title)} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></FormField>
            <FormField label="Due Date & Time" required error={errors.due_date} name="due_date"><input className={inputClass(errors.due_date)} type="datetime-local" value={form.due_date?.slice(0, 16)} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></FormField>
            <FormField label="Assigned To" required error={errors.assigned_to} name="assigned_to">
              <select className={inputClass(errors.assigned_to)} value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                <option value="">Select</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </FormField>
            <FormField label="Status" required>
              <select className="input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </FormField>
            <FormField label="Priority">
              <select className="input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                {priorityOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </FormField>
            <FormField label="Description"><textarea className="input" rows={3} value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></FormField>
          </div>
          <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button></div>
        </Modal>
      )}
    </CRMLayout>
  );
}
