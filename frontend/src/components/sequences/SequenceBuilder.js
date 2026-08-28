'use client';
import { useState } from 'react';
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

  const moveStep = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    syncSteps(next.map((s, i) => ({ ...s, step_order: i + 1 })));
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
    syncSteps(steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 })));
  };

  const saveStep = async (index) => {
    if (!sequenceId) return;
    const step = { ...steps[index], step_order: index + 1 };
    if (!step.scheduled_date || !step.scheduled_time) {
      showToast('Each step needs a scheduled date and time');
      return;
    }
    setSavingId(step.id || `new-${index}`);
    try {
      const saved = step.id
        ? await sequencesApi.updateSequenceStep(sequenceId, step.id, step)
        : await sequencesApi.createSequenceStep(sequenceId, step);
      const next = steps.map((s, i) => (i === index ? { ...step, ...saved } : s));
      syncSteps(next);
      showToast('Step saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {steps.length === 0 && (
        <p className="text-sm text-zoho-muted py-8 text-center border border-dashed border-zoho-border rounded-xl">
          No steps yet. Add your first touchpoint with an exact date and time.
        </p>
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
              <button type="button" onClick={() => saveStep(index)} disabled={savingId === (step.id || `new-${index}`)} className="btn-secondary-sm">
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
