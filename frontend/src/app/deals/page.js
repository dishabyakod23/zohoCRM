'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import Badge from '../../components/ui/Badge.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired, validatePastDate } from '../../lib/validators.js';
import { FALLBACK_DEAL_STAGES } from '../../lib/dealHelpers.js';
import * as dealsApi from '../../lib/services/deals.js';
import { fetchDealStages, fetchAccountLookups, accountMapFromLookups } from '../../lib/services/lookups.js';

const EMPTY = { deal_name: '', amount: '', stage_value: 'qualification', closing_date: '', probability: 10, account_id: '' };

export default function DealsPage() {
  const { showToast } = useToast();
  const [deals, setDeals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [stageOptions, setStageOptions] = useState(FALLBACK_DEAL_STAGES);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [stageMove, setStageMove] = useState(null);
  const [dragDeal, setDragDeal] = useState(null);

  const accountMap = useMemo(() => accountMapFromLookups(accounts), [accounts]);

  useEffect(() => {
    fetchAccountLookups().then(setAccounts).catch(() => setAccounts([]));
    fetchDealStages().then(setStageOptions).catch(() => setStageOptions(FALLBACK_DEAL_STAGES));
  }, []);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dealsApi.listDeals({
        page: 1,
        page_size: 50,
        search: search || undefined,
      }, accountMap, stageOptions);
      setDeals(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [search, accountMap, stageOptions, showToast]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const handleSave = async () => {
    const errs = validateRequired({ deal_name: 'Deal Name', account_id: 'Account Name', closing_date: 'Closing Date', stage_value: 'Stage', amount: 'Amount' }, form);
    const dateErr = validatePastDate(form.closing_date, 'Closing Date');
    if (dateErr) errs.closing_date = dateErr;
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    setSaving(true);
    try {
      if (editing) await dealsApi.updateDeal(editing, form);
      else await dealsApi.createDeal(form);
      setModal(false);
      fetchDeals();
      showToast('Deal saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await dealsApi.deleteDeal(deleteTarget.id);
      setDeleteTarget(null);
      fetchDeals();
      showToast('Deal deleted', 'success');
    } catch (err) {
      showToast(getApiError(err));
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

  const openEdit = (d) => {
    setForm({
      deal_name: d.deal_name || d.name || '',
      amount: d.amount ?? '',
      stage_value: d.stage_value || 'qualification',
      closing_date: d.closing_date?.split('T')[0] || d.close_date?.split('T')[0] || '',
      probability: d.probability ?? 10,
      account_id: String(d.account_id || ''),
    });
    setEditing(d.id);
    setErrors({});
    setModal(true);
  };

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
            <button onClick={() => { setForm(EMPTY); setEditing(null); setErrors({}); setModal(true); }} className="btn-primary">+ Create Deal</button>
          </div>
        </div>

        {view === 'table' ? (
          <div className="card">
            <div className="p-4 border-b"><input className="input max-w-xs" placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            {loading ? <p className="table-td text-center text-gray-400 py-10">Loading...</p> : (
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="table-th">Deal Name</th><th className="table-th">Account</th><th className="table-th">Amount</th>
                  <th className="table-th">Stage</th><th className="table-th">Closing Date</th><th className="table-th">Probability</th><th className="table-th">Actions</th>
                </tr></thead>
                <tbody className="divide-y">{deals.length === 0 ? (
                  <tr><td colSpan={7} className="table-td text-center text-gray-400 py-10">No deals found</td></tr>
                ) : deals.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 group">
                    <td className="table-td font-medium"><Link href={`/deals/${d.id}`} className="text-brand-600 hover:underline">{d.name}</Link></td>
                    <td className="table-td">{d.account_name || '—'}</td><td className="table-td">{fmt(d.amount)}</td>
                    <td className="table-td"><Badge label={d.stage} /></td>
                    <td className="table-td">{d.close_date ? new Date(d.close_date).toLocaleDateString() : '—'}</td>
                    <td className="table-td">{d.probability}%</td>
                    <td className="table-td"><div className="flex gap-3">
                      <button onClick={() => openEdit(d)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => setDeleteTarget(d)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
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
                        <div key={d.id} draggable onDragStart={() => setDragDeal(d)}
                          className="bg-white border rounded-lg p-3 shadow-sm cursor-grab hover:border-brand-300 text-xs">
                          <p className="font-medium">{d.name}</p><p className="text-gray-500">{d.account_name}</p>
                          <p className="font-semibold mt-1">{fmt(d.amount)}</p>
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
        <Modal title={editing ? 'Edit Deal' : 'Create Deal'} onClose={() => setModal(false)}>
          <div className="space-y-3">
            <FormField label="Deal Name" required error={errors.deal_name} name="deal_name"><input className={inputClass(errors.deal_name)} value={form.deal_name} onChange={e => setForm(p => ({ ...p, deal_name: e.target.value }))} /></FormField>
            <FormField label="Account Name" required error={errors.account_id} name="account_id">
              <select className={inputClass(errors.account_id)} value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}>
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.value} value={a.value}>{a.label || a.name}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Amount (₹)" required error={errors.amount} name="amount"><input className={inputClass(errors.amount)} type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></FormField>
              <FormField label="Probability (%)"><input className="input" type="number" value={form.probability} onChange={e => setForm(p => ({ ...p, probability: e.target.value }))} /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Stage" required error={errors.stage_value} name="stage_value">
                <select className={inputClass(errors.stage_value)} value={form.stage_value} onChange={e => setForm(p => ({ ...p, stage_value: e.target.value }))}>
                  {stageOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </FormField>
              <FormField label="Closing Date" required error={errors.closing_date} name="closing_date"><input className={inputClass(errors.closing_date)} type="date" value={form.closing_date?.slice(0, 10)} onChange={e => setForm(p => ({ ...p, closing_date: e.target.value }))} /></FormField>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleteTarget} message={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`} confirmLabel="Confirm Delete" danger
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog open={!!stageMove} message={`Move ${stageMove?.deal?.name} to ${stageLabel(stageMove?.newStage)}?`} confirmLabel="Move" onConfirm={confirmStageMove} onCancel={() => setStageMove(null)} />
    </CRMLayout>
  );
}
