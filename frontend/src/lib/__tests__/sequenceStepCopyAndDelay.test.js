import {
  copySequenceSteps,
  resolveRelativeStepSchedules,
  emptyStepForm,
  inferCopiedStepSchedule,
  SCHEDULE_MODE_AFTER_PREVIOUS,
  SCHEDULE_MODE_DATE,
  formatStepSchedule,
} from '../sequenceHelpers.js';
import { toStepPayload } from '../services/sequences.js';

const sourceSteps = [
  {
    id: 's1',
    sequence_id: 'seq-1',
    type: 'AUTO_EMAIL',
    step_order: 1,
    scheduled_date: '2026-10-14',
    scheduled_time: '10:00',
    timezone: 'UTC',
    subject: 'Intro',
    html_body: '<p>Hello</p>',
    active: true,
  },
  {
    id: 's2',
    type: 'AUTO_EMAIL',
    step_order: 2,
    scheduled_date: '2026-10-15',
    scheduled_time: '10:00',
    timezone: 'UTC',
    subject: 'Follow up 1',
    html_body: '<p>Day 2</p>',
    active: true,
  },
  {
    id: 's3',
    type: 'AUTO_EMAIL',
    step_order: 3,
    scheduled_date: '2026-10-16',
    scheduled_time: '10:00',
    timezone: 'UTC',
    subject: 'Follow up 2',
    html_body: '<p>Day 3</p>',
    active: true,
  },
  {
    id: 's4',
    type: 'CALL',
    step_order: 4,
    scheduled_date: '2026-10-17',
    scheduled_time: '10:00',
    timezone: 'UTC',
    task_title: 'Call',
    active: true,
  },
];

describe('copySequenceSteps', () => {
  it('copies content and 1-day gaps but not Step 1’s date', () => {
    const copied = copySequenceSteps(sourceSteps);
    expect(copied).toHaveLength(4);
    expect(copied[0].id).toBeUndefined();
    expect(copied[0].scheduled_date).toBe('');
    expect(copied[0].subject).toBe('Intro');
    expect(copied[1].subject).toBe('Follow up 1');
    expect(copied[1].schedule_mode).toBe(SCHEDULE_MODE_AFTER_PREVIOUS);
    expect(copied[1].wait_days).toBe(1);
    expect(copied[1].scheduled_date).toBe('');
    expect(copied[2].wait_days).toBe(1);
    expect(copied[3].wait_days).toBe(1);
    expect(copied[3].task_title).toBe('Call');
  });

  it('recalculates delay dates after the destination Step 1 date is set', () => {
    const copied = copySequenceSteps(sourceSteps);
    copied[0] = { ...copied[0], scheduled_date: '2026-11-01' };
    const resolved = resolveRelativeStepSchedules(copied);
    expect(resolved[0].scheduled_date).toBe('2026-11-01');
    expect(resolved[1].scheduled_date).toBe('2026-11-02');
    expect(resolved[2].scheduled_date).toBe('2026-11-03');
    expect(resolved[3].scheduled_date).toBe('2026-11-04');
  });

  it('keeps an explicit calendar date on later steps', () => {
    const copied = copySequenceSteps([
      sourceSteps[0],
      {
        ...sourceSteps[1],
        schedule_mode: SCHEDULE_MODE_DATE,
        scheduled_date: '2026-12-25',
      },
    ]);
    expect(copied[0].scheduled_date).toBe('');
    expect(copied[1].schedule_mode).toBe(SCHEDULE_MODE_DATE);
    expect(copied[1].scheduled_date).toBe('2026-12-25');
  });
});

describe('relative step schedules', () => {
  it('defaults new steps after Step 1 to one day after the previous step', () => {
    const first = emptyStepForm(1, 'UTC');
    first.scheduled_date = '2026-10-14';
    const second = emptyStepForm(2, 'UTC');
    const resolved = resolveRelativeStepSchedules([first, second]);
    expect(resolved[1].schedule_mode).toBe(SCHEDULE_MODE_AFTER_PREVIOUS);
    expect(resolved[1].wait_days).toBe(1);
    expect(resolved[1].scheduled_date).toBe('2026-10-15');
  });

  it('infers a copied delay from the source calendar gap', () => {
    const inferred = inferCopiedStepSchedule(sourceSteps[1], sourceSteps[0], 1);
    expect(inferred).toEqual({ schedule_mode: SCHEDULE_MODE_AFTER_PREVIOUS, wait_days: 1 });
  });

  it('labels delay steps as days after the previous step', () => {
    const label = formatStepSchedule({
      step_order: 2,
      schedule_mode: SCHEDULE_MODE_AFTER_PREVIOUS,
      wait_days: 1,
      scheduled_date: '2026-10-15',
      scheduled_time: '10:00',
      timezone: 'UTC',
    });
    expect(label).toMatch(/1 day after previous/);
  });
});

describe('toStepPayload wait fields', () => {
  it('sends wait_value for delay steps and not for a first-step date', () => {
    const delay = toStepPayload({
      step_order: 2,
      type: 'AUTO_EMAIL',
      schedule_mode: SCHEDULE_MODE_AFTER_PREVIOUS,
      wait_days: 1,
      scheduled_date: '2026-10-15',
      scheduled_time: '10:00',
      timezone: 'UTC',
      subject: 'Hi',
      html_body: '<p>Hi</p>',
      active: true,
    });
    expect(delay.wait_value).toBe(1);
    expect(delay.wait_unit).toBe('days');

    const first = toStepPayload({
      step_order: 1,
      type: 'AUTO_EMAIL',
      schedule_mode: SCHEDULE_MODE_DATE,
      scheduled_date: '2026-10-14',
      scheduled_time: '10:00',
      timezone: 'UTC',
      subject: 'Hi',
      html_body: '<p>Hi</p>',
      active: true,
    });
    expect(first.wait_value).toBeUndefined();
    expect(first.variants).toBeUndefined();
  });
});
