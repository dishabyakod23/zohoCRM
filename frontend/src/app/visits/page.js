'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';
import * as visitsApi from '../../lib/services/visits.js';
import { fetchAccountLookups, accountMapFromLookups, fetchVisitStatuses } from '../../lib/services/lookups.js';

const EMPTY = { title: '', visit_date: '', location: '', status: 'planned', account_id: '' };

export default function VisitsPage() {
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const accountMap = useMemo(() => accountMapFromLookups(accounts), [accounts]);

  useEffect(() => {
    Promise.all([fetchAccountLookups(), fetchVisitStatuses()])
      .then(([a, s]) => { setAccounts(a); setStatusOptions(s); })
      .catch(() => {});
  }, []);

  const openCreate = useCallback(() => { setForm(EMPTY); setErrors({}); setModal(true); }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await visitsApi.listVisits({ page: 1, page_size: 50 }, accountMap);
      setItems(result.data);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [accountMap, showToast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const save = async () => {
    const errs = validateRequired({ title: 'Visit Name', visit_date: 'Visit Date' }, form);
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields.'); return; }
    setSaving(true);
    try {
      await visitsApi.createVisit(form);
      setModal(false);
      fetchItems();
      showToast('Visit saved', 'success');
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
          <h1 className="text-xl font-bold">Visits</h1>
          {canEdit && <button onClick={openCreate} className="btn-primary">+ Log Visit</button>}
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full"><thead className="bg-gray-50"><tr><th className="table-th">Title</th><th className="table-th">Date</th><th className="table-th">Account</th><th className="table-th">Location</th><th className="table-th">Status</th></tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={5} className="table-td text-center py-8">Loading...</td></tr>
              : items.length === 0 ? <tr><td colSpan={5} className="table-td text-center py-8 text-gray-400">No visits found</td></tr>
              : items.map(v => (
              <tr key={v.id} className="hover:bg-gray-50 group">
                <td className="table-td font-medium"><Link href={`/visits/${v.id}`} className="text-brand-600 hover:underline">{v.title}</Link></td>
                <td className="table-td">{new Date(v.visit_date).toLocaleString()}</td>
                <td className="table-td">{v.account_name || '—'}</td>
                <td className="table-td">{v.location || '—'}</td>
                <td className="table-td">{v.status_label}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {modal && <Modal title="Log Visit" onClose={() => setModal(false)}>
        <div className="space-y-3">
          <FormField label="Visit Name" required error={errors.title}><input className={inputClass(errors.title)} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></FormField>
          <FormField label="Visit Date" required error={errors.visit_date}><input className={inputClass(errors.visit_date)} type="datetime-local" value={form.visit_date?.slice(0, 16)} onChange={e => setForm(p => ({ ...p, visit_date: e.target.value }))} /></FormField>
          <FormField label="Account"><select className="input" value={form.account_id || ''} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}><option value="">None</option>{accounts.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}</select></FormField>
          <FormField label="Status"><select className="input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>{statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></FormField>
          <FormField label="Location"><input className="input" value={form.location || ''} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} /></FormField>
        </div>
        <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button></div>
      </Modal>}
    </CRMLayout>
  );
}
