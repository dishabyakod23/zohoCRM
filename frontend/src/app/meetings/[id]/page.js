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
      await meetingsApi.updateMeeting(id, payload);
      load();
      showToast('Meeting updated', 'success');
    } catch (err) { showToast(getApiError(err)); throw err; }
    finally { setSaving(false); }
  };

  if (!meeting) return <CRMLayout><RecordDetailSkeleton /></CRMLayout>;

  const related = relatedRecordFromActivity(meeting);
  const participantLabel = (meeting.participants || [])
    .map((p) => `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email)
    .filter(Boolean)
    .join(', ') || '—';

  return (
    <CRMLayout>
      <RecordDetailLayout backHref="/meetings" backLabel="Meetings" title={meeting.title} subtitle={meeting.location}
        lastUpdated={meeting.updated_at ? new Date(meeting.updated_at).toLocaleString() : undefined}
        recordNotes={{ relatedType: 'meeting', recordId: id, canEdit }}
        recordHistory={{ entityType: 'meeting', recordId: id }}
        actions={canDelete && <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5"><TrashIcon className="w-4 h-4" /> Delete</button>}>
        <div className="space-y-4">
          {related && (
            <RelatedRecordCard relatedType={related.type} relatedId={related.id} label={related.label} />
          )}
          <EditableFieldSection canEdit={canEdit} saving={saving} title="Meeting Details" values={meeting} onSave={saveSection}
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
              { name: 'participant_ids', label: 'Participants', format: () => participantLabel, render: (d, set) => (
                <div className="border border-zoho-border rounded-xl max-h-40 overflow-y-auto p-2 space-y-1">
                  {users.filter((u) => String(u.id) !== String(d.host_id)).map((u) => {
                    const ids = d.participant_ids || [];
                    const checked = ids.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-brand-50 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked ? ids.filter((x) => x !== u.id) : [...ids, u.id];
                            set((p) => ({ ...p, participant_ids: next }));
                          }}
                          className="rounded border-zoho-border text-brand-600 focus:ring-brand-500"
                        />
                        <span>{u.name}</span>
                      </label>
                    );
                  })}
                </div>
              ) },
              { name: 'location', label: 'Location' },
              { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
                <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
              ) },
            ]} />
        </div>
      </RecordDetailLayout>
      <ConfirmDialog open={deleteConfirm} message={`Delete meeting "${meeting.title}"?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { try { await meetingsApi.deleteMeeting(id); router.push('/meetings'); } catch (err) { showToast(getApiError(err)); } }}
        onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
