'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import BulkUpload from '../../components/records/BulkUpload.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useOpenCreateParam } from '../../hooks/useOpenCreateParam.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired, validateEmail, validatePhone } from '../../lib/validators.js';
import * as contactsApi from '../../lib/services/contacts.js';
import { fetchAccountLookups, accountMapFromLookups } from '../../lib/services/lookups.js';

const EMPTY = { first_name: '', last_name: '', email: '', phone: '', account_id: '', title: '' };
const LIMIT = 15;

export default function ContactsPage() {
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const accountMap = useMemo(() => accountMapFromLookups(accounts), [accounts]);

  useEffect(() => {
    fetchAccountLookups().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const openCreate = useCallback(() => { setForm(EMPTY); setEditing(null); setErrors({}); setModal(true); }, []);
  useOpenCreateParam(canEdit, openCreate);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await contactsApi.listContacts({
        page,
        page_size: LIMIT,
        search: debouncedSearch || undefined,
      }, accountMap);
      setContacts(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, accountMap, showToast]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const openEdit = (c) => { setForm({ ...c, account_id: c.account_id || '' }); setEditing(c.id); setErrors({}); setModal(true); };

  const handleSave = async () => {
    const errs = validateRequired({ last_name: 'Last Name', account_id: 'Account Name', email: 'Email', phone: 'Phone' }, form);
    const emailErr = validateEmail(form.email);
    const phoneErr = validatePhone(form.phone);
    if (emailErr) errs.email = emailErr;
    if (phoneErr) errs.phone = phoneErr;
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    setSaving(true);
    try {
      if (editing) await contactsApi.updateContact(editing, form);
      else await contactsApi.createContact(form);
      setModal(false);
      fetchContacts();
      showToast('Contact saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await contactsApi.deleteContact(deleteTarget.id);
      setDeleteTarget(null);
      fetchContacts();
      showToast('Contact deleted', 'success');
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const initials = (c) => `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase();
  const totalPages = Math.ceil(total / LIMIT) || 1;

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div><h1 className="text-xl font-bold text-gray-900">Contacts</h1><p className="text-xs text-gray-500">{total} contacts</p></div>
          <div className="flex gap-2">
            <BulkUpload endpoint="/contacts" onDone={fetchContacts} templateHeaders={['first_name', 'last_name', 'email', 'phone', 'account_name']} />
            {canEdit && <button onClick={openCreate} className="btn-primary">+ New contact</button>}
          </div>
        </div>

        <div className="card">
          <div className="px-4 py-3 border-b border-zoho-border">
            <div className="relative max-w-xs">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zoho-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input className="input pl-8 py-1.5 text-xs" placeholder="Search contacts…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Contact</th>
                  <th className="table-th">Title</th>
                  <th className="table-th">Company</th>
                  <th className="table-th">Email</th>
                  <th className="table-th">Phone</th>
                  <th className="table-th">Owner</th>
                  <th className="table-th w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="table-td text-center text-zoho-muted py-12">Loading…</td></tr>
                : contacts.length === 0 ? <tr><td colSpan={7} className="table-td text-center text-zoho-muted py-12">No contacts found</td></tr>
                : contacts.map(c => (
                  <tr key={c.id} className="hover:bg-brand-50/30 transition-colors">
                    <td className="table-td">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0">{initials(c)}</div>
                        <Link href={`/contacts/${c.id}`} className="font-medium text-brand-600 hover:text-brand-700">{c.first_name} {c.last_name}</Link>
                      </div>
                    </td>
                    <td className="table-td">{c.title || '—'}</td>
                    <td className="table-td">{c.account_name || '—'}</td>
                    <td className="table-td text-brand-600">{c.email || '—'}</td>
                    <td className="table-td">{c.phone || '—'}</td>
                    <td className="table-td">{c.owner_name || '—'}</td>
                    <td className="table-td">
                      {canEdit && (
                        <div className="flex gap-1.5">
                          <button onClick={() => openEdit(c)} className="btn-secondary-sm">Edit</button>
                          <button onClick={() => setDeleteTarget(c)} className="btn-danger-sm">Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-zoho-border/60">
            <p className="text-xs text-zoho-muted">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-secondary-sm disabled:opacity-40">← Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} className="btn-secondary-sm disabled:opacity-40">Next →</button>
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Contact' : 'New Contact'} onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="label">First name</label><input className="input" value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} /></div>
            <FormField label="Last name" required error={errors.last_name} name="last_name"><input className={inputClass(errors.last_name)} value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} /></FormField>
            <FormField label="Email" required error={errors.email} name="email"><input className={inputClass(errors.email)} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></FormField>
            <FormField label="Phone" required error={errors.phone} name="phone"><input className={inputClass(errors.phone)} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></FormField>
            <FormField label="Account Name" required error={errors.account_id} name="account_id">
              <select className={inputClass(errors.account_id)} value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}>
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.value} value={a.value}>{a.label || a.name}</option>)}
              </select>
            </FormField>
            <div><label className="label">Title</label><input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save contact'}</button>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleteTarget} message={`Are you sure you want to delete ${deleteTarget?.first_name} ${deleteTarget?.last_name}? This action cannot be undone.`} confirmLabel="Confirm Delete" danger
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
