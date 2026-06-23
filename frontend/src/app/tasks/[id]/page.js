'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout from '../../../components/records/RecordDetailLayout.js';
import RecordDetailSkeleton from '../../../components/records/RecordDetailSkeleton.js';
import RelatedRecordCard from '../../../components/records/RelatedRecordCard.js';
import EditableFieldSection from '../../../components/records/EditableFieldSection.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { getApiError } from '../../../lib/api.js';
import { relatedRecordFromActivity } from '../../../lib/recordHelpers.js';
import * as tasksApi from '../../../lib/services/tasks.js';
import { fetchTaskStatuses, fetchTaskPriorities, fetchUsers } from '../../../lib/services/lookups.js';
import { TrashIcon } from '@heroicons/react/24/outline';

export default function TaskDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [task, setTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [priorityOptions, setPriorityOptions] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchTaskStatuses(), fetchTaskPriorities()])
      .then(([u, s, p]) => { setUsers(u); setStatusOptions(s); setPriorityOptions(p); });
  }, []);

  const load = useCallback(() => {
    tasksApi.getTask(id).then((t) => setTask({ ...t, title: t.title || t.subject, assigned_to: t.assigned_to ?? t.assigned_to_id }))
      .catch(() => { showToast('Task not found'); router.push('/tasks'); });
  }, [id, router, showToast]);

  useEffect(() => { load(); }, [load]);

  const saveSection = async (payload) => {
    setSaving(true);
    try {
      await tasksApi.updateTask(id, { ...payload, title: payload.title ?? payload.subject, assigned_to: payload.assigned_to ?? payload.assigned_to_id });
      load();
      showToast('Task updated', 'success');
    } catch (err) { showToast(getApiError(err)); throw err; }
    finally { setSaving(false); }
  };

  if (!task) return <CRMLayout><RecordDetailSkeleton /></CRMLayout>;

  const related = relatedRecordFromActivity(task);

  return (
    <CRMLayout>
      <RecordDetailLayout backHref="/tasks" backLabel="Tasks" title={task.title} subtitle={task.assigned_name}
        lastUpdated={task.updated_at ? new Date(task.updated_at).toLocaleString() : undefined}
        recordNotes={{ relatedType: 'task', recordId: id, canEdit }}
        recordHistory={{ entityType: 'task', recordId: id }}
        actions={canDelete && <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5"><TrashIcon className="w-4 h-4" /> Delete</button>}>
        <div className="space-y-4">
          {related && (
            <RelatedRecordCard relatedType={related.type} relatedId={related.id} label={related.label} />
          )}
          <EditableFieldSection canEdit={canEdit} saving={saving} title="Task Details" values={task} onSave={saveSection}
            fields={[
              { name: 'title', label: 'Subject', required: true },
              { name: 'due_date', label: 'Due Date', format: (v) => (v ? new Date(v).toLocaleString() : null), render: (d, set) => (
                <input className="input" type="datetime-local" value={(d.due_date ?? '').slice(0, 16)} onChange={(e) => set((p) => ({ ...p, due_date: e.target.value }))} />
              ) },
              { name: 'assigned_to', label: 'Assigned To', format: () => task.assigned_name, render: (d, set) => (
                <select className="input" value={d.assigned_to ?? ''} onChange={(e) => set((p) => ({ ...p, assigned_to: e.target.value }))}>
                  <option value="">Select</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) },
              { name: 'status', label: 'Status', format: () => task.status_label, render: (d, set) => (
                <select className="input" value={d.status ?? ''} onChange={(e) => set((p) => ({ ...p, status: e.target.value }))}>
                  {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              ) },
              { name: 'priority', label: 'Priority', format: () => task.priority_label, render: (d, set) => (
                <select className="input" value={d.priority ?? ''} onChange={(e) => set((p) => ({ ...p, priority: e.target.value }))}>
                  {priorityOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              ) },
              { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
                <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
              ) },
            ]} />
        </div>
      </RecordDetailLayout>
      <ConfirmDialog open={deleteConfirm} message={`Delete task "${task.title}"?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { try { await tasksApi.deleteTask(id); router.push('/tasks'); } catch (err) { showToast(getApiError(err)); } }}
        onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
