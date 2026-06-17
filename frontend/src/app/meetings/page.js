'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useOpenCreateParam } from '../../hooks/useOpenCreateParam.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';
import * as meetingsApi from '../../lib/services/meetings.js';
import { fetchUsers } from '../../lib/services/lookups.js';

const EMPTY = { title: '', from_datetime: '', to_datetime: '', host_id: '', location: '', description: '' };
const REQUIRED = { title: 'Meeting Title', from_datetime: 'From Date & Time', to_datetime: 'To Date & Time', host_id: 'Host' };
const LIMIT = 15;

export default function MeetingsPage() {
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchUsers().then(setUsers).catch(() => {}); }, []);

  const openCreate = useCallback(() => { setForm(EMPTY); setErrors({}); setModal(true); }, []);
  useOpenCreateParam(canEdit, openCreate);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await meetingsApi.listMeetings({ page, page_size: LIMIT, search: debouncedSearch || undefined });
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
    const errs = validateRequired(REQUIRED, form);
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    setSaving(true);
    try {
      await meetingsApi.createMeeting(form);
      setModal(false);
      fetchItems();
      showToast('Meeting saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const columns = useMemo(() => [
    { id: 'title', header: 'Title', cell: (m) => <Link href={`/meetings/${m.id}`} className="font-medium text-brand-600 hover:underline">{m.title}</Link> },
    { id: 'from', header: 'From', cell: (m) => new Date(m.from_datetime).toLocaleString() },
    { id: 'to', header: 'To', cell: (m) => new Date(m.to_datetime).toLocaleString() },
    { id: 'host', header: 'Host', cell: (m) => m.host_name },
    { id: 'location', header: 'Location', cell: (m) => m.location || '—' },
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <div className="flex justify-between mb-5">
          <div><h1 className="text-xl font-bold">Meetings</h1><p className="text-xs text-gray-500">{total} meetings</p></div>
          {canEdit && <button onClick={openCreate} className="btn-primary">+ Create Meeting</button>}
        </div>
        <div className="card">
          <div className="p-4 border-b"><input className="input max-w-xs" placeholder="Search meetings..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
          <RecordDataTable
            moduleKey="meetings"
            records={items}
            loading={loading}
            columns={columns}
            onRefresh={fetchItems}
            emptyMessage="No meetings found"
            pagination={totalPages > 1 ? { page, totalPages, onPageChange: setPage, label: `${page} / ${totalPages}` } : undefined}
          />
        </div>
      </div>
      {modal && <Modal title="Create Meeting" onClose={() => setModal(false)}>
        <div className="space-y-3">
          <FormField label="Meeting Title" required error={errors.title} name="title"><input className={inputClass(errors.title)} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></FormField>
          <FormField label="From" required error={errors.from_datetime} name="from_datetime"><input className={inputClass(errors.from_datetime)} type="datetime-local" value={form.from_datetime?.slice(0, 16)} onChange={e => setForm(p => ({ ...p, from_datetime: e.target.value }))} /></FormField>
          <FormField label="To" required error={errors.to_datetime} name="to_datetime"><input className={inputClass(errors.to_datetime)} type="datetime-local" value={form.to_datetime?.slice(0, 16)} onChange={e => setForm(p => ({ ...p, to_datetime: e.target.value }))} /></FormField>
          <FormField label="Host" required error={errors.host_id} name="host_id"><select className={inputClass(errors.host_id)} value={form.host_id} onChange={e => setForm(p => ({ ...p, host_id: e.target.value }))}><option value="">Select</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></FormField>
          <FormField label="Location"><input className="input" value={form.location || ''} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} /></FormField>
        </div>
        <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button></div>
      </Modal>}
    </CRMLayout>
  );
}
