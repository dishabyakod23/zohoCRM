import { normalizeAccount, toAccountPayload } from '../accountHelpers.js';

describe('account address mapping', () => {
  it('maps billing_* UI fields to API street/city/state/country/zip_code on create', () => {
    const payload = toAccountPayload({
      account_name: 'Acme',
      billing_street: '12 MG Road',
      billing_city: 'Bengaluru',
      billing_state: 'Karnataka',
      billing_country: 'India',
      billing_zip: '560001',
      shipping_street: 'Ship St',
      shipping_city: 'Chennai',
      shipping_state: 'Tamil Nadu',
      shipping_country: 'India',
      shipping_zip: '600001',
    });

    expect(payload.street).toBe('12 MG Road');
    expect(payload.city).toBe('Bengaluru');
    expect(payload.state).toBe('Karnataka');
    expect(payload.country).toBe('India');
    expect(payload.zip_code).toBe('560001');
    expect(payload.shipping_street).toBe('Ship St');
    expect(payload.shipping_zip_code).toBe('600001');
    expect(payload.billing_street).toBeUndefined();
    expect(payload.billing_zip).toBeUndefined();
    expect(payload.shipping_zip).toBeUndefined();
  });

  it('includes mapped billing fields on partial address section saves', () => {
    const payload = toAccountPayload({
      billing_street: '99 Park Ave',
      billing_city: 'Mumbai',
      billing_country: 'India',
      billing_state: 'Maharashtra',
      billing_zip: '400001',
      shipping_zip: '400002',
    }, { partial: true });

    expect(payload).toEqual({
      street: '99 Park Ave',
      city: 'Mumbai',
      country: 'India',
      state: 'Maharashtra',
      zip_code: '400001',
      shipping_zip_code: '400002',
    });
  });

  it('normalizes API address fields back to billing_* for the UI', () => {
    const account = normalizeAccount({
      id: 'a1',
      account_name: 'Acme',
      street: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      zip_code: '560001',
      shipping_street: 'Ship St',
      shipping_zip_code: '600001',
    });

    expect(account.billing_street).toBe('12 MG Road');
    expect(account.billing_city).toBe('Bengaluru');
    expect(account.billing_zip).toBe('560001');
    expect(account.shipping_zip).toBe('600001');
  });
});
