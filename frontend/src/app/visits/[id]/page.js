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
import * as visitsApi from '../../../lib/services/visits.js';
import { fetchAccountLookups, accountMapFromLookups, fetchVisitStatuses } from '../../../lib/services/lookups.js';
import { TrashIcon } from '@heroicons/react/24/outline';

export default function VisitDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [visit, setVisit] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchAccountLookups(), fetchVisitStatuses()]).then(([a, s]) => { setAccounts(a); setStatusOptions(s); });
  }, []);

  const load = useCallback(() => {
    const map = accountMapFromLookups(accounts);
    visitsApi.getVisit(id, map).then((v) => setVisit({ ...v, title: v.visit_name }))
      .catch(() => { showToast('Visit not found'); router.push('/visits'); });
  }, [id, accounts, router, showToast]);

  useEffect(() => { load(); }, [load]);

  const saveSection = async (payload) => {
    setSaving(true);
    try {
      await visitsApi.updateVisit(id, { ...payload, title: payload.title ?? payload.visit_name });
      load();
      showToast('Visit updated', 'success');
    } catch (err) { showToast(getApiError(err)); throw err; }
    finally { setSaving(false); }
  };

  if (!visit) return <CRMLayout><RecordDetailSkeleton /></CRMLayout>;

  const related = visit.related_type && visit.related_id
    ? { type: visit.related_type, id: visit.related_id, label: visit.account_name || visit.contact_name || `${visit.related_type} #${visit.related_id}` }
    : (visit.account_id ? { type: 'account', id: visit.account_id, label: visit.account_name } : null);

  return (
    <CRMLayout>
      <RecordDetailLayout backHref="/visits" backLabel="Visits" title={visit.title} subtitle={visit.location}
        recordNotes={{ relatedType: 'visit', recordId: id, canEdit }}
        recordHistory={{ entityType: 'visit', recordId: id }}
        actions={canDelete && <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5"><TrashIcon className="w-4 h-4" /> Delete</button>}>
        <div className="space-y-4">
          {related && (
            <RelatedRecordCard relatedType={related.type} relatedId={related.id} label={related.label} />
          )}
        <EditableFieldSection canEdit={canEdit} saving={saving} title="Visit Details" values={{ ...visit, title: visit.title || visit.visit_name }} onSave={saveSection}
          fields={[
            { name: 'title', label: 'Visit Name', required: true },
            { name: 'visit_date', label: 'Visit Date', format: (v) => (v ? new Date(v).toLocaleString() : null), render: (d, set) => (
              <input className="input" type="datetime-local" value={(d.visit_date ?? '').slice(0, 16)} onChange={(e) => set((p) => ({ ...p, visit_date: e.target.value }))} />
            ) },
            { name: 'account_id', label: 'Account', format: () => visit.account_name, render: (d, set) => (
              <select className="input" value={d.account_id ?? ''} onChange={(e) => set((p) => ({ ...p, account_id: e.target.value }))}>
                <option value="">None</option>{accounts.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            ) },
            { name: 'status', label: 'Status', format: () => visit.status_label, render: (d, set) => (
              <select className="input" value={d.status ?? ''} onChange={(e) => set((p) => ({ ...p, status: e.target.value }))}>
                {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            ) },
            { name: 'location', label: 'Location' },
            { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
              <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
            ) },
          ]} />
        </div>
      </RecordDetailLayout>
      <ConfirmDialog open={deleteConfirm} message={`Delete visit "${visit.title}"?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { try { await visitsApi.deleteVisit(id); router.push('/visits'); } catch (err) { showToast(getApiError(err)); } }}
        onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
