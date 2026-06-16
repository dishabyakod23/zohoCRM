'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout from '../../../components/records/RecordDetailLayout.js';
import EditableFieldSection from '../../../components/records/EditableFieldSection.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { getApiError } from '../../../lib/api.js';
import * as meetingsApi from '../../../lib/services/meetings.js';
import { fetchUsers } from '../../../lib/services/lookups.js';
import { TrashIcon } from '@heroicons/react/24/outline';

export default function MeetingDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [meeting, setMeeting] = useState(null);
  const [users, setUsers] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchUsers().then(setUsers); }, []);

  const load = useCallback(() => {
    meetingsApi.getMeeting(id).then(setMeeting).catch(() => { showToast('Meeting not found'); router.push('/meetings'); });
  }, [id, router, showToast]);

  useEffect(() => { load(); }, [load]);

  const saveSection = async (payload) => {
    setSaving(true);
    try {
      await meetingsApi.updateMeeting(id, {
        ...payload,
        from_datetime: payload.from_datetime ?? payload.start_at,
        to_datetime: payload.to_datetime ?? payload.end_at,
      });
      load();
      showToast('Meeting updated', 'success');
    } catch (err) { showToast(getApiError(err)); }
    finally { setSaving(false); }
  };

  if (!meeting) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

  const values = { ...meeting, from_datetime: meeting.start_at, to_datetime: meeting.end_at };

  return (
    <CRMLayout>
      <RecordDetailLayout backHref="/meetings" backLabel="Meetings" title={meeting.title} subtitle={meeting.location}
        lastUpdated={meeting.updated_at ? new Date(meeting.updated_at).toLocaleString() : undefined}
        actions={canDelete && <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5"><TrashIcon className="w-4 h-4" /> Delete</button>}>
        <EditableFieldSection canEdit={canEdit} saving={saving} title="Meeting Details" values={values} onSave={saveSection}
          fields={[
            { name: 'title', label: 'Title', required: true },
            { name: 'from_datetime', label: 'From', format: (v) => (v ? new Date(v).toLocaleString() : null), render: (d, set) => (
              <input className="input" type="datetime-local" value={(d.from_datetime ?? '').slice(0, 16)} onChange={(e) => set((p) => ({ ...p, from_datetime: e.target.value }))} />
            ) },
            { name: 'to_datetime', label: 'To', format: (v) => (v ? new Date(v).toLocaleString() : null), render: (d, set) => (
              <input className="input" type="datetime-local" value={(d.to_datetime ?? '').slice(0, 16)} onChange={(e) => set((p) => ({ ...p, to_datetime: e.target.value }))} />
            ) },
            { name: 'host_id', label: 'Host', format: () => meeting.host_name, render: (d, set) => (
              <select className="input" value={d.host_id ?? ''} onChange={(e) => set((p) => ({ ...p, host_id: e.target.value }))}>
                <option value="">Select</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            ) },
            { name: 'location', label: 'Location' },
            { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
              <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
            ) },
          ]} />
      </RecordDetailLayout>
      <ConfirmDialog open={deleteConfirm} message={`Delete meeting "${meeting.title}"?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { try { await meetingsApi.deleteMeeting(id); router.push('/meetings'); } catch (err) { showToast(getApiError(err)); } }}
        onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
