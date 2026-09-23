'use client';
import { useEffect, useMemo, useState } from 'react';
import SequenceStepEditor from './SequenceStepEditor.js';
import {
  emptyStepForm,
  getUnsafeSequenceEmailReason,
  isEmailStep,
  isAbEmailStep,
  htmlToPlainText,
  sequenceStepEditSignature,
} from '../../lib/sequenceHelpers.js';
import * as sequencesApi from '../../lib/services/sequences.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { validationToastMessage } from '../../lib/validators.js';

function buildBaselineMap(steps = []) {
  const map = {};
  for (const step of steps) {
    if (step?.id) map[step.id] = sequenceStepEditSignature(step);
  }
  return map;
}

export default function SequenceBuilder({
  sequenceId,
  steps: initialSteps = [],
  sequenceTimezone = 'UTC',
  sequence = null,
  readOnly = false,
  stepProgress = null,
  onStepsChange,
  onScheduleSynced,
}) {
  const { showToast } = useToast();
  const [steps, setSteps] = useState(initialSteps);
  const [baselineById, setBaselineById] = useState(() => buildBaselineMap(initialSteps));
  const [savingId, setSavingId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);

  useEffect(() => {
    setSteps(initialSteps);
    setBaselineById(buildBaselineMap(initialSteps));
  }, [initialSteps]);

  const syncSteps = (next) => {
    setSteps(next);
    onStepsChange?.(next);
  };

  const isStepDirty = (step) => {
    if (!step?.id) return true;
    return baselineById[step.id] !== sequenceStepEditSignature(step);
  };

  const dirtyIndexes = useMemo(() => steps
    .map((step, index) => {
      if (!step?.id) return index;
      if (baselineById[step.id] !== sequenceStepEditSignature(step)) return index;
      return -1;
    })
    .filter((i) => i >= 0), [steps, baselineById]);
  const dirtyCount = dirtyIndexes.length;
  const hasDirtySteps = dirtyCount > 0;

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
      setBaselineById(buildBaselineMap(ordered));
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
      setBaselineById(buildBaselineMap(ordered));
    } catch {
      setBaselineById(buildBaselineMap(ordered));
    }
  };

  const saveStep = async (index, { quiet = false } = {}) => {
    if (!sequenceId) return null;
    const step = {
      ...steps[index],
      step_order: index + 1,
      timezone: steps[index].timezone || sequenceTimezone,
    };
    const requiredErrs = {};
    if (!step.scheduled_date) requiredErrs.scheduled_date = 'Scheduled Date is required.';
    if (!step.scheduled_time) requiredErrs.scheduled_time = 'Scheduled Time is required.';
    if (isEmailStep(step.type) && !isAbEmailStep(step)) {
      if (!String(step.subject || '').trim()) requiredErrs.subject = 'Subject is required.';
      const bodyText = htmlToPlainText(step.html_body || step.text_body || '').trim();
      if (!bodyText) requiredErrs.html_body = 'Email body is required.';
    }
    if (Object.keys(requiredErrs).length) {
      if (!quiet) showToast(validationToastMessage(requiredErrs));
      throw new Error('Missing required fields');
    }
    const unsafe = getUnsafeSequenceEmailReason(step);
    if (unsafe) {
      if (!quiet) showToast(unsafe);
      throw new Error('Unsafe email content');
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

  const syncEnrollmentSchedules = async (savedSteps, { stepOrders } = {}) => {
    if (!sequenceId || !savedSteps?.length) return;
    try {
      const result = await sequencesApi.syncEnrollmentSchedulesFromSteps({
        sequenceId,
        steps: savedSteps,
        sequence: sequence || { timezone: sequenceTimezone },
        stepOrders,
      });
      if (result.updated > 0) {
        showToast(
          `Updated Next Action for ${result.updated} enrollment${result.updated === 1 ? '' : 's'}`,
          'success',
        );
      }
      onScheduleSynced?.(result);
    } catch {
      // best-effort
    }
  };

  const handleSaveStep = async (index) => {
    try {
      const previous = steps[index];
      const saved = await saveStep(index);
      if (!saved) return;
      const next = steps.map((s, i) => (i === index ? saved : s));
      syncSteps(next);
      setBaselineById((prev) => ({
        ...prev,
        [saved.id]: sequenceStepEditSignature(saved),
      }));
      showToast('Step saved', 'success');
      const scheduleChanged = previous?.scheduled_date !== saved.scheduled_date
        || previous?.scheduled_time !== saved.scheduled_time
        || previous?.timezone !== saved.timezone;
      if (scheduleChanged) {
        await syncEnrollmentSchedules(next, { stepOrders: [saved.step_order || index + 1] });
      }
    } catch (err) {
      if (err?.message !== 'Missing required fields' && err?.message !== 'Unsafe email content') {
        showToast(getApiError(err));
      }
    }
  };

  const saveAllSteps = async () => {
    if (!sequenceId || !dirtyIndexes.length) return;
    setSavingAll(true);
    try {
      const previousByOrder = new Map(
        steps.map((s, i) => [Number(s.step_order || i + 1), s]),
      );
      let next = [...steps];
      const changedOrders = [];
      for (const i of dirtyIndexes) {
        const saved = await saveStep(i, { quiet: false });
        next = next.map((s, idx) => (idx === i ? saved : s));
        syncSteps(next);
        const order = Number(saved.step_order || i + 1);
        const previous = previousByOrder.get(order);
        if (
          previous?.scheduled_date !== saved.scheduled_date
          || previous?.scheduled_time !== saved.scheduled_time
          || previous?.timezone !== saved.timezone
        ) {
          changedOrders.push(order);
        }
      }
      setBaselineById(buildBaselineMap(next));
      showToast(`Saved ${dirtyIndexes.length} step(s)`, 'success');
      if (changedOrders.length) {
        await syncEnrollmentSchedules(next, { stepOrders: changedOrders });
      }
    } catch (err) {
      if (err?.message !== 'Missing required fields' && err?.message !== 'Unsafe email content') {
        showToast(getApiError(err));
      }
    } finally {
      setSavingAll(false);
    }
  };

  const currentStepOrder = stepProgress?.currentStepOrder ?? null;
  const activeTotal = stepProgress?.activeTotal ?? 0;

  return (
    <div className="space-y-6">
      {activeTotal > 0 && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {currentStepOrder != null ? (
            <>
              Currently executing <span className="font-semibold">Step {currentStepOrder}</span>
              {' '}· {activeTotal} active enrollment{activeTotal === 1 ? '' : 's'} in progress
            </>
          ) : (
            <>{activeTotal} active enrollment{activeTotal === 1 ? '' : 's'} in this sequence</>
          )}
        </div>
      )}

      {steps.length === 0 && (
        <p className="text-sm text-zoho-muted py-8 text-center border border-dashed border-zoho-border rounded-xl">
          No steps yet. Add your first touchpoint with an exact date and time.
        </p>
      )}

      {!readOnly && sequenceId && steps.length > 0 && hasDirtySteps && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zoho-border bg-gray-50 px-3 py-2">
          <p className="text-xs text-zoho-muted">
            {dirtyCount} unsaved change{dirtyCount === 1 ? '' : 's'} — steps will not run with these edits until saved.
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

      {steps.map((step, index) => {
        const order = Number(step.step_order || index + 1);
        const progress = stepProgress?.byStep?.get(order) || null;
        const isCurrent = currentStepOrder != null && order === currentStepOrder;
        const dirty = isStepDirty(step);
        return (
          <div key={step.id || `draft-${index}`} className="space-y-3">
            <SequenceStepEditor
              step={step}
              stepIndex={index + 1}
              sequenceId={sequenceId}
              sequenceTimezone={sequenceTimezone}
              readOnly={readOnly}
              progress={progress}
              isCurrentExecuting={isCurrent}
              onChange={(next) => updateStep(index, next)}
              onDelete={readOnly ? null : () => removeStep(index)}
              onDuplicate={readOnly ? null : () => duplicateStep(index)}
              onMoveUp={readOnly || index === 0 ? null : () => moveStep(index, -1)}
              onMoveDown={readOnly || index === steps.length - 1 ? null : () => moveStep(index, 1)}
            />
            {!readOnly && sequenceId && dirty && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSaveStep(index)}
                  disabled={savingId === (step.id || `new-${index}`) || savingAll}
                  className="btn-secondary-sm"
                >
                  {savingId === (step.id || `new-${index}`) ? 'Saving…' : 'Save Step'}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <button type="button" onClick={addStep} className="btn-secondary w-full">
          + Add Step
        </button>
      )}
    </div>
  );
}
