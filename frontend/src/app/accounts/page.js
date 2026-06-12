'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import ApiPendingBanner from '../../components/ui/ApiPendingBanner.js';
import { validateRequired } from '../../lib/validators.js';

const INDUSTRIES = ['IT Services', 'E-Commerce', 'Automotive', 'EdTech', 'FinTech', 'Healthcare', 'Manufacturing', 'Retail', 'Other'];
const EMPTY = { name: '', industry: '', website: '', phone: '', city: '', country: 'India' };

export default function AccountsPage() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [errors, setErrors] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(false);
    setAccounts([]);
    setTotal(0);
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const openCreate = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit = (a) => { setForm({ ...a }); setEditing(a.id); setModal(true); };

  const handleSave = async () => {
    const errs = validateRequired({ name: 'Account Name', phone: 'Phone' }, form);
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    setSaving(true);
    showToast('Accounts is not available on the Sales CRM API yet');
    setSaving(false);
  };

  const totalPages = Math.ceil(total / 15);

  return (
    <CRMLayout>
      <div className="p-6">
        <ApiPendingBanner module="Accounts" />
        <div className="flex items-center justify-between mb-5">
          <div><h1 className="text-xl font-bold text-gray-900">Accounts</h1><p className="text-xs text-gray-500">{total} accounts</p></div>
          <button onClick={openCreate} className="btn-primary">+ New account</button>
        </div>

        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <input className="input max-w-xs" placeholder="Search accounts..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-th">Company</th>
                  <th className="table-th">Industry</th>
                  <th className="table-th">Website</th>
                  <th className="table-th">Phone</th>
                  <th className="table-th">City</th>
                  <th className="table-th">Owner</th>
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? <tr><td colSpan={7} className="table-td text-center text-gray-400 py-10">Loading...</td></tr>
                : accounts.length === 0 ? <tr><td colSpan={7} className="table-td text-center text-gray-400 py-10">No accounts found</td></tr>
                : accounts.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-semibold">{a.name[0]}</div>
                        <Link href={`/accounts/${a.id}`} className="font-medium text-brand-600 hover:underline">{a.name}</Link>
                      </div>
                    </td>
                    <td className="table-td">{a.industry || '—'}</td>
                    <td className="table-td">
                      {a.website ? <a href={a.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">{a.website.replace('https://', '')}</a> : '—'}
                    </td>
                    <td className="table-td">{a.phone || '—'}</td>
                    <td className="table-td">{a.city || '—'}</td>
                    <td className="table-td">{a.owner_name || '—'}</td>
                    <td className="table-td">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(a)} className="text-xs text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => setDeleteTarget(a)} className="text-xs text-red-500 hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => p-1)} disabled={page===1} className="btn-secondary text-xs py-1">← Prev</button>
                <button onClick={() => setPage(p => p+1)} disabled={page===totalPages} className="btn-secondary text-xs py-1">Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Account' : 'New Account'} onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2"><FormField label="Company name" required error={errors.name} name="name"><input className={inputClass(errors.name)} value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} /></FormField></div>
            <div><label className="label">Industry</label>
              <select className="input" value={form.industry} onChange={e => setForm(p => ({...p, industry: e.target.value}))}>
                <option value="">Select</option>
                {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
            <FormField label="Phone" required error={errors.phone} name="phone"><input className={inputClass(errors.phone)} value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} /></FormField>
            <div className="col-span-2"><label className="label">Website</label><input className="input" value={form.website} onChange={e => setForm(p => ({...p, website: e.target.value}))} /></div>
            <div><label className="label">City</label><input className="input" value={form.city} onChange={e => setForm(p => ({...p, city: e.target.value}))} /></div>
            <div><label className="label">Country</label><input className="input" value={form.country} onChange={e => setForm(p => ({...p, country: e.target.value}))} /></div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save account'}</button>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleteTarget} message={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`} confirmLabel="Confirm Delete" danger
        onConfirm={() => { setDeleteTarget(null); showToast('Accounts is not available on the Sales CRM API yet'); }} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
