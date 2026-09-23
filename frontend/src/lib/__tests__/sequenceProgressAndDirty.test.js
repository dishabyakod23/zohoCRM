import {
  enrollmentProgressByStep,
  sequenceStepEditSignature,
  isSequenceSettingsDirty,
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
