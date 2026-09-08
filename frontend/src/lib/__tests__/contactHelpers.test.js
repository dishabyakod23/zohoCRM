import {
  normalizeContact,
  toContactPayload,
  normalizeBulkUploadContactRecords,
  enrichContactReadyRecordsFromCsv,
  resolveContactLinkedInUrl,
} from '../contactHelpers.js';

describe('contactHelpers company linkage', () => {
  it('maps company_id to display name from company lookups', () => {
    const contact = normalizeContact(
      { id: 'c1', company_id: 'co1', email: 'a@example.com' },
      { co1: { label: 'Acme Corp' } },
    );
    expect(contact.company_name).toBe('Acme Corp');
    expect(contact.account_name).toBe('Acme Corp');
  });

  it('sends company_id instead of account_id when creating a contact', () => {
    const payload = toContactPayload({
      first_name: 'Ada',
      last_name: 'Lovelace',
      account_id: 'co1',
      account_name: 'Acme Corp',
      email: 'ada@example.com',
    });
    expect(payload.company_id).toBe('co1');
    expect(payload.company_name).toBe('Acme Corp');
    expect(payload.account_id).toBeNull();
  });

  it('clears account_id when patching company fields', () => {
    const payload = toContactPayload(
      { account_id: 'co1', account_name: 'Acme Corp' },
      { partial: true },
    );
    expect(payload.company_id).toBe('co1');
    expect(payload.company_name).toBe('Acme Corp');
    expect(payload.account_id).toBeNull();
  });

  it('includes LinkedIn request fields on partial contact PATCH', () => {
    const payload = toContactPayload(
      {
        linkedin_request_sent: true,
        linkedin_request_sent_at: '2026-09-08T10:00:00.000Z',
        linkedin_request_sent_by: 'u1',
      },
      { partial: true },
    );
    expect(payload.linkedin_request_sent).toBe(true);
    expect(payload.linkedin_request_sent_at).toBe('2026-09-08T10:00:00.000Z');
    expect(payload.linkedin_request_sent_by).toBe('u1');

    const cleared = toContactPayload(
      {
        linkedin_request_sent: false,
        linkedin_request_sent_at: null,
        linkedin_request_sent_by: null,
      },
      { partial: true },
    );
    expect(cleared.linkedin_request_sent).toBe(false);
    expect(cleared.linkedin_request_sent_at).toBeNull();
    expect(cleared.linkedin_request_sent_by).toBeNull();
  });

  it('preserves account_id from bulk-upload for bulk-import', () => {
    const [payload] = normalizeBulkUploadContactRecords([
      {
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        account_id: '550e8400-e29b-41d4-a716-446655440000',
        account_name: 'Acme Corp',
      },
    ]);
    expect(payload.account_id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(payload.account_name).toBe('Acme Corp');
    expect(payload.first_name).toBe('Ada');
  });

  it('uses company_id as account_id when bulk-upload only returns company_id', () => {
    const [payload] = normalizeBulkUploadContactRecords([
      {
        first_name: 'Ada',
        email: 'ada@example.com',
        company_id: '550e8400-e29b-41d4-a716-446655440001',
      },
    ]);
    expect(payload.account_id).toBe('550e8400-e29b-41d4-a716-446655440001');
  });
});

describe('contact LinkedIn / skype_id import', () => {
  it('resolves LinkedIn URL from common aliases', () => {
    expect(resolveContactLinkedInUrl({ linkedin_url: 'https://linkedin.com/in/a' }))
      .toBe('https://linkedin.com/in/a');
    expect(resolveContactLinkedInUrl({ skype_id: 'https://linkedin.com/in/b' }))
      .toBe('https://linkedin.com/in/b');
  });

  it('maps linkedin alias onto skype_id for bulk-import', () => {
    const [payload] = normalizeBulkUploadContactRecords([
      { email: 'a@example.com', linkedin: 'https://linkedin.com/in/ada' },
    ]);
    expect(payload.skype_id).toBe('https://linkedin.com/in/ada');
  });

  it('rehydrates skype_id from CSV when bulk-upload dropped LinkedIn', () => {
    const ready = [{
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      account_id: '550e8400-e29b-41d4-a716-446655440000',
      account_name: 'Acme',
    }];
    const csv = [
      'first_name,last_name,email,account_name,LinkedIn URL',
      'Ada,Lovelace,ada@example.com,Acme,https://www.linkedin.com/in/ada-lovelace',
    ].join('\n');

    const [enriched] = normalizeBulkUploadContactRecords(
      enrichContactReadyRecordsFromCsv(ready, csv),
    );
    expect(enriched.skype_id).toBe('https://www.linkedin.com/in/ada-lovelace');
  });

  it('exposes LinkedIn aliases on normalizeContact for detail pages', () => {
    const contact = normalizeContact({
      id: 'c1',
      linkedin_url: 'https://linkedin.com/in/shown',
    });
    expect(contact.skype_id).toBe('https://linkedin.com/in/shown');
  });
});
