'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import Badge from '../../../components/ui/Badge.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout from '../../../components/records/RecordDetailLayout.js';
import EditableFieldSection from '../../../components/records/EditableFieldSection.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { getApiError } from '../../../lib/api.js';
import * as projectsApi from '../../../lib/services/projects.js';
import { fetchAccountLookups, accountMapFromLookups, fetchProjectStatuses } from '../../../lib/services/lookups.js';
import { TrashIcon } from '@heroicons/react/24/outline';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [project, setProject] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchAccountLookups(), fetchProjectStatuses()]).then(([a, s]) => { setAccounts(a); setStatusOptions(s); });
  }, []);

  const load = useCallback(() => {
    const map = accountMapFromLookups(accounts);
    projectsApi.getProject(id, map).then((p) => setProject({ ...p, name: p.project_name }))
      .catch(() => { showToast('Project not found'); router.push('/projects'); });
  }, [id, accounts, router, showToast]);

  useEffect(() => { load(); }, [load]);

  const saveSection = async (payload) => {
    setSaving(true);
    try {
      await projectsApi.updateProject(id, { ...payload, name: payload.name ?? payload.project_name });
      load();
      showToast('Project updated', 'success');
    } catch (err) { showToast(getApiError(err)); throw err; }
    finally { setSaving(false); }
  };

  if (!project) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

  return (
    <CRMLayout>
      <RecordDetailLayout backHref="/projects" backLabel="Projects" title={project.name} subtitle={project.account_name}
        badges={<Badge label={project.status_label} />}
        recordNotes={{ relatedType: 'project', recordId: id, canEdit }}
        actions={canDelete && <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5"><TrashIcon className="w-4 h-4" /> Delete</button>}>
        <EditableFieldSection canEdit={canEdit} saving={saving} title="Project Details" values={project} onSave={saveSection}
          fields={[
            { name: 'name', label: 'Project Name', required: true },
            { name: 'account_id', label: 'Account', format: () => project.account_name, render: (d, set) => (
              <select className="input" value={d.account_id ?? ''} onChange={(e) => set((p) => ({ ...p, account_id: e.target.value }))}>
                <option value="">Select</option>{accounts.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            ) },
            { name: 'status', label: 'Status', format: () => project.status_label, render: (d, set) => (
              <select className="input" value={d.status ?? ''} onChange={(e) => set((p) => ({ ...p, status: e.target.value }))}>
                {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            ) },
            { name: 'start_date', label: 'Start Date', render: (d, set) => (
              <input className="input" type="date" value={(d.start_date ?? '').slice(0, 10)} onChange={(e) => set((p) => ({ ...p, start_date: e.target.value }))} />
            ) },
            { name: 'end_date', label: 'End Date', render: (d, set) => (
              <input className="input" type="date" value={(d.end_date ?? '').slice(0, 10)} onChange={(e) => set((p) => ({ ...p, end_date: e.target.value }))} />
            ) },
            { name: 'budget', label: 'Budget' },
            { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
              <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
            ) },
          ]} />
      </RecordDetailLayout>
      <ConfirmDialog open={deleteConfirm} message={`Delete project "${project.name}"?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { try { await projectsApi.deleteProject(id); router.push('/projects'); } catch (err) { showToast(getApiError(err)); } }}
        onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
