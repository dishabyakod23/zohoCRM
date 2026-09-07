import {
  formatBounceTypeLabel,
  formatBounceSubtypeLabel,
  resolveBounceReasonText,
  bounceReasonHint,
} from '../sequenceHelpers.js';

describe('bounce reason helpers', () => {
  it('formats bounce types for badges', () => {
    expect(formatBounceTypeLabel('permanent')).toBe('Permanent');
    expect(formatBounceTypeLabel('Transient')).toBe('Transient');
    expect(formatBounceTypeLabel('hard')).toBe('Permanent');
    expect(formatBounceTypeLabel(null)).toBeNull();
  });

  it('formats subtypes for display', () => {
    expect(formatBounceSubtypeLabel('NoEmail')).toBe('No Email');
    expect(formatBounceSubtypeLabel('MailboxFull')).toBe('Mailbox Full');
    expect(formatBounceSubtypeLabel('Suppressed')).toBe('Suppressed');
  });

  it('prefers bounce_reason and falls back to event_metadata', () => {
    expect(resolveBounceReasonText({ bounce_reason: 'Recipient not found' }))
      .toBe('Recipient not found');
    expect(resolveBounceReasonText({
      event_metadata: { bounce: { reason: 'Mailbox full' } },
    })).toBe('Mailbox full');
    expect(resolveBounceReasonText({})).toBeNull();
  });

  it('returns operator hints from type/subtype/reason', () => {
    expect(bounceReasonHint({
      bounce_type: 'Permanent',
      bounce_reason: 'Recipient not found',
    })).toMatch(/invalid email/i);
    expect(bounceReasonHint({
      bounce_type: 'Transient',
      bounce_subtype: 'MailboxFull',
    })).toMatch(/temporary/i);
    expect(bounceReasonHint({
      bounce_subtype: 'Suppressed',
    })).toMatch(/blocked/i);
  });
});
