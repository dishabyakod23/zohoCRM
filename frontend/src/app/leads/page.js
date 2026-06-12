'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import Badge from '../../components/ui/Badge.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import ListToolbar from '../../components/layout/ListToolbar.js';
import { LEAD_STATUSES, LEAD_SOURCES, LIST_VIEWS } from '../../lib/constants.js';
import { validateRequired, validateEmail, validatePhone } from '../../lib/validators.js';
import { leadStatusToApi } from '../../lib/leadHelpers.js';
import * as leadsApi from '../../lib/services/leads.js';

const EMPTY = { first_name: '', last_name: '', email: '', phone: '', company: '', source: '', status: 'Not Contacted', industry: '', title: '' };
const REQUIRED = { last_name: 'Last Name', company: 'Company', email: 'Email', phone: 'Phone', status: 'Lead Status' };

export default function LeadsPage() {
  const { showToast } = useToast();
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [activeView, setActiveView] = useState('All Leads');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const result = await leadsApi.listLeads({
        page,
        page_size: limit,
        search: search || undefined,
        lead_status: statusFilter ? leadStatusToApi(statusFilter) : undefined,
      });
      setLeads(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, showToast]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const validate = () => {
    const errs = validateRequired(REQUIRED, form);
    const emailErr = validateEmail(form.email);
    const phoneErr = validatePhone(form.phone);
    if (emailErr) errs.email = emailErr;
    if (phoneErr) errs.phone = phoneErr;
    setErrors(errs);
    if (Object.keys(errs).length) {
      showToast('Please fill in all required fields before saving.');
      document.querySelector(`[data-field="${Object.keys(errs)[0]}"]`)?.scrollIntoView({ behavior: 'smooth' });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) await leadsApi.updateLead(editing, form);
      else await leadsApi.createLead(form);
      setModal(false);
      fetchLeads();
      showToast('Lead saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await leadsApi.deleteLead(deleteTarget.id);
      setDeleteTarget(null);
      fetchLeads();
      showToast('Lead deleted', 'success');
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const handleBulkDelete = async () => {
    try {
      const result = await leadsApi.bulkDeleteLeads(selected);
      setBulkDelete(false);
      setSelected([]);
      fetchLeads();
      showToast(`Deleted ${result.success_count} lead(s)`, 'success');
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <CRMLayout>
      <div className="p-4">
        <ListToolbar
          moduleName="Leads"
          total={total}
          views={LIST_VIEWS.leads}
          activeView={activeView}
          onViewChange={setActiveView}
          searchValue={search}
          onSearch={v => { setSearch(v); setPage(1); }}
          onCreate={() => { setForm(EMPTY); setEditing(null); setErrors({}); setModal(true); }}
          createLabel="+ Create Lead"
        >
          <select className="input w-40 text-xs" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {LEAD_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="input w-28 text-xs" value={limit} onChange={e => { setLimit(+e.target.value); setPage(1); }}>
            {[10, 15, 25, 50].map(n => <option key={n} value={n}>{n} per page</option>)}
          </select>
        </ListToolbar>

        {selected.length > 0 && (
          <div className="card mb-4 px-4 py-2 flex items-center gap-3">
            <span className="text-sm text-gray-600">{selected.length} selected</span>
            <button onClick={() => setBulkDelete(true)} className="text-sm text-red-600 hover:underline">Bulk Delete</button>
          </div>
        )}

        <div className="card rounded-t-none mb-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-th w-8"></th>
                  <th className="table-th">Lead Name</th>
                  <th className="table-th">Company</th>
                  <th className="table-th">Email</th>
                  <th className="table-th">Phone</th>
                  <th className="table-th">Source</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Owner</th>
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? <tr><td colSpan={9} className="table-td text-center py-10 text-gray-400">Loading...</td></tr>
                : leads.length === 0 ? <tr><td colSpan={9} className="table-td text-center py-10 text-gray-400">No leads found</td></tr>
                : leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50 group">
                    <td className="table-td"><input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggleSelect(lead.id)} /></td>
                    <td className="table-td font-medium">
                      <Link href={`/leads/${lead.id}`} className="text-brand-600 hover:underline">{lead.first_name} {lead.last_name}</Link>
                    </td>
                    <td className="table-td">{lead.company || '—'}</td>
                    <td className="table-td text-blue-600">{lead.email || '—'}</td>
                    <td className="table-td">{lead.phone || '—'}</td>
                    <td className="table-td">{lead.source || '—'}</td>
                    <td className="table-td"><Badge label={lead.status} /></td>
                    <td className="table-td">{lead.owner_name || '—'}</td>
                    <td className="table-td">
                      <div className="flex gap-3">
                        <button onClick={() => { setForm({ ...lead, status: lead.status, source: lead.source }); setEditing(lead.id); setModal(true); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => setDeleteTarget(lead)} className="text-xs text-red-500 hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">{total ? `${((page - 1) * limit) + 1}-${Math.min(page * limit, total)} of ${total}` : '0 records'}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-secondary text-xs py-1">← Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="btn-secondary text-xs py-1">Next →</button>
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Lead' : 'Create Lead'} onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <FormField label="First Name" name="first_name"><input className={inputClass(errors.first_name)} value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} /></FormField>
            <FormField label="Last Name" required error={errors.last_name} name="last_name"><input className={inputClass(errors.last_name)} value={form.last_name} onChange={e => { setForm(p => ({ ...p, last_name: e.target.value })); setErrors(er => ({ ...er, last_name: null })); }} /></FormField>
            <FormField label="Email" required error={errors.email} name="email"><input className={inputClass(errors.email)} type="email" value={form.email} onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setErrors(er => ({ ...er, email: null })); }} /></FormField>
            <FormField label="Phone" required error={errors.phone} name="phone"><input className={inputClass(errors.phone)} value={form.phone} onChange={e => { setForm(p => ({ ...p, phone: e.target.value })); setErrors(er => ({ ...er, phone: null })); }} /></FormField>
            <FormField label="Company" required error={errors.company} name="company"><input className={inputClass(errors.company)} value={form.company} onChange={e => { setForm(p => ({ ...p, company: e.target.value })); setErrors(er => ({ ...er, company: null })); }} /></FormField>
            <FormField label="Lead Source"><select className="input" value={form.source || ''} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}><option value="">Select</option>{LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}</select></FormField>
            <FormField label="Lead Status" required error={errors.status} name="status" className="col-span-2">
              <select className={inputClass(errors.status)} value={form.status} onChange={e => { setForm(p => ({ ...p, status: e.target.value })); setErrors(er => ({ ...er, status: null })); }}>{LEAD_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
            </FormField>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleteTarget} message={`Are you sure you want to delete ${deleteTarget?.first_name} ${deleteTarget?.last_name}?`} confirmLabel="Confirm Delete" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog open={bulkDelete} message={`Delete ${selected.length} selected lead(s)?`} confirmLabel="Delete All" danger onConfirm={handleBulkDelete} onCancel={() => setBulkDelete(false)} />
    </CRMLayout>
  );
}
