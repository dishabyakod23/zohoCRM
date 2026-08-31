'use client';
import { useState } from 'react';
import {
  formatDateTimeInTimezone,
  isoToDatetimeLocalInput,
  datetimeLocalInputToIso,
  normalizeSequenceTimezone,
} from '../../lib/sequenceHelpers.js';
import * as sequencesApi from '../../lib/services/sequences.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';

export default function EnrollmentNextActionCell({
  enrollment,
  sequenceTimezone = 'UTC',
  canEdit = false,
  onUpdated,
}) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const tz = normalizeSequenceTimezone(sequenceTimezone);
  const editable = canEdit && ['ACTIVE', 'PAUSED'].includes(enrollment.status);

  const startEdit = () => {
    setValue(isoToDatetimeLocalInput(enrollment.next_action_at, tz) || '');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setValue('');
  };

  const save = async () => {
    if (!value) {
      showToast('Pick a date and time');
      return;
    }
    const next_action_at = datetimeLocalInputToIso(value, tz);
    if (!next_action_at) {
      showToast('Invalid date or time');
      return;
    }
    setSaving(true);
    try {
      const updated = await sequencesApi.updateEnrollment(enrollment.id, { next_action_at });
      showToast('Next action updated', 'success');
      onUpdated?.(updated);
      setEditing(false);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 min-w-[200px]">
        <input
          type="datetime-local"
          className="input text-xs py-1"
          value={value}
          disabled={saving}
          onChange={(e) => setValue(e.target.value)}
        />
        <p className="text-[10px] text-zoho-muted">{tz}</p>
        <div className="flex gap-2">
          <button type="button" disabled={saving} onClick={save} className="text-xs text-brand-600 hover:underline">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" disabled={saving} onClick={cancelEdit} className="text-xs text-zoho-muted hover:underline">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs">
        {enrollment.next_action_at
          ? formatDateTimeInTimezone(enrollment.next_action_at, tz)
          : '—'}
      </span>
      {editable && (
        <button type="button" onClick={startEdit} className="text-xs text-brand-600 hover:underline">
          Edit
        </button>
      )}
    </div>
  );
}
