'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import ListPageHeader from '../../components/layout/ListPageHeader.js';
import ListSearchBar from '../../components/layout/ListSearchBar.js';
import Modal from '../../components/ui/Modal.js';
import RecordDataTable from '../../components/records/RecordDataTable.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import { useToast } from '../../components/ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { useOpenCreateParam } from '../../hooks/useOpenCreateParam.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';
import * as callsApi from '../../lib/services/calls.js';
import { fetchCallTypes, fetchUsers } from '../../lib/services/lookups.js';
import { tableLinkClass } from '../../lib/tableStyles.js';
import { DEFAULT_PAGE_SIZE } from '../../lib/constants.js';
import { DEFAULT_LIST_SORT, getSortApiParams } from '../../lib/listSortHelpers.js';

const EMPTY = { subject: '', call_type: 'outbound', start_time: '', assigned_to: '', duration_minutes: 15, description: '' };
const LIMIT = DEFAULT_PAGE_SIZE;

export default function CallsPage() {
  const { showToast } = useToast();
  const { canEdit } = usePermissions();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [callTypes, setCallTypes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [sort, setSort] = useState(DEFAULT_LIST_SORT);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchCallTypes()]).then(([u, t]) => { setUsers(u); setCallTypes(t); }).catch(() => {});
  }, []);

  const openCreate = useCallback(() => { setForm(EMPTY); setErrors({}); setModal(true); }, []);
  useOpenCreateParam(canEdit, openCreate);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callsApi.listCalls({
        page,
        page_size: LIMIT,
        search: debouncedSearch || undefined,
        ...getSortApiParams(sort, 'calls'),
      });
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sort, showToast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const save = async () => {
    const errs = validateRequired({ subject: 'Call Subject', call_type: 'Call Type', start_time: 'Call Date & Time', assigned_to: 'Assigned To' }, form);
    setErrors(errs);
    if (Object.keys(errs).length) { showToast('Please fill in all required fields before saving.'); return; }
    setSaving(true);
    try {
      await callsApi.createCall(form);
      setModal(false);
      fetchItems();
      showToast('Call saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const columns = useMemo(() => [
    { id: 'subject', header: 'Subject', cell: (c) => <Link href={`/calls/${c.id}`} className={tableLinkClass}>{c.subject}</Link> },
    { id: 'type', header: 'Type', cell: (c) => c.call_type_label },
    { id: 'date', header: 'Date', cell: (c) => new Date(c.start_time).toLocaleString() },
    { id: 'duration', header: 'Duration', cell: (c) => `${c.duration_minutes} min` },
    { id: 'assigned', header: 'Assigned To', cell: (c) => c.assigned_name },
  ], []);

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Calls"
          subtitle="Log and review phone conversations."
          primaryAction={canEdit ? (
            <button type="button" onClick={openCreate} className="btn-primary-sm">Create Call</button>
          ) : null}
        />

        <ListSearchBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search calls…"
          total={total}
          totalLabel="calls"
          sort={sort}
          onSortChange={(v) => { setSort(v); setPage(1); }}
          table={(
            <RecordDataTable
              moduleKey="calls"
              records={items}
              loading={loading}
              columns={columns}
              onRefresh={fetchItems}
              emptyMessage="No calls found"
              pagination={{ page, totalPages, onPageChange: setPage, label: total ? `${((page - 1) * LIMIT) + 1}–${Math.min(page * LIMIT, total)} of ${total}` : '0 records' }}
            />
          )}
        />
      </div>
      {modal && <Modal title="Create Call" onClose={() => setModal(false)}>
        <div className="space-y-3">
          <FormField label="Call Subject" required error={errors.subject} name="subject"><input className={inputClass(errors.subject)} value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} /></FormField>
          <FormField label="Call Type" required><select className="input" value={form.call_type} onChange={e => setForm(p => ({ ...p, call_type: e.target.value }))}>{callTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></FormField>
          <FormField label="Call Date & Time" required error={errors.start_time} name="start_time"><input className={inputClass(errors.start_time)} type="datetime-local" value={form.start_time?.slice(0, 16)} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} /></FormField>
          <FormField label="Duration (minutes)"><input className="input" type="number" min={0} value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} /></FormField>
          <FormField label="Assigned To" required error={errors.assigned_to} name="assigned_to"><select className={inputClass(errors.assigned_to)} value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}><option value="">Select</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></FormField>
        </div>
        <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button></div>
      </Modal>}
    </CRMLayout>
  );
}
