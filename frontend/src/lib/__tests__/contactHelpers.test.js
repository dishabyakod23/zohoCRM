import { normalizeContact, toContactPayload, normalizeBulkUploadContactRecords } from '../contactHelpers.js';

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
        last_name: 'Lovelace',
        email: 'ada@example.com',
        company_id: '550e8400-e29b-41d4-a716-446655440001',
      },
    ]);
    expect(payload.account_id).toBe('550e8400-e29b-41d4-a716-446655440001');
  });
});
