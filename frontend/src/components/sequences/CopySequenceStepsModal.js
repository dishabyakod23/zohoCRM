'use client';
import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal.js';
import FormField from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as sequencesApi from '../../lib/services/sequences.js';
import {
  canEditSequenceSteps,
  copySequenceSteps,
  resolveRelativeStepSchedules,
} from '../../lib/sequenceHelpers.js';

export default function CopySequenceStepsModal({
  open,
  direction = 'from',
  currentSequenceId,
  currentSteps = [],
  currentTimezone = 'UTC',
  onClose,
  onApplyFrom,
}) {
  const { showToast } = useToast();
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [step1Date, setStep1Date] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);

  const isFrom = direction === 'from';

  useEffect(() => {
    if (!open) {
      setSelectedId('');
      setStep1Date('');
      setConfirmReplace(false);
      return;
    }
    setLoading(true);
    sequencesApi.listSequences({ page: 1, page_size: 100 })
      .then((res) => setSequences(res.data || []))
      .catch((err) => showToast(getApiError(err)))
      .finally(() => setLoading(false));
  }, [open, showToast]);

  const options = useMemo(
    () => (sequences || []).filter((row) => String(row.id) !== String(currentSequenceId)),
    [sequences, currentSequenceId],
  );

  const selected = options.find((row) => String(row.id) === String(selectedId));

  const destBlocked = !isFrom && selected && !canEditSequenceSteps(selected.status);

  const handleCopy = async () => {
    if (!selectedId) {
      showToast('Select a sequence.');
      return;
    }
    if (destBlocked) {
      showToast('Pause the destination sequence before copying steps into it.');
      return;
    }
    if (!isFrom && !step1Date) {
      showToast('Set Step 1’s date on the destination sequence.');
      return;
    }

    setSaving(true);
    try {
      if (isFrom) {
        const sourceSteps = await sequencesApi.listSequenceSteps(selectedId);
        if (!sourceSteps.length) {
          showToast('That sequence has no steps to copy.');
          return;
        }
        if (currentSteps.length && !confirmReplace) {
          setConfirmReplace(true);
          return;
        }
        const copied = copySequenceSteps(sourceSteps);
        await onApplyFrom?.(copied);
        showToast(
          `Copied ${copied.length} step${copied.length === 1 ? '' : 's'}. Set Step 1’s date — later delays will follow.`,
          'success',
        );
        onClose();
        return;
      }

      if (!currentSteps.length) {
        showToast('This sequence has no steps to copy.');
        return;
      }
      const destSteps = await sequencesApi.listSequenceSteps(selectedId);
      if (destSteps.length && !confirmReplace) {
        setConfirmReplace(true);
        return;
      }
      const copied = copySequenceSteps(currentSteps);
      copied[0] = { ...copied[0], scheduled_date: step1Date };
      const ready = resolveRelativeStepSchedules(copied);
      await sequencesApi.copyStepsToSequence(selected, ready, {
        sequenceTimezone: selected.timezone || currentTimezone,
      });
      showToast(`Copied ${ready.length} step${ready.length === 1 ? '' : 's'} to ${selected.name}.`, 'success');
      onClose();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      title={isFrom ? 'Copy steps from another sequence' : 'Copy these steps to another sequence'}
      onClose={onClose}
    >
      <div className="space-y-4">
        <p className="text-sm text-zoho-muted">
          {isFrom
            ? 'All step content and delay gaps are copied. Step 1’s date is left blank so you can schedule this sequence separately.'
            : 'Everything is copied except Step 1’s date. Choose a new Step 1 date for the destination; later steps keep their day gaps.'}
        </p>
        <FormField label="Sequence" required>
          <select
            className="input"
            value={selectedId}
            disabled={loading || saving}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setConfirmReplace(false);
            }}
          >
            <option value="">{loading ? 'Loading…' : 'Select sequence'}</option>
            {options.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} ({row.status_label || row.status})
              </option>
            ))}
          </select>
        </FormField>
        {destBlocked && (
          <p className="text-sm text-red-600">Pause that sequence before copying steps into it.</p>
        )}
        {!isFrom && (
          <FormField label="Step 1 date on destination" required>
            <input
              className="input"
              type="date"
              value={step1Date}
              disabled={saving}
              onChange={(e) => setStep1Date(e.target.value)}
            />
          </FormField>
        )}
        {confirmReplace && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {isFrom
              ? 'This sequence already has steps. Copying will replace them.'
              : `${selected?.name || 'The destination'} already has steps. Copying will replace them.`}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary-sm"
            onClick={handleCopy}
            disabled={saving || loading || destBlocked}
          >
            {saving ? 'Copying…' : confirmReplace ? 'Replace and copy' : 'Copy steps'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
