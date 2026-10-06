import {
  validateExternalRecipientEmail,
  addExternalRecipientEmail,
  removeExternalRecipientEmail,
  getWeeklyRecipientEmails,
  getExternalRecipientEmails,
  buildExternalRecipientRows,
} from '../services/reports.js';

const users = [
  { id: 'u1', email: 'Admin@Origami.dev', is_active: true, role: 'super_admin' },
  { id: 'u2', email: 'bdm@origami.dev', is_active: true, role: 'sales_manager' },
  { id: 'u3', email: 'former@origami.dev', is_active: false, role: 'sales_rep' },
];

describe('weekly report external recipients', () => {
  it('normalizes and accepts a new outside email', () => {
    expect(validateExternalRecipientEmail('  CEO@Partner.com ', {}, users)).toEqual({ email: 'ceo@partner.com' });
  });

  it('rejects empty, malformed, duplicate, and CRM-user emails', () => {
    expect(validateExternalRecipientEmail('', {}, users).error).toBeTruthy();
    expect(validateExternalRecipientEmail('not-an-email', {}, users).error).toBeTruthy();
    expect(validateExternalRecipientEmail('a@b.com', { external_recipient_emails: ['A@b.com'] }, users).error)
      .toMatch(/already added/);
    expect(validateExternalRecipientEmail('admin@origami.dev', {}, users).error).toMatch(/CRM user/);
  });

  it('builds external rows, matching inactive CRM users by email', () => {
    const rows = buildExternalRecipientRows(users, {
      external_recipient_emails: ['former@origami.dev', 'ceo@partner.com'],
    });
    expect(rows).toEqual([
      { email: 'former@origami.dev', user: users[2] },
      { email: 'ceo@partner.com', user: null },
    ]);
  });

  it('caps external recipients at 20', () => {
    const full = { external_recipient_emails: Array.from({ length: 20 }, (_, i) => `p${i}@x.com`) };
    expect(validateExternalRecipientEmail('new@x.com', full, users).error).toMatch(/up to 20/);
  });

  it('accepts an inactive CRM user email as an external recipient', () => {
    expect(validateExternalRecipientEmail('Former@origami.dev', {}, users)).toEqual({ email: 'former@origami.dev' });
  });

  it('adds and removes emails without touching other settings', () => {
    const base = { enabled: true, recipient_user_ids: ['u1'] };
    const added = addExternalRecipientEmail(base, 'ceo@partner.com');
    expect(added).toEqual({ ...base, external_recipient_emails: ['ceo@partner.com'] });
    expect(getExternalRecipientEmails(removeExternalRecipientEmail(added, 'CEO@partner.com'))).toEqual([]);
  });

  it('combines selected CRM users with external emails, deduped', () => {
    const settings = {
      recipient_user_ids: ['u1'],
      external_recipient_emails: ['ceo@partner.com', 'admin@origami.dev'],
    };
    expect(getWeeklyRecipientEmails(users, settings)).toEqual(['Admin@Origami.dev', 'ceo@partner.com']);
  });

  it('treats a missing external list as empty', () => {
    expect(getExternalRecipientEmails({})).toEqual([]);
    expect(getWeeklyRecipientEmails(users, { recipient_user_ids: ['u2'] })).toEqual(['bdm@origami.dev']);
  });
});
