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
import * as callsApi from '../../../lib/services/calls.js';
import { fetchCallTypes, fetchUsers } from '../../../lib/services/lookups.js';
import { TrashIcon } from '@heroicons/react/24/outline';

export default function CallDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [call, setCall] = useState(null);
  const [users, setUsers] = useState([]);
  const [callTypes, setCallTypes] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { Promise.all([fetchUsers(), fetchCallTypes()]).then(([u, t]) => { setUsers(u); setCallTypes(t); }); }, []);

  const load = useCallback(() => {
    callsApi.getCall(id).then(setCall).catch(() => { showToast('Call not found'); router.push('/calls'); });
  }, [id, router, showToast]);

  useEffect(() => { load(); }, [load]);

  const saveSection = async (payload) => {
    setSaving(true);
    try {
      await callsApi.updateCall(id, {
        ...payload,
        start_time: payload.start_time ?? payload.call_start_at,
        assigned_to: payload.assigned_to ?? payload.owner_id,
        duration: payload.duration ?? payload.duration_minutes,
      });
      load();
      showToast('Call updated', 'success');
    } catch (err) { showToast(getApiError(err)); throw err; }
    finally { setSaving(false); }
  };

  if (!call) return <CRMLayout><RecordDetailSkeleton /></CRMLayout>;

  const related = relatedRecordFromActivity(call);
  const editValues = { ...call, duration: call.duration ?? call.duration_minutes };

  return (
    <CRMLayout>
      <RecordDetailLayout backHref="/calls" backLabel="Calls" title={call.subject} subtitle={call.call_type_label}
        lastUpdated={call.updated_at ? new Date(call.updated_at).toLocaleString() : undefined}
        recordNotes={{ relatedType: 'call', recordId: id, canEdit }}
        recordHistory={{ entityType: 'call', recordId: id }}
        actions={canDelete && <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5"><TrashIcon className="w-4 h-4" /> Delete</button>}>
        <div className="space-y-4">
          {related && (
            <RelatedRecordCard relatedType={related.type} relatedId={related.id} label={related.label} />
          )}
          <EditableFieldSection canEdit={canEdit} saving={saving} title="Call Details" values={editValues} onSave={saveSection}
            fields={[
              { name: 'subject', label: 'Subject', required: true },
              { name: 'call_type', label: 'Type', format: () => call.call_type_label, render: (d, set) => (
                <select className="input" value={d.call_type ?? ''} onChange={(e) => set((p) => ({ ...p, call_type: e.target.value }))}>
                  {callTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              ) },
              { name: 'start_time', label: 'Date & Time', format: (v) => (v ? new Date(v).toLocaleString() : null), render: (d, set) => (
                <input className="input" type="datetime-local" value={(d.start_time ?? '').slice(0, 16)} onChange={(e) => set((p) => ({ ...p, start_time: e.target.value }))} />
              ) },
              { name: 'duration', label: 'Duration (min)' },
              { name: 'assigned_to', label: 'Assigned To', format: () => call.assigned_name, render: (d, set) => (
                <select className="input" value={d.assigned_to ?? ''} onChange={(e) => set((p) => ({ ...p, assigned_to: e.target.value }))}>
                  <option value="">Select</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) },
              { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
                <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
              ) },
            ]} />
        </div>
      </RecordDetailLayout>
      <ConfirmDialog open={deleteConfirm} message={`Delete call "${call.subject}"?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { try { await callsApi.deleteCall(id); router.push('/calls'); } catch (err) { showToast(getApiError(err)); } }}
        onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
