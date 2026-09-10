'use client';
import { useEffect, useState } from 'react';
import SequenceStepEditor from './SequenceStepEditor.js';
import { emptyStepForm } from '../../lib/sequenceHelpers.js';
import * as sequencesApi from '../../lib/services/sequences.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';

export default function SequenceBuilder({
  sequenceId,
  steps: initialSteps = [],
  sequenceTimezone = 'UTC',
  readOnly = false,
  onStepsChange,
}) {
  const { showToast } = useToast();
  const [steps, setSteps] = useState(initialSteps);
  const [savingId, setSavingId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);

  useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  const syncSteps = (next) => {
    setSteps(next);
    onStepsChange?.(next);
  };

  const addStep = () => {
    syncSteps([...steps, emptyStepForm(steps.length + 1, sequenceTimezone)]);
  };

  const updateStep = (index, step) => {
    syncSteps(steps.map((s, i) => (i === index ? step : s)));
  };

  const persistStepOrders = async (ordered) => {
    const withIds = ordered.filter((s) => s.id);
    if (!sequenceId || withIds.length < 2) return;
    await Promise.allSettled(
      withIds.map((step, index) => sequencesApi.updateSequenceStep(
        sequenceId,
        step.id,
        { step_order: index + 1 },
        { sequenceTimezone },
      )),
    );
  };

  const moveStep = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    const ordered = next.map((s, i) => ({ ...s, step_order: i + 1 }));
    syncSteps(ordered);
    try {
      await persistStepOrders(ordered);
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const duplicateStep = (index) => {
    const copy = { ...steps[index], id: undefined, step_order: steps.length + 1 };
    syncSteps([...steps, copy]);
  };

  const removeStep = async (index) => {
    const step = steps[index];
    if (step?.id && sequenceId) {
      try {
        await sequencesApi.deleteSequenceStep(sequenceId, step.id);
      } catch (err) {
        showToast(getApiError(err));
        return;
      }
    }
    const ordered = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 }));
    syncSteps(ordered);
    try {
      await persistStepOrders(ordered);
    } catch {
      // best-effort order sync
    }
  };

  const saveStep = async (index, { quiet = false } = {}) => {
    if (!sequenceId) return null;
    const step = {
      ...steps[index],
      step_order: index + 1,
      timezone: steps[index].timezone || sequenceTimezone,
    };
    if (!step.scheduled_date || !step.scheduled_time) {
      if (!quiet) showToast('Each step needs a scheduled date and time');
      throw new Error('Missing schedule');
    }
    setSavingId(step.id || `new-${index}`);
    try {
      const saveOptions = { sequenceTimezone };
      const saved = step.id
        ? await sequencesApi.updateSequenceStep(sequenceId, step.id, step, saveOptions)
        : await sequencesApi.createSequenceStep(sequenceId, step, saveOptions);
      return { ...step, ...saved };
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveStep = async (index) => {
    try {
      const saved = await saveStep(index);
      if (!saved) return;
      const next = steps.map((s, i) => (i === index ? saved : s));
      syncSteps(next);
      showToast('Step saved', 'success');
    } catch (err) {
      if (err?.message !== 'Missing schedule') showToast(getApiError(err));
    }
  };

  const saveAllSteps = async () => {
    if (!sequenceId || !steps.length) return;
    setSavingAll(true);
    try {
      let next = [...steps];
      for (let i = 0; i < next.length; i += 1) {
        const saved = await saveStep(i, { quiet: false });
        next = next.map((s, idx) => (idx === i ? saved : s));
        syncSteps(next);
      }
      showToast(`Saved ${next.length} step(s)`, 'success');
    } catch (err) {
      if (err?.message !== 'Missing schedule') showToast(getApiError(err));
    } finally {
      setSavingAll(false);
    }
  };

  const unsavedCount = steps.filter((s) => !s.id).length;

  return (
    <div className="space-y-6">
      {steps.length === 0 && (
        <p className="text-sm text-zoho-muted py-8 text-center border border-dashed border-zoho-border rounded-xl">
          No steps yet. Add your first touchpoint with an exact date and time.
        </p>
      )}

      {!readOnly && sequenceId && steps.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zoho-border bg-gray-50 px-3 py-2">
          <p className="text-xs text-zoho-muted">
            {unsavedCount
              ? `${unsavedCount} unsaved step(s) will not run until saved.`
              : 'All steps are saved. Reorder is synced to the server.'}
          </p>
          <button
            type="button"
            onClick={saveAllSteps}
            disabled={savingAll || !!savingId}
            className="btn-primary-sm"
          >
            {savingAll ? 'Saving…' : 'Save all steps'}
          </button>
        </div>
      )}

      {steps.map((step, index) => (
        <div key={step.id || `draft-${index}`} className="space-y-3">
          <SequenceStepEditor
            step={step}
            stepIndex={index + 1}
            sequenceId={sequenceId}
            sequenceTimezone={sequenceTimezone}
            readOnly={readOnly}
            onChange={(next) => updateStep(index, next)}
            onDelete={readOnly ? null : () => removeStep(index)}
            onDuplicate={readOnly ? null : () => duplicateStep(index)}
            onMoveUp={readOnly || index === 0 ? null : () => moveStep(index, -1)}
            onMoveDown={readOnly || index === steps.length - 1 ? null : () => moveStep(index, 1)}
          />
          {!readOnly && sequenceId && (
            <div className="flex justify-end">
              <button type="button" onClick={() => handleSaveStep(index)} disabled={savingId === (step.id || `new-${index}`) || savingAll} className="btn-secondary-sm">
                {savingId === (step.id || `new-${index}`) ? 'Saving…' : 'Save Step'}
              </button>
            </div>
          )}
        </div>
      ))}

      {!readOnly && (
        <button type="button" onClick={addStep} className="btn-secondary w-full">
          + Add Step
        </button>
      )}
    </div>
  );
}
