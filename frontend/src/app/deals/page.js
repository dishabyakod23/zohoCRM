'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import Badge from '../../components/ui/Badge.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import api from '../../lib/api.js';
import { DEAL_STAGES } from '../../lib/constants.js';
import { validateRequired, validatePastDate } from '../../lib/validators.js';

const EMPTY = { name: '', amount: '', stage: 'Qualification', close_date: '', probability: 10, account_id: '' };

export default function DealsPage() {
  const { showToast } = useToast();
  const [deals, setDeals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [stageMove, setStageMove] = useState(null);
  const [dragDeal, setDragDeal] = useState(null);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/deals', { params: { limit: 100, search } });
      setDeals(res.data.data); setTotal(res.data.total);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchDeals(); api.get('/accounts', { params: { limit: 100 } }).then(r => setAccounts(r.data.data)); }, [fetchDeals]);

  const handleSave = async () => {
    const errs = validateRequired({ name: 'Deal Name', account_id: 'Account Name', close_date: 'Closing Date', stage: 'Stage', amount: 'Amount' }, form);
    const dateErr = validatePastDate(form.close_date, 'Closing Date');
    if (dateErr) errs.close_date = dateErr;
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    if (editing) await api.put(`/deals/${editing}`, form);
    else await api.post('/deals', form);
    setModal(false); fetchDeals(); showToast('Deal saved', 'success');
  };

  const confirmStageMove = async () => {
    await api.patch(`/deals/${stageMove.deal.id}/stage`, { stage: stageMove.newStage });
    setStageMove(null); fetchDeals(); showToast('Deal stage updated', 'success');
  };

  const fmt = (n) => n ? `₹${(n/100000).toFixed(1)}L` : '—';
  const byStage = (stage) => deals.filter(d => d.stage === stage);

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div><h1 className="text-xl font-bold">Deals</h1><p className="text-xs text-gray-500">{total} deals</p></div>
          <div className="flex gap-2">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setView('table')} className={`px-3 py-1.5 text-xs ${view==='table' ? 'bg-brand-500 text-white' : 'bg-white text-gray-600'}`}>List</button>
              <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-xs ${view==='kanban' ? 'bg-brand-500 text-white' : 'bg-white text-gray-600'}`}>Kanban</button>
            </div>
            <button onClick={() => { setForm(EMPTY); setEditing(null); setModal(true); }} className="btn-primary">+ Create Deal</button>
          </div>
        </div>

        {view === 'table' ? (
          <div className="card">
            <div className="p-4 border-b"><input className="input max-w-xs" placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            <table className="w-full">
              <thead className="bg-gray-50"><tr>
                <th className="table-th">Deal Name</th><th className="table-th">Account</th><th className="table-th">Amount</th>
                <th className="table-th">Stage</th><th className="table-th">Closing Date</th><th className="table-th">Probability</th><th className="table-th">Actions</th>
              </tr></thead>
              <tbody className="divide-y">{deals.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 group">
                  <td className="table-td font-medium"><Link href={`/deals/${d.id}`} className="text-brand-600 hover:underline">{d.name}</Link></td>
                  <td className="table-td">{d.account_name || '—'}</td><td className="table-td">{fmt(d.amount)}</td>
                  <td className="table-td"><Badge label={d.stage} /></td>
                  <td className="table-td">{d.close_date ? new Date(d.close_date).toLocaleDateString() : '—'}</td>
                  <td className="table-td">{d.probability}%</td>
                  <td className="table-td"><div className="flex gap-3">
                    <button onClick={() => { setForm({ ...d, close_date: d.close_date?.split('T')[0], account_id: String(d.account_id || '') }); setEditing(d.id); setModal(true); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => setDeleteTarget(d)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3 min-w-max">
              {DEAL_STAGES.map(stage => (
                <div key={stage} className="w-56 flex flex-col"
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { if (dragDeal && dragDeal.stage !== stage) setStageMove({ deal: dragDeal, newStage: stage }); setDragDeal(null); }}>
                  <div className="px-3 py-2 bg-gray-100 rounded-t-lg border border-b-0">
                    <span className="text-xs font-semibold">{stage}</span>
                    <span className="text-xs text-gray-400 ml-2">{byStage(stage).length}</span>
                  </div>
                  <div className="flex-1 space-y-2 p-2 bg-gray-50 border rounded-b-lg min-h-40">
                    {byStage(stage).map(d => (
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
          </div>
        )}
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Deal' : 'Create Deal'} onClose={() => setModal(false)}>
          <div className="space-y-3">
            <FormField label="Deal Name" required error={errors.name} name="name"><input className={inputClass(errors.name)} value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} /></FormField>
            <FormField label="Account Name" required error={errors.account_id} name="account_id">
              <select className={inputClass(errors.account_id)} value={form.account_id} onChange={e => setForm(p => ({...p, account_id: e.target.value}))}>
                <option value="">Select account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Amount (₹)" required error={errors.amount} name="amount"><input className={inputClass(errors.amount)} type="number" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} /></FormField>
              <FormField label="Probability (%)"><input className="input" type="number" value={form.probability} onChange={e => setForm(p => ({...p, probability: e.target.value}))} /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Stage" required><select className="input" value={form.stage} onChange={e => setForm(p => ({...p, stage: e.target.value}))}>{DEAL_STAGES.map(s => <option key={s}>{s}</option>)}</select></FormField>
              <FormField label="Closing Date" required error={errors.close_date} name="close_date"><input className={inputClass(errors.close_date)} type="date" value={form.close_date?.slice(0,10)} onChange={e => setForm(p => ({...p, close_date: e.target.value}))} /></FormField>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button onClick={handleSave} className="btn-primary">Save</button></div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleteTarget} message={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { await api.delete(`/deals/${deleteTarget.id}`); setDeleteTarget(null); fetchDeals(); }} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog open={!!stageMove} message={`Move ${stageMove?.deal?.name} to ${stageMove?.newStage}?`} confirmLabel="Move" onConfirm={confirmStageMove} onCancel={() => setStageMove(null)} />
    </CRMLayout>
  );
}
