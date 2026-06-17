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
import * as campaignsApi from '../../../lib/services/campaigns.js';
import { fetchCampaignTypes, fetchCampaignStatuses } from '../../../lib/services/lookups.js';
import { TrashIcon } from '@heroicons/react/24/outline';

export default function CampaignDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [campaign, setCampaign] = useState(null);
  const [typeOptions, setTypeOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchCampaignTypes(), fetchCampaignStatuses()]).then(([t, s]) => { setTypeOptions(t); setStatusOptions(s); });
  }, []);

  const load = useCallback(() => {
    campaignsApi.getCampaign(id).then((c) => setCampaign({ ...c, name: c.campaign_name, type: c.campaign_type }))
      .catch(() => { showToast('Campaign not found'); router.push('/campaigns'); });
  }, [id, router, showToast]);

  useEffect(() => { load(); }, [load]);

  const saveSection = async (payload) => {
    setSaving(true);
    try {
      await campaignsApi.updateCampaign(id, { ...payload, name: payload.name ?? payload.campaign_name, type: payload.type ?? payload.campaign_type });
      load();
      showToast('Campaign updated', 'success');
    } catch (err) { showToast(getApiError(err)); }
    finally { setSaving(false); }
  };

  if (!campaign) return <CRMLayout><div className="p-6">Loading...</div></CRMLayout>;

  return (
    <CRMLayout>
      <RecordDetailLayout backHref="/campaigns" backLabel="Campaigns" title={campaign.name} badges={<Badge label={campaign.status_label} />}
        lastUpdated={campaign.updated_at ? new Date(campaign.updated_at).toLocaleString() : undefined}
        recordNotes={{ relatedType: 'campaign', recordId: id, canEdit }}
        actions={canDelete && <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5"><TrashIcon className="w-4 h-4" /> Delete</button>}>
        <EditableFieldSection canEdit={canEdit} saving={saving} title="Campaign Details" values={campaign} onSave={saveSection}
          fields={[
            { name: 'name', label: 'Campaign Name', required: true },
            { name: 'type', label: 'Type', format: () => campaign.type_label, render: (d, set) => (
              <select className="input" value={d.type ?? ''} onChange={(e) => set((p) => ({ ...p, type: e.target.value }))}>
                {typeOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            ) },
            { name: 'status', label: 'Status', format: () => campaign.status_label, render: (d, set) => (
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
            { name: 'expected_revenue', label: 'Expected Revenue' },
            { name: 'member_count', label: 'Members', format: () => String(campaign.member_count || 0) },
            { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
              <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
            ) },
          ]} />
      </RecordDetailLayout>
      <ConfirmDialog open={deleteConfirm} message={`Delete campaign "${campaign.name}"?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { try { await campaignsApi.deleteCampaign(id); router.push('/campaigns'); } catch (err) { showToast(getApiError(err)); } }}
        onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
