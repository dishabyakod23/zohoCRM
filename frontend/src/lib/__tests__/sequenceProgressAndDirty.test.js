import {
  enrollmentProgressByStep,
  sequenceStepEditSignature,
  isSequenceSettingsDirty,
  dailySendLimitError,
  isDailySendLimitOverMax,
  canRemoveEnrollment,
  canMarkEnrollmentReplied,
} from '../sequenceHelpers.js';

describe('enrollmentProgressByStep', () => {
  it('aggregates active/paused enrollments by current step and picks earliest active step', () => {
    const progress = enrollmentProgressByStep([
      { status: 'ACTIVE', current_step_order: 2 },
      { status: 'ACTIVE', current_step_order: 2 },
      { status: 'PAUSED', current_step_order: 1 },
      { status: 'COMPLETED', current_step_order: 3 },
      { status: 'ACTIVE', current_step_order: 3 },
    ]);

    expect(progress.activeTotal).toBe(3);
    expect(progress.currentStepOrder).toBe(2);
    expect(progress.byStep.get(1)).toEqual({ active: 0, paused: 1, total: 1 });
    expect(progress.byStep.get(2)).toEqual({ active: 2, paused: 0, total: 2 });
    expect(progress.byStep.get(3)).toEqual({ active: 1, paused: 0, total: 1 });
  });
});

describe('sequenceStepEditSignature / settings dirty', () => {
  it('detects step field edits', () => {
    const a = sequenceStepEditSignature({ type: 'AUTO_EMAIL', subject: 'Hi', scheduled_time: '10:00:00' });
    const b = sequenceStepEditSignature({ type: 'AUTO_EMAIL', subject: 'Hi', scheduled_time: '10:00' });
    const c = sequenceStepEditSignature({ type: 'AUTO_EMAIL', subject: 'Hello', scheduled_time: '10:00' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('detects settings dirty state', () => {
    const sequence = {
      name: 'Seq',
      description: '',
      sending_email: 'a@b.com',
      timezone: 'UTC',
      send_window_start: '09:00:00',
      send_window_end: '18:00:00',
      send_days: 62,
      daily_send_limit: 100,
      hourly_send_limit: '',
      use_contact_timezone: false,
      stop_on_reply: true,
      stop_on_click: false,
      owner_id: 'u1',
    };
    expect(isSequenceSettingsDirty({
      ...sequence,
      send_window_start: '09:00',
      send_window_end: '18:00',
    }, sequence)).toBe(false);
    expect(isSequenceSettingsDirty({
      ...sequence,
      send_window_start: '09:00',
      send_window_end: '18:00',
      name: 'Renamed',
    }, sequence)).toBe(true);
  });
});

describe('daily send limit', () => {
  it('errors immediately when the value is above 50', () => {
    expect(dailySendLimitError(50)).toBeNull();
    expect(dailySendLimitError(51)).toBe('the max limit is 50');
    expect(isDailySendLimitOverMax(100)).toBe(true);
    expect(isDailySendLimitOverMax(50)).toBe(false);
  });
});

describe('enrollment remove/replied actions', () => {
  it('allows removing paused, active, and failed enrollments', () => {
    expect(canRemoveEnrollment('PAUSED')).toBe(true);
    expect(canRemoveEnrollment('active')).toBe(true);
    expect(canRemoveEnrollment('FAILED')).toBe(true);
  });

  it('does not offer remove for completed or already removed enrollments', () => {
    expect(canRemoveEnrollment('COMPLETED')).toBe(false);
    expect(canRemoveEnrollment('REMOVED')).toBe(false);
    expect(canRemoveEnrollment('')).toBe(false);
  });

  it('allows mark replied on paused enrollments, not only active', () => {
    expect(canMarkEnrollmentReplied('PAUSED')).toBe(true);
    expect(canMarkEnrollmentReplied('ACTIVE')).toBe(true);
    expect(canMarkEnrollmentReplied('COMPLETED')).toBe(false);
  });
});
