import {
  getUnsafeSequenceEmailReason,
  canEditSequenceSteps,
} from '../sequenceHelpers.js';

describe('sequence live-send safeguards', () => {
  it('locks step edits while ACTIVE', () => {
    expect(canEditSequenceSteps('ACTIVE')).toBe(false);
    expect(canEditSequenceSteps('DRAFT')).toBe(true);
    expect(canEditSequenceSteps('PAUSED')).toBe(true);
  });

  it('flags probe subjects and filler bodies', () => {
    expect(getUnsafeSequenceEmailReason({
      subject: 'Test (patch probe)',
      html_body: '<p>Hello</p>',
    })).toMatch(/diagnostic/i);

    expect(getUnsafeSequenceEmailReason({
      subject: 'Real subject',
      html_body: `<p>${'x'.repeat(200)}</p>`,
    })).toMatch(/filler|probe/i);

    expect(getUnsafeSequenceEmailReason({
      subject: 'Quick intro',
      html_body: '<p>Hi {{first_name}}, looking forward to connecting.</p>',
    })).toBeNull();
  });
});
