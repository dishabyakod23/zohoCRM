'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import Badge from '../../../components/ui/Badge.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout from '../../../components/records/RecordDetailLayout.js';
import RecordDetailSkeleton from '../../../components/records/RecordDetailSkeleton.js';
import EditableFieldSection from '../../../components/records/EditableFieldSection.js';
import Link from 'next/link';
import { tableLinkClass } from '../../../lib/tableStyles.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { getApiError } from '../../../lib/api.js';
import * as campaignsApi from '../../../lib/services/campaigns.js';
import { fetchCampaignTypes, fetchCampaignStatuses, fetchUsers } from '../../../lib/services/lookups.js';
import { getLeadDetailPath } from '../../../lib/pipelineHelpers.js';
import { TrashIcon } from '@heroicons/react/24/outline';

export default function CampaignDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [campaign, setCampaign] = useState(null);
  const [typeOptions, setTypeOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [users, setUsers] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchCampaignTypes(), fetchCampaignStatuses(), fetchUsers()])
      .then(([t, s, u]) => { setTypeOptions(t); setStatusOptions(s); setUsers(u); });
  }, []);

  const load = useCallback(() => {
    campaignsApi.getCampaign(id).then(setCampaign)
      .catch(() => { showToast('Campaign not found'); router.push('/campaigns'); });
  }, [id, router, showToast]);

  useEffect(() => { load(); }, [load]);

  const saveSection = async (payload) => {
    setSaving(true);
    try {
      await campaignsApi.updateCampaign(id, { ...payload, name: payload.name ?? payload.campaign_name, type: payload.type ?? payload.campaign_type });
      load();
      showToast('Campaign updated', 'success');
    } catch (err) { showToast(getApiError(err)); throw err; }
    finally { setSaving(false); }
  };

  if (!campaign) return <CRMLayout><RecordDetailSkeleton /></CRMLayout>;

  const members = campaign.members || [];

  return (
    <CRMLayout>
      <RecordDetailLayout backHref="/campaigns" backLabel="Campaigns" title={campaign.name} badges={<Badge label={campaign.status_label} />}
        lastUpdated={campaign.updated_at ? new Date(campaign.updated_at).toLocaleString() : undefined}
        recordNotes={{ relatedType: 'campaign', recordId: id, canEdit }}
        recordActivities={{ entityType: 'campaign', recordId: id }}
        recordHistory={{ entityType: 'campaign', recordId: id }}
        actions={canDelete && <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5"><TrashIcon className="w-4 h-4" /> Delete</button>}>
        <div className="space-y-4">
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
            { name: 'budgeted_cost', label: 'Budgeted Cost' },
            { name: 'actual_cost', label: 'Actual Cost' },
            { name: 'expected_response', label: 'Expected Response (%)' },
            { name: 'numbers_sent', label: 'Numbers Sent' },
            { name: 'owner_id', label: 'Owner', format: () => campaign.owner_name, render: (d, set) => (
              <select className="input" value={d.owner_id ?? ''} onChange={(e) => set((p) => ({ ...p, owner_id: e.target.value }))}>
                <option value="">--None--</option>
                {users.map((u) => <option key={u.id || u.value} value={u.id || u.value}>{u.name}</option>)}
              </select>
            ) },
            { name: 'member_count', label: 'Members', readOnly: true, format: () => String(campaign.member_count || (campaign.members || []).length || 0) },
            { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
              <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
            ) },
          ]} />
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-zoho-text mb-3">Campaign Members</h3>
            {members.length === 0 ? (
              <p className="text-sm text-zoho-muted">No members added to this campaign yet.</p>
            ) : (
              <ul className="divide-y divide-zoho-border">
                {members.map((member) => {
                  const href = member.member_type === 'lead'
                    ? getLeadDetailPath(member.lead || member, member.member_id)
                    : member.member_type === 'account'
                      ? `/accounts/${member.member_id}`
                      : `/contacts/${member.member_id}`;
                  return (
                    <li key={member.id} className="py-2 flex items-center justify-between gap-3">
                      <Link href={href} className={`text-sm font-medium ${tableLinkClass}`}>
                        {member.member_name || `${member.member_type} #${member.member_id}`}
                      </Link>
                      <span className="text-xs text-zoho-muted capitalize">{member.member_type}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </RecordDetailLayout>
      <ConfirmDialog open={deleteConfirm} message={`Delete campaign "${campaign.name}"?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { try { await campaignsApi.deleteCampaign(id); router.push('/campaigns'); } catch (err) { showToast(getApiError(err)); } }}
        onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
