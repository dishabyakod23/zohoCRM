'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import Badge from '../../../components/ui/Badge.js';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.js';
import RecordDetailLayout from '../../../components/records/RecordDetailLayout.js';
import RecordDetailSkeleton from '../../../components/records/RecordDetailSkeleton.js';
import EditableFieldSection from '../../../components/records/EditableFieldSection.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { getApiError } from '../../../lib/api.js';
import * as dealsApi from '../../../lib/services/deals.js';
import * as contactsApi from '../../../lib/services/contacts.js';
import { fetchDealStages, fetchAccountLookups, accountMapFromLookups } from '../../../lib/services/lookups.js';
import { FALLBACK_DEAL_STAGES } from '../../../lib/dealHelpers.js';
import { LEAD_SOURCES, DEAL_TYPES, DEFAULT_PAGE_SIZE } from '../../../lib/constants.js';
import { trackRecentItem } from '../../../components/layout/BottomUtilityBar.js';
import { TrashIcon } from '@heroicons/react/24/outline';
import { formatMoney, CURRENCIES } from '../../../lib/currencies.js';

export default function DealDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [deal, setDeal] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [stageOptions, setStageOptions] = useState(FALLBACK_DEAL_STAGES);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAccountLookups().then(setAccounts).catch(() => {});
    fetchDealStages().then(setStageOptions).catch(() => setStageOptions(FALLBACK_DEAL_STAGES));
    contactsApi.listContacts({ page: 1, page_size: DEFAULT_PAGE_SIZE }).then((r) => setContacts(r.data || [])).catch(() => {});
  }, []);

  const loadDeal = useCallback(() => {
    const accountMap = accountMapFromLookups(accounts);
    dealsApi.getDeal(id, accountMap, stageOptions).then((r) => {
      setDeal({
        ...r,
        deal_name: r.deal_name || r.name,
        closing_date: r.closing_date?.split('T')[0] || r.close_date?.split('T')[0] || '',
      });
      trackRecentItem({ type: 'deal', id, name: r.name || r.deal_name });
    }).catch(() => {
      showToast('Deal not found');
      router.push('/deals');
    });
  }, [id, accounts, stageOptions, router, showToast]);

  useEffect(() => { if (stageOptions.length) loadDeal(); }, [loadDeal, stageOptions.length]);

  const saveSection = async (payload) => {
    setSaving(true);
    try {
      await dealsApi.updateDeal(id, payload);
      loadDeal();
      showToast('Deal updated', 'success');
    } catch (err) {
      showToast(getApiError(err));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const reopenAsLead = async () => {
    setSaving(true);
    try {
      const result = await dealsApi.reopenDealAsLead(id);
      showToast('Deal reopened as lead', 'success');
      if (result?.lead_id) router.push(`/leads/${result.lead_id}`);
      else loadDeal();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n, currency) => formatMoney(n, currency || deal?.currency);

  if (!deal) return <CRMLayout><RecordDetailSkeleton /></CRMLayout>;

  const isClosedLost = String(deal.stage_value || deal.stage || '').toLowerCase().includes('closed_lost')
    || String(deal.stage || '').toLowerCase().includes('closed lost');

  return (
    <CRMLayout>
      <RecordDetailLayout
        backHref="/deals" backLabel="Deals"
        title={deal.deal_name || deal.name}
        subtitle={deal.account_name || 'No account linked'}
        badges={<Badge label={deal.stage} />}
        lastUpdated={deal.updated_at ? new Date(deal.updated_at).toLocaleString() : undefined}
        recordNotes={{ relatedType: 'deal', recordId: id, canEdit }}
        recordActivities={{ entityType: 'deal', recordId: id }}
        recordHistory={{ entityType: 'deal', recordId: id }}
        actions={<>
          {canEdit && isClosedLost && (
            <button type="button" onClick={reopenAsLead} disabled={saving} className="btn-secondary text-xs">
              Reopen as Lead
            </button>
          )}
          {canDelete && (
            <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-xs flex items-center gap-1.5">
              <TrashIcon className="w-4 h-4" /> Delete
            </button>
          )}
        </>}
      >
        <div className="space-y-4">
          <EditableFieldSection
            title="Deal Information"
            canEdit={canEdit}
            saving={saving}
            values={deal}
            onSave={saveSection}
            fields={[
              { name: 'deal_name', label: 'Deal Name', required: true, colSpan: true },
              { name: 'account_id', label: 'Account', format: () => deal.account_name, render: (d, set) => (
                <select className="input" value={d.account_id ?? ''} onChange={(e) => set((p) => ({ ...p, account_id: e.target.value }))}>
                  <option value="">--None--</option>
                  {accounts.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              ) },
              { name: 'contact_id', label: 'Contact', format: () => deal.contact_name, render: (d, set) => (
                <select className="input" value={d.contact_id ?? ''} onChange={(e) => set((p) => ({ ...p, contact_id: e.target.value }))}>
                  <option value="">--None--</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              ) },
              { name: 'amount', label: 'Amount', format: (v) => fmt(v, deal.currency) },
              { name: 'currency', label: 'Currency', render: (d, set) => (
                <select className="input" value={d.currency ?? deal.currency ?? 'INR'} onChange={(e) => set((p) => ({ ...p, currency: e.target.value }))}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </select>
              ) },
              { name: 'closing_date', label: 'Closing Date', format: (v) => (v ? new Date(v).toLocaleDateString() : null), render: (d, set) => (
                <input className="input" type="date" value={(d.closing_date ?? '').slice(0, 10)} onChange={(e) => set((p) => ({ ...p, closing_date: e.target.value }))} />
              ) },
              { name: 'stage_value', label: 'Stage', format: () => deal.stage, render: (d, set) => (
                <select className="input" value={d.stage_value ?? ''} onChange={(e) => set((p) => ({ ...p, stage_value: e.target.value }))}>
                  {stageOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              ) },
              { name: 'probability', label: 'Probability (%)', format: (v) => (v != null ? `${v}%` : null) },
              { name: 'deal_type', label: 'Deal Type', render: (d, set) => (
                <select className="input" value={d.deal_type ?? ''} onChange={(e) => set((p) => ({ ...p, deal_type: e.target.value }))}>
                  <option value="">--None--</option>
                  {DEAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              ) },
              { name: 'lead_source', label: 'Lead Source', render: (d, set) => (
                <select className="input" value={d.lead_source ?? ''} onChange={(e) => set((p) => ({ ...p, lead_source: e.target.value }))}>
                  <option value="">--None--</option>
                  {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) },
              { name: 'owner_name', label: 'Owner', format: () => deal.owner_name },
            ]}
          />
          <EditableFieldSection
            title="Description"
            canEdit={canEdit}
            saving={saving}
            values={deal}
            onSave={saveSection}
            fields={[
              { name: 'description', label: 'Description', colSpan: true, render: (d, set) => (
                <textarea className="input min-h-[80px]" value={d.description ?? ''} onChange={(e) => set((p) => ({ ...p, description: e.target.value }))} />
              ) },
            ]}
          />
        </div>
      </RecordDetailLayout>

      <ConfirmDialog open={deleteConfirm} message={`Delete ${deal.deal_name || deal.name}?`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => {
          try { await dealsApi.deleteDeal(id); router.push('/deals'); showToast('Deal deleted', 'success'); }
          catch (err) { showToast(getApiError(err)); }
        }} onCancel={() => setDeleteConfirm(false)} />
    </CRMLayout>
  );
}
