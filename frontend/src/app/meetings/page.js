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
import * as meetingsApi from '../../lib/services/meetings.js';
import { fetchUsers } from '../../lib/services/lookups.js';
import { tableLinkClass } from '../../lib/tableStyles.js';
import { DEFAULT_PAGE_SIZE } from '../../lib/constants.js';
import { DEFAULT_LIST_SORT, getSortApiParams } from '../../lib/listSortHelpers.js';

const EMPTY = { title: '', from_datetime: '', to_datetime: '', host_id: '', location: '', description: '', participant_ids: [] };
const REQUIRED = { title: 'Meeting Title', from_datetime: 'From Date & Time', to_datetime: 'To Date & Time', host_id: 'Host' };
const LIMIT = DEFAULT_PAGE_SIZE;

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
  const [sort, setSort] = useState(DEFAULT_LIST_SORT);

  useEffect(() => { fetchUsers().then(setUsers).catch(() => {}); }, []);

  const openCreate = useCallback(() => { setForm(EMPTY); setErrors({}); setModal(true); }, []);
  useOpenCreateParam(canEdit, openCreate);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await meetingsApi.listMeetings({
        page,
        page_size: LIMIT,
        search: debouncedSearch || undefined,
        ...getSortApiParams(sort, 'meetings'),
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

  const toggleParticipant = (userId) => {
    setForm((p) => {
      const ids = p.participant_ids || [];
      const next = ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId];
      return { ...p, participant_ids: next };
    });
  };

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
    { id: 'title', header: 'Title', cell: (m) => <Link href={`/meetings/${m.id}`} className={tableLinkClass}>{m.title}</Link> },
    { id: 'from', header: 'From', cell: (m) => new Date(m.from_datetime).toLocaleString() },
    { id: 'to', header: 'To', cell: (m) => new Date(m.to_datetime).toLocaleString() },
    { id: 'host', header: 'Host', cell: (m) => m.host_name },
    { id: 'location', header: 'Location', cell: (m) => m.location || '—' },
  ], []);

  const participantOptions = useMemo(
    () => users.filter((u) => String(u.id) !== String(form.host_id)),
    [users, form.host_id],
  );

  return (
    <CRMLayout>
      <div className="p-6">
        <ListPageHeader
          title="Meetings"
          subtitle="Schedule and review customer meetings."
          primaryAction={canEdit ? (
            <button type="button" onClick={openCreate} className="btn-primary-sm">Create Meeting</button>
          ) : null}
        />

        <ListSearchBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search meetings…"
          total={total}
          totalLabel="meetings"
          sort={sort}
          onSortChange={(v) => { setSort(v); setPage(1); }}
          table={(
            <RecordDataTable
              moduleKey="meetings"
              records={items}
              loading={loading}
              columns={columns}
              onRefresh={fetchItems}
              emptyMessage="No meetings found"
              pagination={{ page, totalPages, onPageChange: setPage, label: total ? `${((page - 1) * LIMIT) + 1}–${Math.min(page * LIMIT, total)} of ${total}` : '0 records' }}
            />
          )}
        />
      </div>
      {modal && <Modal title="Create Meeting" onClose={() => setModal(false)}>
        <div className="space-y-3">
          <FormField label="Meeting Title" required error={errors.title} name="title"><input className={inputClass(errors.title)} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></FormField>
          <FormField label="From" required error={errors.from_datetime} name="from_datetime"><input className={inputClass(errors.from_datetime)} type="datetime-local" value={form.from_datetime?.slice(0, 16)} onChange={e => setForm(p => ({ ...p, from_datetime: e.target.value }))} /></FormField>
          <FormField label="To" required error={errors.to_datetime} name="to_datetime"><input className={inputClass(errors.to_datetime)} type="datetime-local" value={form.to_datetime?.slice(0, 16)} onChange={e => setForm(p => ({ ...p, to_datetime: e.target.value }))} /></FormField>
          <FormField label="Host" required error={errors.host_id} name="host_id"><select className={inputClass(errors.host_id)} value={form.host_id} onChange={e => setForm(p => ({ ...p, host_id: e.target.value, participant_ids: (p.participant_ids || []).filter((id) => id !== e.target.value) }))}><option value="">Select</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></FormField>
          <FormField label="Participants" name="participant_ids">
            <div className="border border-zoho-border rounded-xl max-h-40 overflow-y-auto p-2 space-y-1">
              {participantOptions.length === 0 ? (
                <p className="text-xs text-zoho-muted px-1 py-2">Select a host first, then add other team members.</p>
              ) : (
                participantOptions.map((u) => {
                  const checked = (form.participant_ids || []).includes(u.id);
                  return (
                    <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-brand-50 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleParticipant(u.id)}
                        className="rounded border-zoho-border text-brand-600 focus:ring-brand-500"
                      />
                      <span>{u.name}</span>
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-[11px] text-zoho-muted mt-1">Participants get an in-app meeting invite notification.</p>
          </FormField>
          <FormField label="Location"><input className="input" value={form.location || ''} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} /></FormField>
          <FormField label="Description"><textarea className="input min-h-[72px]" value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></FormField>
        </div>
        <div className="flex gap-2 justify-end mt-4"><button onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button></div>
      </Modal>}
    </CRMLayout>
  );
}
