import {
  microsoftMailboxesFromStatus,
  sendableMicrosoftEmails,
  normalizeMicrosoftStatus,
} from '../services/microsoft.js';

describe('microsoftMailboxesFromStatus', () => {
  it('uses mailboxes when the API sends the full list', () => {
    const rows = microsoftMailboxesFromStatus({
      microsoft_email: 'cal@example.com',
      mailboxes: [
        { email: 'cal@example.com', is_calendar: true, can_send: true },
        { email: 'mail@example.com', is_calendar: false, can_send: true },
      ],
    });
    expect(rows.map((r) => r.email)).toEqual(['cal@example.com', 'mail@example.com']);
    expect(rows[0].is_calendar).toBe(true);
  });

  it('falls back to microsoft_email when mailboxes is missing', () => {
    const rows = microsoftMailboxesFromStatus({
      connected: true,
      microsoft_email: 'narayana@origami.dev',
    });
    expect(rows).toEqual([
      expect.objectContaining({
        email: 'narayana@origami.dev',
        is_calendar: true,
        can_send: true,
      }),
    ]);
  });

  it('returns sendable emails only', () => {
    expect(sendableMicrosoftEmails({
      mailboxes: [
        { email: 'ok@example.com', can_send: true },
        { email: 'blocked@example.com', can_send: false },
      ],
    })).toEqual(['ok@example.com']);
  });
});

describe('normalizeMicrosoftStatus', () => {
  it('always exposes a mailboxes array', () => {
    const status = normalizeMicrosoftStatus({
      configured: true,
      connected: true,
      microsoft_email: 'a@b.com',
    });
    expect(status.mailboxes).toHaveLength(1);
    expect(status.mailboxes[0].email).toBe('a@b.com');
  });
});
