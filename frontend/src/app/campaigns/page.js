'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import Badge from '../../components/ui/Badge.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useOpenCreateParam } from '../../hooks/useOpenCreateParam.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';
import * as campaignsApi from '../../lib/services/campaigns.js';
import { fetchCampaignTypes, fetchCampaignStatuses } from '../../lib/services/lookups.js';

const EMPTY = { name: '', type: 'email', status: 'planning', start_date: '', end_date: '', expected_revenue: '', description: '' };
const LIMIT = 15;

export default function CampaignsPage() {
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [items, setItems] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchCampaignTypes(), fetchCampaignStatuses()])
      .then(([t, s]) => { setTypeOptions(t); setStatusOptions(s); })
      .catch(() => {});
  }, []);

  const openCreate = useCallback(() => { setForm(EMPTY); setErrors({}); setModal(true); }, []);
  useOpenCreateParam(canEdit, openCreate);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await campaignsApi.listCampaigns({ page, page_size: LIMIT, search: debouncedSearch || undefined });
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, showToast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const save = async () => {
    const errs = validateRequired({ name: 'Campaign Name', type: 'Campaign Type', status: 'Status', start_date: 'Start Date', end_date: 'End Date' }, form);
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    setSaving(true);
    try {
      await campaignsApi.createCampaign(form);
      setModal(false);
      fetchItems();
      showToast('Campaign saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex justify-between mb-5">
          <div><h1 className="text-xl font-bold">Campaigns</h1><p className="text-xs text-gray-500">{total} campaigns</p></div>
          {canEdit && <button onClick={openCreate} className="btn-primary">+ Create Campaign</button>}
        </div>
        <div className="card overflow-x-auto">
          <div className="p-4 border-b"><input className="input max-w-xs" placeholder="Search campaigns..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
          <table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">Name</th><th className="table-th">Type</th><th className="table-th">Status</th><th className="table-th">Dates</th><th className="table-th">Members</th></tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={5} className="table-td text-center py-8">Loading...</td></tr>
              : items.length === 0 ? <tr><td colSpan={5} className="table-td text-center py-8 text-gray-400">No campaigns found</td></tr>
              : items.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 group">
                <td className="table-td font-medium"><Link href={`/campaigns/${c.id}`} className="text-brand-600 hover:underline">{c.name}</Link></td>
                <td className="table-td">{c.type_label}</td>
                <td className="table-td"><Badge label={c.status_label} /></td>
                <td className="table-td text-xs">{c.start_date} → {c.end_date}</td>
                <td className="table-td">{c.member_count || 0}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {modal && <Modal title="Create Campaign" onClose={() => setModal(false)}>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Campaign Name" required error={errors.name} name="name"><input className={inputClass(errors.name)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></FormField>
          <FormField label="Type" required><select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>{typeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></FormField>
          <FormField label="Status" required><select className="input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>{statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></FormField>
          <FormField label="Start Date" required error={errors.start_date} name="start_date"><input className={inputClass(errors.start_date)} type="date" value={form.start_date?.slice(0, 10)} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></FormField>
          <FormField label="End Date" required error={errors.end_date} name="end_date"><input className={inputClass(errors.end_date)} type="date" value={form.end_date?.slice(0, 10)} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} /></FormField>
        </div>
        <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button></div>
      </Modal>}
    </CRMLayout>
  );
}
