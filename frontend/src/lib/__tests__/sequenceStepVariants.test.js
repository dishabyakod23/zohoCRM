import { normalizeStepFromApi, emptyStepForm } from '../sequenceHelpers.js';
import { toStepPayload } from '../services/sequences.js';

describe('sequence step variants payload', () => {
  it('does not send variants for AUTO_EMAIL even when API returned empty A/B shells', () => {
    const step = normalizeStepFromApi({
      id: 's1',
      type: 'AUTO_EMAIL',
      scheduled_date: '2026-09-12',
      scheduled_time: '10:00:00',
      timezone: 'Asia/Kolkata',
      subject: 'Hello',
      html_body: '<p>Hi</p>',
      text_body: 'Hi',
      active: true,
      variants: [
        { variant_key: 'A', subject: null, html_body: null },
        { variant_key: 'B', subject: null, html_body: null },
      ],
    });

    expect(step.variants).toEqual([]);
    const payload = toStepPayload(step, { partial: true, sequenceTimezone: 'Asia/Kolkata' });
    expect(payload.variants).toBeUndefined();
    expect(payload.type).toBe('AUTO_EMAIL');
  });

  it('includes variants only for AB_EMAIL', () => {
    const step = normalizeStepFromApi({
      type: 'AB_EMAIL',
      scheduled_date: '2026-09-12',
      scheduled_time: '10:00',
      timezone: 'UTC',
      variants: [
        { variant_key: 'A', subject: 'A', html_body: '<p>A</p>' },
        { variant_key: 'B', subject: 'B', html_body: '<p>B</p>' },
      ],
    });
    const payload = toStepPayload(step, { partial: true, sequenceTimezone: 'UTC' });
    expect(payload.variants).toHaveLength(2);
    expect(payload.variants[0].variant_key).toBe('A');
  });

  it('starts new steps without variant shells', () => {
    expect(emptyStepForm(1).variants).toEqual([]);
  });
});
