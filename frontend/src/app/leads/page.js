'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import Badge from '../../components/ui/Badge.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useOpenCreateParam } from '../../hooks/useOpenCreateParam.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import ListToolbar from '../../components/layout/ListToolbar.js';
import { LEAD_SOURCES, LIST_VIEWS, SALUTATIONS, RATINGS } from '../../lib/constants.js';
import { validateRequired, validateEmail, validatePhone } from '../../lib/validators.js';
import * as leadsApi from '../../lib/services/leads.js';
import { fetchLeadStatuses, FALLBACK_LEAD_STATUSES } from '../../lib/services/lookups.js';

const EMPTY = {
  salutation: '', first_name: '', last_name: '', email: '', phone: '', mobile: '',
  company: '', title: '', lead_status: 'not_contacted', source: '', industry: '',
  rating: '', website: '', annual_revenue: '', no_of_employees: '',
  street: '', city: '', state: '', zip_code: '', country: 'India',
  description: '',
};
const REQUIRED = { last_name: 'Last Name', company: 'Company', email: 'Email', phone: 'Phone', lead_status: 'Lead Status' };

export default function LeadsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { canEdit, canBulkDelete } = usePermissions();
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState([]);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [activeView, setActiveView] = useState('All Leads');
  const [statusOptions, setStatusOptions] = useState(FALLBACK_LEAD_STATUSES);

  useEffect(() => {
    fetchLeadStatuses().then(setStatusOptions).catch(() => setStatusOptions(FALLBACK_LEAD_STATUSES));
  }, []);

  const openCreate = useCallback(() => {
    setForm(EMPTY);
    setErrors({});
    setModal(true);
  }, []);

  useOpenCreateParam(canEdit, openCreate);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        page_size: limit,
        search: debouncedSearch || undefined,
        lead_status: statusFilter || undefined,
      };
      if (activeView === 'My Leads' && user?.id) params.owner_id = user.id;
      if (activeView === 'Recently Created') {
        params.sort_by = 'created_at';
        params.sort_order = 'desc';
      }
      if (activeView === 'Recently Modified') {
        params.sort_by = 'updated_at';
        params.sort_order = 'desc';
      }
      const result = await leadsApi.listLeads(params);
      setLeads(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, activeView, user?.id, showToast]);

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
      await leadsApi.createLead(form);
      setModal(false);
      fetchLeads();
      showToast('Lead saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
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
      <div className="p-6">
        <ListToolbar
          moduleName="Leads"
          total={total}
          views={LIST_VIEWS.leads}
          activeView={activeView}
          onViewChange={v => { setActiveView(v); setPage(1); }}
          searchValue={search}
          onSearch={v => { setSearch(v); setPage(1); }}
          onCreate={canEdit ? openCreate : undefined}
          createLabel="+ Create Lead"
        >
          <select className="input w-40 text-xs" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="input w-28 text-xs" value={limit} onChange={e => { setLimit(+e.target.value); setPage(1); }}>
            {[10, 15, 25, 50].map(n => <option key={n} value={n}>{n} per page</option>)}
          </select>
        </ListToolbar>

        {canBulkDelete && selected.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 mb-3 bg-brand-50 border border-brand-200 rounded-lg text-sm">
            <span className="font-medium text-brand-700">{selected.length} selected</span>
            <button onClick={() => setBulkDelete(true)} className="btn-danger-sm ml-auto">Bulk Delete</button>
          </div>
        )}

        <div className="card rounded-tl-none rounded-tr-none border-t-0 mb-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {canBulkDelete && <th className="table-th w-10"></th>}
                  <th className="table-th">Lead Name</th>
                  <th className="table-th">Company</th>
                  <th className="table-th">Email</th>
                  <th className="table-th">Phone</th>
                  <th className="table-th">Source</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Owner</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={canBulkDelete ? 8 : 7} className="table-td text-center py-12 text-zoho-muted">Loading…</td></tr>
                ) : leads.length === 0 ? (
                  <tr><td colSpan={canBulkDelete ? 8 : 7} className="table-td text-center py-12 text-zoho-muted">No leads found</td></tr>
                ) : leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-brand-50/30 transition-colors">
                    {canBulkDelete && (
                      <td className="table-td">
                        <input type="checkbox" className="rounded border-zoho-border" checked={selected.includes(lead.id)} onChange={() => toggleSelect(lead.id)} />
                      </td>
                    )}
                    <td className="table-td font-medium">
                      <Link href={`/leads/${lead.id}`} className="text-brand-600 hover:text-brand-700">{lead.first_name} {lead.last_name}</Link>
                    </td>
                    <td className="table-td">{lead.company || '—'}</td>
                    <td className="table-td text-brand-600">{lead.email || '—'}</td>
                    <td className="table-td">{lead.phone || '—'}</td>
                    <td className="table-td">{lead.source || '—'}</td>
                    <td className="table-td"><Badge label={lead.status} /></td>
                    <td className="table-td">{lead.owner_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-zoho-border/60">
            <p className="text-xs text-zoho-muted">{total ? `${((page - 1) * limit) + 1}–${Math.min(page * limit, total)} of ${total} records` : '0 records'}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-secondary-sm disabled:opacity-40">← Prev</button>
              <span className="btn-secondary-sm pointer-events-none">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="btn-secondary-sm disabled:opacity-40">Next →</button>
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <Modal title="Create Lead" onClose={() => setModal(false)}>
          {/* Lead Information */}
          <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-3">Lead Information</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="col-span-2 grid grid-cols-[120px_1fr_1fr] gap-3">
              <FormField label="Salutation">
                <select className="input" value={form.salutation} onChange={e => setForm(p => ({ ...p, salutation: e.target.value }))}>
                  <option value="">--None--</option>{SALUTATIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="First Name" name="first_name"><input className="input" value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} /></FormField>
              <FormField label="Last Name" required error={errors.last_name} name="last_name"><input className={inputClass(errors.last_name)} value={form.last_name} onChange={e => { setForm(p => ({ ...p, last_name: e.target.value })); setErrors(er => ({ ...er, last_name: null })); }} /></FormField>
            </div>
            <FormField label="Company" required error={errors.company} name="company"><input className={inputClass(errors.company)} value={form.company} onChange={e => { setForm(p => ({ ...p, company: e.target.value })); setErrors(er => ({ ...er, company: null })); }} /></FormField>
            <FormField label="Job Title" name="title"><input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></FormField>
            <FormField label="Lead Status" required error={errors.lead_status} name="lead_status">
              <select className={inputClass(errors.lead_status)} value={form.lead_status} onChange={e => { setForm(p => ({ ...p, lead_status: e.target.value })); setErrors(er => ({ ...er, lead_status: null })); }}>
                {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </FormField>
            <FormField label="Lead Source"><select className="input" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}><option value="">--None--</option>{LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}</select></FormField>
            <FormField label="Industry"><select className="input" value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}><option value="">--None--</option>{['IT Services','E-Commerce','EdTech','Automotive','Finance','Healthcare','Manufacturing','Education','Media','Real Estate','Other'].map(i => <option key={i}>{i}</option>)}</select></FormField>
            <FormField label="Rating"><select className="input" value={form.rating} onChange={e => setForm(p => ({ ...p, rating: e.target.value }))}><option value="">--None--</option>{RATINGS.map(r => <option key={r}>{r}</option>)}</select></FormField>
            <FormField label="Annual Revenue"><input className="input" type="number" placeholder="₹" value={form.annual_revenue} onChange={e => setForm(p => ({ ...p, annual_revenue: e.target.value }))} /></FormField>
            <FormField label="No. of Employees"><input className="input" type="number" value={form.no_of_employees} onChange={e => setForm(p => ({ ...p, no_of_employees: e.target.value }))} /></FormField>
            <FormField label="Website"><input className="input" placeholder="https://" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} /></FormField>
          </div>

          {/* Contact Information */}
          <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-3">Contact Information</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <FormField label="Email" required error={errors.email} name="email"><input className={inputClass(errors.email)} type="email" value={form.email} onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setErrors(er => ({ ...er, email: null })); }} /></FormField>
            <FormField label="Phone" required error={errors.phone} name="phone"><input className={inputClass(errors.phone)} value={form.phone} onChange={e => { setForm(p => ({ ...p, phone: e.target.value })); setErrors(er => ({ ...er, phone: null })); }} /></FormField>
            <FormField label="Mobile"><input className="input" value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} /></FormField>
          </div>

          {/* Address Information */}
          <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-3">Address Information</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="col-span-2"><FormField label="Street"><input className="input" value={form.street} onChange={e => setForm(p => ({ ...p, street: e.target.value }))} /></FormField></div>
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
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Lead'}</button>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={bulkDelete} message={`Delete ${selected.length} selected lead(s)?`} confirmLabel="Delete All" danger onConfirm={handleBulkDelete} onCancel={() => setBulkDelete(false)} />
    </CRMLayout>
  );
}
