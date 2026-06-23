'use client';
import { useCallback, useEffect, useState } from 'react';
import Modal from '../ui/Modal.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { USER_ROLES, ROLE_LABELS } from '../../lib/roles.js';
import * as announcementsApi from '../../lib/services/announcements.js';
import { formatAnnouncementDate } from '../../lib/services/announcements.js';

const EMPTY = {
  title: '',
  body: '',
  is_active: true,
  priority: 0,
  audience_roles: [],
  starts_at: '',
  ends_at: '',
};

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AnnouncementsPanel() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await announcementsApi.listAdminAnnouncements({ include_inactive: true });
      setItems(result.data);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setErrors({});
    setModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title || '',
      body: item.body || '',
      is_active: item.is_active !== false,
      priority: item.priority ?? 0,
      audience_roles: [...(item.audience_roles || [])],
      starts_at: toDatetimeLocalValue(item.starts_at),
      ends_at: toDatetimeLocalValue(item.ends_at),
    });
    setErrors({});
    setModal(true);
  };

  const toggleRole = (role) => {
    setForm((f) => ({
      ...f,
      audience_roles: f.audience_roles.includes(role)
        ? f.audience_roles.filter((r) => r !== role)
        : [...f.audience_roles, role],
    }));
  };

  const save = async () => {
    const errs = {};
    if (!form.title?.trim()) errs.title = 'Title is required';
    if (!form.body?.trim()) errs.body = 'Body is required';
    setErrors(errs);
    if (Object.keys(errs).length) {
      showToast('Please fill in all required fields.');
      return;
    }
    setSaving(true);
    try {
      if (editing?.id) {
        await announcementsApi.updateAnnouncement(editing.id, form);
        showToast('Announcement updated', 'success');
      } else {
        await announcementsApi.createAnnouncement(form);
        showToast('Announcement created', 'success');
      }
      setModal(false);
      load();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    setDeletingId(id);
    try {
      await announcementsApi.deleteAnnouncement(id);
      showToast('Announcement deleted', 'success');
      load();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold">Announcements</h2>
            <p className="text-xs text-zoho-muted">
              Shown in the bottom utility bar via <code className="text-brand-600">GET /announcements</code>
            </p>
          </div>
          <button type="button" onClick={openCreate} className="btn-primary text-xs">+ New Announcement</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Title</th>
                <th className="table-th">Status</th>
                <th className="table-th">Priority</th>
                <th className="table-th">Audience</th>
                <th className="table-th">Schedule</th>
                <th className="table-th">Created</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={7} className="table-td text-center py-8 text-gray-400">Loading announcements…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="table-td text-center py-8 text-gray-400">No announcements yet</td></tr>
              ) : items.map((a) => (
                <tr key={a.id} className={!a.is_active ? 'opacity-60' : ''}>
                  <td className="table-td font-medium max-w-[200px]">
                    <p className="truncate">{a.title}</p>
                    <p className="text-xs text-zoho-muted truncate">{a.body}</p>
                  </td>
                  <td className="table-td">
                    <span className={`badge ${a.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-td text-xs">{a.priority ?? 0}</td>
                  <td className="table-td text-xs text-zoho-muted max-w-[140px]">
                    {(a.audience_roles || []).length
                      ? a.audience_roles.map((r) => ROLE_LABELS[r] || r).join(', ')
                      : 'All roles'}
                  </td>
                  <td className="table-td text-xs text-zoho-muted">
                    {a.starts_at || a.ends_at ? (
                      <>
                        {a.starts_at ? formatAnnouncementDate(a.starts_at) : '—'}
                        {' → '}
                        {a.ends_at ? formatAnnouncementDate(a.ends_at) : '—'}
                      </>
                    ) : 'Always'}
                  </td>
                  <td className="table-td text-xs text-zoho-muted">{formatAnnouncementDate(a.created_at)}</td>
                  <td className="table-td whitespace-nowrap">
                    <button type="button" onClick={() => openEdit(a)} className="text-xs text-blue-600 hover:underline mr-3">Edit</button>
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      disabled={deletingId === a.id}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      {deletingId === a.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Announcement' : 'New Announcement'} onClose={() => setModal(false)}>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <FormField label="Title" required error={errors.title} name="title">
              <input
                className={inputClass(errors.title)}
                value={form.title}
                onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value })); setErrors((er) => ({ ...er, title: null })); }}
              />
            </FormField>
            <FormField label="Body" required error={errors.body} name="body">
              <textarea
                className={`${inputClass(errors.body)} min-h-[100px]`}
                value={form.body}
                onChange={(e) => { setForm((f) => ({ ...f, body: e.target.value })); setErrors((er) => ({ ...er, body: null })); }}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Priority" name="priority">
                <input
                  className="input"
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                />
              </FormField>
              <FormField label="Active" name="is_active">
                <label className="flex items-center gap-2 mt-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  />
                  Show to users
                </label>
              </FormField>
            </div>
            <FormField label="Starts at (optional)" name="starts_at">
              <input
                className="input"
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
              />
            </FormField>
            <FormField label="Ends at (optional)" name="ends_at">
              <input
                className="input"
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
              />
            </FormField>
            <div>
              <p className="label">Audience roles</p>
              <p className="text-xs text-zoho-muted mb-2">Leave empty to show all roles</p>
              <div className="flex flex-wrap gap-2">
                {USER_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-1.5 text-xs border border-zoho-border rounded-lg px-2 py-1.5 cursor-pointer hover:bg-brand-50">
                    <input
                      type="checkbox"
                      checked={form.audience_roles.includes(role)}
                      onChange={() => toggleRole(role)}
                    />
                    {ROLE_LABELS[role]}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
