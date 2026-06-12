'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import Badge from '../../components/ui/Badge.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import ApiPendingBanner from '../../components/ui/ApiPendingBanner.js';
import { CAMPAIGN_TYPES, CAMPAIGN_STATUSES } from '../../lib/constants.js';
import { validateRequired } from '../../lib/validators.js';

const EMPTY = { name: '', type: '', status: 'Planning', start_date: '', end_date: '', expected_revenue: '', description: '' };

export default function CampaignsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetch = useCallback(() => {
    setLoading(false);
    setItems([]);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const save = async () => {
    const errs = validateRequired({ name: 'Campaign Name', type: 'Campaign Type', status: 'Status', start_date: 'Start Date', end_date: 'End Date' }, form);
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    showToast('Campaigns is not available on the Sales CRM API yet');
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <ApiPendingBanner module="Campaigns" />
        <div className="flex justify-between mb-5"><h1 className="text-xl font-bold">Campaigns</h1><button onClick={() => { setForm(EMPTY); setEditing(null); setModal(true); }} className="btn-primary">+ Create Campaign</button></div>
        <div className="card overflow-x-auto">
          <table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">Name</th><th className="table-th">Type</th><th className="table-th">Status</th><th className="table-th">Dates</th><th className="table-th">Members</th><th className="table-th">Actions</th></tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={6} className="table-td text-center py-8">Loading...</td></tr>
              : items.length === 0 ? <tr><td colSpan={6} className="table-td text-center py-8 text-gray-400">No campaigns found</td></tr>
              : items.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 group">
                <td className="table-td font-medium"><Link href={`/campaigns/${c.id}`} className="text-brand-600 hover:underline">{c.name}</Link></td>
                <td className="table-td">{c.type}</td><td className="table-td"><Badge label={c.status} /></td>
                <td className="table-td text-xs">{c.start_date} → {c.end_date}</td>
                <td className="table-td">{c.member_count || 0}</td>
                <td className="table-td"><div className="flex gap-3">
                  <button onClick={() => { setForm({ ...c, start_date: c.start_date?.slice(0, 10), end_date: c.end_date?.slice(0, 10) }); setEditing(c.id); setModal(true); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => setDeleteTarget(c)} className="text-xs text-red-500 hover:underline">Delete</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {modal && <Modal title={editing ? 'Edit Campaign' : 'Create Campaign'} onClose={() => setModal(false)}>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Campaign Name" required error={errors.name} name="name"><input className={inputClass(errors.name)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></FormField>
          <FormField label="Type" required><select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}><option value="">Select</option>{CAMPAIGN_TYPES.map(t => <option key={t}>{t}</option>)}</select></FormField>
          <FormField label="Status" required><select className="input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>{CAMPAIGN_STATUSES.map(s => <option key={s}>{s}</option>)}</select></FormField>
          <FormField label="Start Date" required error={errors.start_date} name="start_date"><input className={inputClass(errors.start_date)} type="date" value={form.start_date?.slice(0,10)} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></FormField>
          <FormField label="End Date" required error={errors.end_date} name="end_date"><input className={inputClass(errors.end_date)} type="date" value={form.end_date?.slice(0,10)} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} /></FormField>
        </div>
        <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button onClick={save} className="btn-primary">Save</button></div>
      </Modal>}
      <ConfirmDialog open={!!deleteTarget} message={`Deleting this Campaign will remove it from ${deleteTarget?.member_count || 0} linked leads and contacts. Proceed?`} confirmLabel="Confirm Delete" danger
        onConfirm={() => { setDeleteTarget(null); showToast('Campaigns is not available on the Sales CRM API yet'); }} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
