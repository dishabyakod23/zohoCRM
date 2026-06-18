'use client';
import { useEffect, useMemo, useState } from 'react';
import FormField, { inputClass } from '../forms/FormField.js';
import { ASSIGN_TO_ALL, ASSIGN_TO_ME, EVENT_TYPES, emptyEventForm, toDateKey } from '../../lib/calendarHelpers.js';

export default function CalendarEventModal({
  open,
  onClose,
  onSave,
  onDelete,
  initial,
  saving,
  users = [],
  currentUserId,
  currentUserName = 'Me',
  canAssignToOthers = false,
}) {
  const [form, setForm] = useState(emptyEventForm({ assign_to: ASSIGN_TO_ME }));

  const otherMembers = useMemo(
    () => users.filter((u) => String(u.id || u.value) !== String(currentUserId)),
    [users, currentUserId],
  );

  useEffect(() => {
    if (!open) return;
    if (initial?.id) {
      setForm({
        title: initial.title || '',
        description: initial.description || '',
        event_type: initial.event_type || 'task',
        event_date: toDateKey(initial.event_date),
        start_time: initial.start_time?.slice?.(0, 5) || initial.start_time || '',
        end_time: initial.end_time?.slice?.(0, 5) || initial.end_time || '',
        all_day: initial.all_day !== false,
        completed: !!initial.completed,
        remind_on_login: initial.remind_on_login !== false,
        assign_to: initial.owner_id && String(initial.owner_id) === String(currentUserId)
          ? ASSIGN_TO_ME
          : (initial.owner_id || ASSIGN_TO_ME),
        owner_id: initial.owner_id || currentUserId || '',
      });
      return;
    }
    setForm(emptyEventForm({
      event_date: initial?.event_date ? toDateKey(initial.event_date) : toDateKey(new Date()),
      assign_to: ASSIGN_TO_ME,
      owner_id: currentUserId || '',
    }));
  }, [open, initial, currentUserId]);

  if (!open) return null;

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onSave({
      ...form,
      start_time: form.all_day ? null : form.start_time || null,
      end_time: form.all_day ? null : form.end_time || null,
    });
  };

  const isEditing = !!initial?.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-zoho-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zoho-text">{isEditing ? 'Edit Event' : 'Create Event'}</h2>
          <button type="button" onClick={onClose} className="text-zoho-muted hover:text-zoho-text text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <FormField label="Title" required>
            <input className={inputClass()} value={form.title} onChange={set('title')} placeholder="Add title" autoFocus />
          </FormField>

          <FormField label="Type">
            <select className="input" value={form.event_type} onChange={set('event_type')}>
              {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>

          <div className={`grid gap-3 ${canAssignToOthers ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <FormField label="Date" required>
              <input className="input" type="date" value={form.event_date} onChange={set('event_date')} />
            </FormField>
            {canAssignToOthers && (
              <FormField label="Assign to">
                <select className="input" value={form.assign_to} onChange={set('assign_to')}>
                  <option value={ASSIGN_TO_ME}>Me{currentUserName && currentUserName !== 'Me' ? ` (${currentUserName})` : ''}</option>
                  {!isEditing && <option value={ASSIGN_TO_ALL}>All team members</option>}
                  {otherMembers.length > 0 && (
                    <optgroup label="Team members">
                      {otherMembers.map((u) => (
                        <option key={u.id || u.value} value={u.id || u.value}>{u.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </FormField>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.all_day} onChange={set('all_day')} />
            All day
          </label>

          {!form.all_day && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Start time">
                <input className="input" type="time" value={form.start_time} onChange={set('start_time')} />
              </FormField>
              <FormField label="End time">
                <input className="input" type="time" value={form.end_time} onChange={set('end_time')} />
              </FormField>
            </div>
          )}

          <FormField label="Description">
            <textarea className="input min-h-[80px]" value={form.description} onChange={set('description')} placeholder="Add details..." />
          </FormField>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.remind_on_login} onChange={set('remind_on_login')} />
              Show in login reminders
            </label>
            {isEditing && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.completed} onChange={set('completed')} />
                Mark completed
              </label>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-zoho-border flex items-center justify-between gap-2">
          <div>
            {isEditing && onDelete && (
              <button type="button" onClick={onDelete} className="text-sm text-red-600 hover:underline">Delete</button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleSubmit} disabled={saving || !form.title.trim()} className="btn-primary">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
