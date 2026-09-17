'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';
import * as meetingsApi from '../../lib/services/meetings.js';
import { fetchUsers } from '../../lib/services/lookups.js';

const REQUIRED = {
  title: 'Meeting Title',
  from_datetime: 'From Date & Time',
  to_datetime: 'To Date & Time',
  host_id: 'Host',
};

function emptyForm(defaults = {}) {
  return {
    title: '',
    from_datetime: '',
    to_datetime: '',
    host_id: '',
    location: '',
    description: '',
    participant_ids: [],
    is_online_meeting: false,
    sync_to_microsoft: true,
    ...defaults,
  };
}

/**
 * Shared Create Meeting modal (Outlook/Teams sync options included).
 * Used from Calendar (primary) and any remaining create deep-links.
 */
export default function CreateMeetingModal({
  open,
  onClose,
  onCreated,
  defaults = {},
  defaultHostId = '',
}) {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(() => emptyForm({ host_id: defaultHostId, ...defaults }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchUsers()
      .then((list) => { if (!cancelled) setUsers(list); })
      .catch(() => { if (!cancelled) setUsers([]); });
    setForm(emptyForm({
      host_id: defaultHostId || '',
      from_datetime: defaults.from_datetime || '',
      to_datetime: defaults.to_datetime || '',
      title: defaults.title || '',
      location: defaults.location || '',
      description: defaults.description || '',
    }));
    setErrors({});
    return () => { cancelled = true; };
  }, [open, defaultHostId, defaults.from_datetime, defaults.to_datetime, defaults.title, defaults.location, defaults.description]);

  const participantOptions = useMemo(
    () => users.filter((u) => String(u.id) !== String(form.host_id)),
    [users, form.host_id],
  );

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
    if (Object.keys(errs).length) {
      showToast('Fill all the required fields.');
      return;
    }
    setSaving(true);
    try {
      const created = await meetingsApi.createMeeting(form);
      showToast('Meeting saved', 'success');
      if (String(created.microsoft_sync_status || '').toLowerCase() === 'disconnected') {
        showToast('Connect Microsoft in Settings to sync to Outlook', 'error');
      }
      if (created.teams_join_url) {
        try {
          await navigator.clipboard.writeText(created.teams_join_url);
          showToast('Teams join link copied', 'success');
        } catch {
          showToast('Teams join link ready on the meeting detail page', 'success');
        }
      }
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal title="Create Meeting" onClose={onClose}>
      <div className="space-y-3">
        <FormField label="Meeting Title" required error={errors.title} name="title">
          <input
            className={inputClass(errors.title)}
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
        </FormField>
        <FormField label="From" required error={errors.from_datetime} name="from_datetime">
          <input
            className={inputClass(errors.from_datetime)}
            type="datetime-local"
            value={form.from_datetime?.slice(0, 16)}
            onChange={(e) => setForm((p) => ({ ...p, from_datetime: e.target.value }))}
          />
        </FormField>
        <FormField label="To" required error={errors.to_datetime} name="to_datetime">
          <input
            className={inputClass(errors.to_datetime)}
            type="datetime-local"
            value={form.to_datetime?.slice(0, 16)}
            onChange={(e) => setForm((p) => ({ ...p, to_datetime: e.target.value }))}
          />
        </FormField>
        <FormField label="Host" required error={errors.host_id} name="host_id">
          <select
            className={inputClass(errors.host_id)}
            value={form.host_id}
            onChange={(e) => setForm((p) => ({
              ...p,
              host_id: e.target.value,
              participant_ids: (p.participant_ids || []).filter((id) => id !== e.target.value),
            }))}
          >
            <option value="">Select</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </FormField>
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
        <FormField label="Location">
          <input
            className="input"
            value={form.location || ''}
            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
          />
        </FormField>
        <FormField label="Description">
          <textarea
            className="input min-h-[72px]"
            value={form.description || ''}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </FormField>
        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.is_online_meeting}
              onChange={(e) => setForm((p) => ({ ...p, is_online_meeting: e.target.checked }))}
              className="rounded border-zoho-border text-brand-600 focus:ring-brand-500"
            />
            <span>Add Teams meeting link</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.sync_to_microsoft !== false}
              onChange={(e) => setForm((p) => ({ ...p, sync_to_microsoft: e.target.checked }))}
              className="rounded border-zoho-border text-brand-600 focus:ring-brand-500"
            />
            <span>Sync to Outlook</span>
          </label>
          <p className="text-[11px] text-zoho-muted">
            Host must connect Microsoft 365 in Settings for Outlook/Teams sync. Synced meetings appear on this calendar.
          </p>
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="button" onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}
