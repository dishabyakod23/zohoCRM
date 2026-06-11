'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import BulkUpload from '../../components/records/BulkUpload.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import api from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';

const EMPTY = { first_name: '', last_name: '', email: '', phone: '', account_id: '', title: '' };

export default function ContactsPage() {
  const { showToast } = useToast();
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/contacts', { params: { page, limit: 15, ...(search && { search }) } });
      setContacts(res.data.data); setTotal(res.data.total);
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchContacts(); api.get('/accounts', { params: { limit: 100 } }).then(r => setAccounts(r.data.data)); }, [fetchContacts]);

  const openCreate = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit = (c) => { setForm({ ...c }); setEditing(c.id); setModal(true); };

  const handleSave = async () => {
    const errs = validateRequired({ last_name: 'Last Name', account_id: 'Account Name', email: 'Email', phone: 'Phone' }, form);
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    setSaving(true);
    try {
      if (editing) await api.put(`/contacts/${editing}`, form);
      else await api.post('/contacts', form);
      setModal(false); fetchContacts(); showToast('Contact saved', 'success');
    } finally { setSaving(false); }
  };

  const initials = (c) => `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase();
  const totalPages = Math.ceil(total / 15);

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div><h1 className="text-xl font-bold text-gray-900">Contacts</h1><p className="text-xs text-gray-500">{total} contacts</p></div>
          <div className="flex gap-2">
            <BulkUpload endpoint="/contacts" onDone={fetchContacts} templateHeaders={['first_name','last_name','email','phone','account_name']} />
            <button onClick={openCreate} className="btn-primary">+ New contact</button>
          </div>
        </div>

        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <input className="input max-w-xs" placeholder="Search contacts..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-th">Contact</th>
                  <th className="table-th">Title</th>
                  <th className="table-th">Company</th>
                  <th className="table-th">Email</th>
                  <th className="table-th">Phone</th>
                  <th className="table-th">Owner</th>
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? <tr><td colSpan={7} className="table-td text-center text-gray-400 py-10">Loading...</td></tr>
                : contacts.length === 0 ? <tr><td colSpan={7} className="table-td text-center text-gray-400 py-10">No contacts found</td></tr>
                : contacts.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="table-td">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">{initials(c)}</div>
                        <Link href={`/contacts/${c.id}`} className="font-medium text-brand-600 hover:underline">{c.first_name} {c.last_name}</Link>
                      </div>
                    </td>
                    <td className="table-td">{c.title || '—'}</td>
                    <td className="table-td">{c.account_name || c.company || '—'}</td>
                    <td className="table-td text-blue-600">{c.email || '—'}</td>
                    <td className="table-td">{c.phone || '—'}</td>
                    <td className="table-td">{c.owner_name || '—'}</td>
                    <td className="table-td">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(c)} className="text-xs text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => setDeleteTarget(c)} className="text-xs text-red-500 hover:underline">Delete</button>
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
        <Modal title={editing ? 'Edit Contact' : 'New Contact'} onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="label">First name *</label><input className="input" value={form.first_name} onChange={e => setForm(p => ({...p, first_name: e.target.value}))} /></div>
            <FormField label="Last name" required error={errors.last_name} name="last_name"><input className={inputClass(errors.last_name)} value={form.last_name} onChange={e => setForm(p => ({...p, last_name: e.target.value}))} /></FormField>
            <FormField label="Email" required error={errors.email} name="email"><input className={inputClass(errors.email)} type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></FormField>
            <FormField label="Phone" required error={errors.phone} name="phone"><input className={inputClass(errors.phone)} value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} /></FormField>
            <FormField label="Account Name" required error={errors.account_id} name="account_id">
              <select className={inputClass(errors.account_id)} value={form.account_id} onChange={e => setForm(p => ({...p, account_id: e.target.value}))}>
                <option value="">Select account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </FormField>
            <div><label className="label">Title</label><input className="input" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} /></div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save contact'}</button>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleteTarget} message={`Are you sure you want to delete ${deleteTarget?.first_name} ${deleteTarget?.last_name}? This action cannot be undone.`} confirmLabel="Confirm Delete" danger
        onConfirm={async () => { await api.delete(`/contacts/${deleteTarget.id}`); setDeleteTarget(null); fetchContacts(); }} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
