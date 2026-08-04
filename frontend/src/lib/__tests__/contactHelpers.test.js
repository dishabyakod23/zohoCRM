import { normalizeContact, toContactPayload, buildBulkImportContactRecord } from '../contactHelpers.js';

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

  it('omits account_id from bulk import payloads and uses company_id', () => {
    const payload = buildBulkImportContactRecord(
      {
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        account_id: 'not-a-valid-uuid',
        account_name: 'Acme Corp',
      },
      { companyId: '550e8400-e29b-41d4-a716-446655440000', companyName: 'Acme Corp' },
    );
    expect(payload.company_id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(payload.company_name).toBe('Acme Corp');
    expect(payload.account_id).toBeUndefined();
  });
});
