'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import Badge from '../../components/ui/Badge.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';
import { FALLBACK_DEAL_STAGES } from '../../lib/dealHelpers.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useOpenCreateParam } from '../../hooks/useOpenCreateParam.js';
import * as dealsApi from '../../lib/services/deals.js';
import { fetchDealStages, fetchAccountLookups, accountMapFromLookups } from '../../lib/services/lookups.js';
import * as contactsApi from '../../lib/services/contacts.js';
import { LEAD_SOURCES, DEAL_TYPES } from '../../lib/constants.js';

const EMPTY = { deal_name: '', amount: '', stage_value: 'qualification', closing_date: '', probability: 10, account_id: '', contact_id: '', deal_type: '', lead_source: '', description: '', proposal_amount: '' };

export default function DealsPage() {
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [deals, setDeals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [stageOptions, setStageOptions] = useState(FALLBACK_DEAL_STAGES);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [stageMove, setStageMove] = useState(null);
  const [dragDeal, setDragDeal] = useState(null);

  const accountMap = useMemo(() => accountMapFromLookups(accounts), [accounts]);

  useEffect(() => {
    fetchAccountLookups().then(setAccounts).catch(() => setAccounts([]));
    fetchDealStages().then(setStageOptions).catch(() => setStageOptions(FALLBACK_DEAL_STAGES));
    contactsApi.listContacts({ page: 1, page_size: 200 }).then(r => setContacts(r.data || [])).catch(() => setContacts([]));
  }, []);

  const openCreate = useCallback(() => { setForm(EMPTY); setErrors({}); setModal(true); }, []);
  useOpenCreateParam(canEdit, openCreate);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dealsApi.listDeals({
        page,
        page_size: limit,
        search: debouncedSearch || undefined,
      }, accountMap, stageOptions);
      setDeals(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, accountMap, stageOptions, showToast]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const totalPages = Math.ceil(total / limit) || 1;

  const handleSave = async () => {
    const errs = validateRequired({ deal_name: 'Deal Name', account_id: 'Account Name', closing_date: 'Closing Date', stage_value: 'Stage', amount: 'Amount' }, form);
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    setSaving(true);
    try {
      await dealsApi.createDeal(form);
      setModal(false);
      fetchDeals();
      showToast('Deal saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmStageMove = async () => {
    if (!stageMove) return;
    try {
      await dealsApi.updateDeal(stageMove.deal.id, { stage_value: stageMove.newStage });
      setStageMove(null);
      fetchDeals();
      showToast('Deal stage updated', 'success');
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const stageLabel = (value) => stageOptions.find(s => s.value === value)?.label || value;
  const fmt = (n) => n ? `₹${(n / 100000).toFixed(1)}L` : '—';
  const byStage = (stageValue) => deals.filter(d => d.stage_value === stageValue);

  const columns = useMemo(() => [
    { id: 'name', header: 'Deal Name', cell: (d) => <Link href={`/deals/${d.id}`} className="font-medium text-brand-600 hover:text-brand-700">{d.name}</Link> },
    { id: 'account', header: 'Account', cell: (d) => d.account_name || '—' },
    { id: 'amount', header: 'Amount', cell: (d) => fmt(d.amount) },
    { id: 'stage', header: 'Stage', cell: (d) => <Badge label={d.stage} /> },
    { id: 'close_date', header: 'Closing Date', cell: (d) => d.close_date ? new Date(d.close_date).toLocaleDateString() : '—' },
    { id: 'probability', header: 'Probability', cell: (d) => `${d.probability}%` },
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div><h1 className="text-xl font-bold">Deals</h1><p className="text-xs text-gray-500">{total} deals</p></div>
          <div className="flex gap-2">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setView('table')} className={`px-3 py-1.5 text-xs ${view === 'table' ? 'bg-brand-500 text-white' : 'bg-white text-gray-600'}`}>List</button>
              <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-xs ${view === 'kanban' ? 'bg-brand-500 text-white' : 'bg-white text-gray-600'}`}>Kanban</button>
            </div>
            {canEdit && (
            <button onClick={openCreate} className="btn-primary">+ Create Deal</button>
            )}
          </div>
        </div>

        {view === 'table' ? (
          <div className="card">
            <div className="px-4 py-3 border-b border-zoho-border">
              <div className="relative max-w-xs">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zoho-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input className="input pl-8 py-1.5 text-xs" placeholder="Search deals…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              </div>
            </div>
            <RecordDataTable
              moduleKey="deals"
              records={deals}
              loading={loading}
              columns={columns}
              statusOptions={stageOptions}
              onRefresh={fetchDeals}
              emptyMessage="No deals found"
              pagination={{
                page,
                totalPages,
                onPageChange: setPage,
                label: total ? `${((page - 1) * limit) + 1}–${Math.min(page * limit, total)} of ${total}` : '0 records',
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            {loading ? <p className="text-center text-gray-400 py-10">Loading...</p> : (
              <div className="flex gap-3 min-w-max">
                {stageOptions.map(({ value, label }) => (
                  <div key={value} className="w-56 flex flex-col"
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => { if (dragDeal && dragDeal.stage_value !== value) setStageMove({ deal: dragDeal, newStage: value }); setDragDeal(null); }}>
                    <div className="px-3 py-2 bg-gray-100 rounded-t-lg border border-b-0">
                      <span className="text-xs font-semibold">{label}</span>
                      <span className="text-xs text-gray-400 ml-2">{byStage(value).length}</span>
                    </div>
                    <div className="flex-1 space-y-2 p-2 bg-gray-50 border rounded-b-lg min-h-40">
                      {byStage(value).map(d => (
                        <div key={d.id} className="bg-white border rounded-lg p-3 shadow-sm hover:border-brand-300 text-xs flex gap-2">
                          <div
                            draggable
                            onDragStart={() => setDragDeal(d)}
                            className="cursor-grab text-gray-400 shrink-0 select-none pt-0.5"
                            title="Drag to change stage"
                            aria-label="Drag to change stage"
                          >
                            ⋮⋮
                          </div>
                          <Link href={`/deals/${d.id}`} className="flex-1 block min-w-0">
                            <p className="font-medium">{d.name}</p><p className="text-gray-500">{d.account_name}</p>
                            <p className="font-semibold mt-1">{fmt(d.amount)}</p>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {modal && (
        <Modal title="Create Deal" onClose={() => setModal(false)}>
          {/* Deal Information */}
          <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-3">Deal Information</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="col-span-2"><FormField label="Deal Name" required error={errors.deal_name} name="deal_name"><input className={inputClass(errors.deal_name)} value={form.deal_name} onChange={e => { setForm(p => ({ ...p, deal_name: e.target.value })); setErrors(er => ({ ...er, deal_name: null })); }} /></FormField></div>
            <FormField label="Account Name" required error={errors.account_id} name="account_id">
              <select className={inputClass(errors.account_id)} value={form.account_id} onChange={e => { setForm(p => ({ ...p, account_id: e.target.value })); setErrors(er => ({ ...er, account_id: null })); }}>
                <option value="">--None--</option>
                {accounts.map(a => <option key={a.value} value={a.value}>{a.label || a.name}</option>)}
              </select>
            </FormField>
            <FormField label="Contact Name">
              <select className="input" value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">--None--</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </FormField>
            <FormField label="Amount (₹)" required error={errors.amount} name="amount"><input className={inputClass(errors.amount)} type="number" value={form.amount} onChange={e => { setForm(p => ({ ...p, amount: e.target.value })); setErrors(er => ({ ...er, amount: null })); }} /></FormField>
            <FormField label="Closing Date" required error={errors.closing_date} name="closing_date"><input className={inputClass(errors.closing_date)} type="date" value={form.closing_date?.slice(0, 10)} onChange={e => { setForm(p => ({ ...p, closing_date: e.target.value })); setErrors(er => ({ ...er, closing_date: null })); }} /></FormField>
            <FormField label="Stage" required error={errors.stage_value} name="stage_value">
              <select className={inputClass(errors.stage_value)} value={form.stage_value} onChange={e => { setForm(p => ({ ...p, stage_value: e.target.value })); setErrors(er => ({ ...er, stage_value: null })); }}>
                {stageOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </FormField>
            <FormField label="Probability (%)"><input className="input" type="number" value={form.probability} onChange={e => setForm(p => ({ ...p, probability: e.target.value }))} /></FormField>
            <FormField label="Deal Type">
              <select className="input" value={form.deal_type} onChange={e => setForm(p => ({ ...p, deal_type: e.target.value }))}>
                <option value="">--None--</option>{DEAL_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Lead Source">
              <select className="input" value={form.lead_source} onChange={e => setForm(p => ({ ...p, lead_source: e.target.value }))}>
                <option value="">--None--</option>{LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </FormField>
          </div>

          {/* Description */}
          <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-3">Proposal Amount</p>
          <div className="mb-5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-zoho-muted shrink-0">Rs.</span>
              <input className="input flex-1" type="number" min="0" step="any" placeholder="0.00"
                value={form.proposal_amount} onChange={e => setForm(p => ({ ...p, proposal_amount: e.target.value }))} />
            </div>
          </div>
          <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-3">Description</p>
          <div className="mb-5">
            <textarea className="input min-h-[80px] resize-y" placeholder="Add a description..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-zoho-border">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Deal'}</button>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!stageMove} message={`Move ${stageMove?.deal?.name} to ${stageLabel(stageMove?.newStage)}?`} confirmLabel="Move" onConfirm={confirmStageMove} onCancel={() => setStageMove(null)} />
    </CRMLayout>
  );
}
