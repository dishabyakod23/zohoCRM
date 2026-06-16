'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useOpenCreateParam } from '../../hooks/useOpenCreateParam.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';
import * as accountsApi from '../../lib/services/accounts.js';
import { ACCOUNT_TYPES } from '../../lib/constants.js';

const INDUSTRIES = ['IT Services', 'E-Commerce', 'Automotive', 'EdTech', 'FinTech', 'Healthcare', 'Manufacturing', 'Retail', 'Other'];
const EMPTY = { account_name: '', phone: '', industry: '', account_type: '', website: '', annual_revenue: '', city: '', state: '', zip_code: '', country: 'India', description: '' };
const LIMIT = 15;

export default function AccountsPage() {
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [accounts, setAccounts] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [errors, setErrors] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const openCreate = useCallback(() => { setForm(EMPTY); setEditing(null); setErrors({}); setModal(true); }, []);
  useOpenCreateParam(canEdit, openCreate);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await accountsApi.listAccounts({
        page,
        page_size: LIMIT,
        search: debouncedSearch || undefined,
      });
      setAccounts(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, showToast]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const openEdit = (a) => {
    setForm({
      account_name: a.name || a.account_name || '',
      phone: a.phone || '',
      industry: a.industry || '',
      account_type: a.account_type || '',
      website: a.website || '',
      annual_revenue: a.annual_revenue || '',
      city: a.city || '',
      state: a.state || '',
      zip_code: a.zip_code || '',
      country: a.country || 'India',
      description: a.description || '',
    });
    setEditing(a.id);
    setErrors({});
    setModal(true);
  };

  const handleSave = async () => {
    const errs = validateRequired({ account_name: 'Account Name', phone: 'Phone' }, form);
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    setSaving(true);
    try {
      if (editing) await accountsApi.updateAccount(editing, form);
      else await accountsApi.createAccount(form);
      setModal(false);
      fetchAccounts();
      showToast('Account saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await accountsApi.deleteAccount(deleteTarget.id);
      setDeleteTarget(null);
      fetchAccounts();
      showToast('Account deleted', 'success');
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const totalPages = Math.ceil(total / LIMIT) || 1;

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div><h1 className="text-xl font-bold text-gray-900">Accounts</h1><p className="text-xs text-gray-500">{total} accounts</p></div>
          {canEdit && <button onClick={openCreate} className="btn-primary">+ New account</button>}
        </div>

        <div className="card">
          <div className="px-4 py-3 border-b border-zoho-border">
            <div className="relative max-w-xs">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zoho-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input className="input pl-8 py-1.5 text-xs" placeholder="Search accounts…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Company</th>
                  <th className="table-th">Industry</th>
                  <th className="table-th">Website</th>
                  <th className="table-th">Phone</th>
                  <th className="table-th">City</th>
                  <th className="table-th">Owner</th>
                  <th className="table-th w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="table-td text-center text-zoho-muted py-12">Loading…</td></tr>
                : accounts.length === 0 ? <tr><td colSpan={7} className="table-td text-center text-zoho-muted py-12">No accounts found</td></tr>
                : accounts.map(a => (
                  <tr key={a.id} className="hover:bg-brand-50/30 transition-colors">
                    <td className="table-td">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-semibold shrink-0">{(a.name || '?')[0]}</div>
                        <Link href={`/accounts/${a.id}`} className="font-medium text-brand-600 hover:text-brand-700">{a.name}</Link>
                      </div>
                    </td>
                    <td className="table-td">{a.industry || '—'}</td>
                    <td className="table-td">
                      {a.website ? <a href={a.website} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700 text-xs">{a.website.replace('https://', '')}</a> : '—'}
                    </td>
                    <td className="table-td">{a.phone || '—'}</td>
                    <td className="table-td">{a.city || '—'}</td>
                    <td className="table-td">{a.owner_name || '—'}</td>
                    <td className="table-td">
                      {canEdit && (
                        <div className="flex gap-1.5">
                          <button onClick={() => openEdit(a)} className="btn-secondary-sm">Edit</button>
                          <button onClick={() => setDeleteTarget(a)} className="btn-danger-sm">Delete</button>
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
        <Modal title={editing ? 'Edit Account' : 'New Account'} onClose={() => setModal(false)}>
          {/* Account Information */}
          <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-3">Account Information</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="col-span-2"><FormField label="Account Name" required error={errors.account_name} name="account_name"><input className={inputClass(errors.account_name)} value={form.account_name} onChange={e => { setForm(p => ({ ...p, account_name: e.target.value })); setErrors(er => ({ ...er, account_name: null })); }} /></FormField></div>
            <FormField label="Phone" required error={errors.phone} name="phone"><input className={inputClass(errors.phone)} value={form.phone} onChange={e => { setForm(p => ({ ...p, phone: e.target.value })); setErrors(er => ({ ...er, phone: null })); }} /></FormField>
            <FormField label="Website"><input className="input" placeholder="https://" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} /></FormField>
            <FormField label="Industry">
              <select className="input" value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}>
                <option value="">--None--</option>{INDUSTRIES.map(i => <option key={i}>{i}</option>)}
              </select>
            </FormField>
            <FormField label="Account Type">
              <select className="input" value={form.account_type} onChange={e => setForm(p => ({ ...p, account_type: e.target.value }))}>
                <option value="">--None--</option>{ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Annual Revenue"><input className="input" type="number" placeholder="₹" value={form.annual_revenue} onChange={e => setForm(p => ({ ...p, annual_revenue: e.target.value }))} /></FormField>
          </div>

          {/* Address Information */}
          <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-3">Address Information</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <FormField label="City"><input className="input" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} /></FormField>
            <FormField label="State"><input className="input" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} /></FormField>
            <FormField label="Zip Code"><input className="input" value={form.zip_code} onChange={e => setForm(p => ({ ...p, zip_code: e.target.value }))} /></FormField>
            <FormField label="Country"><input className="input" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} /></FormField>
          </div>

          {/* Description */}
          <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-3">Description</p>
          <div className="mb-5">
            <textarea className="input min-h-[80px] resize-y" placeholder="Add a description..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-zoho-border">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Account'}</button>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleteTarget} message={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`} confirmLabel="Confirm Delete" danger
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </CRMLayout>
  );
}
