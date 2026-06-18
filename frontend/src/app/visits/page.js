'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import Modal from '../../components/ui/Modal.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';
import * as visitsApi from '../../lib/services/visits.js';
import { fetchAccountLookups, accountMapFromLookups, fetchVisitStatuses } from '../../lib/services/lookups.js';
import { tableLinkClass } from '../../lib/tableStyles.js';

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

  const columns = useMemo(() => [
    { id: 'title', header: 'Title', cell: (v) => <Link href={`/visits/${v.id}`} className={tableLinkClass}>{v.title}</Link> },
    { id: 'date', header: 'Date', cell: (v) => new Date(v.visit_date).toLocaleString() },
    { id: 'account', header: 'Account', cell: (v) => v.account_name || '—' },
    { id: 'location', header: 'Location', cell: (v) => v.location || '—' },
    { id: 'status', header: 'Status', cell: (v) => v.status_label },
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Visits"
          subtitle="Plan and track on-site customer visits."
          primaryAction={canEdit ? (
            <button type="button" onClick={openCreate} className="btn-primary-sm">Create Visit</button>
          ) : null}
        />

        <div className="card">
          <RecordDataTable
            moduleKey="visits"
            records={items}
            loading={loading}
            columns={columns}
            statusOptions={statusOptions}
            onRefresh={fetchItems}
            emptyMessage="No visits found"
          />
        </div>
      </div>
      {modal && <Modal title="Create Visit" onClose={() => setModal(false)}>
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
