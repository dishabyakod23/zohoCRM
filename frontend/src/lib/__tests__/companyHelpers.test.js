import {
  ACCOUNT_MODULE_TOKEN,
  COMPANY_MODULE_TOKEN,
  detectRecordModule,
  isAccountModuleRecord,
  isCompanyModuleRecord,
  stripModuleToken,
  withModuleToken,
} from '../companyHelpers.js';

describe('account/company module membership', () => {
  it('stamps and strips hidden module tokens without changing visible description', () => {
    expect(withModuleToken('Hello', 'account')).toContain(ACCOUNT_MODULE_TOKEN);
    expect(withModuleToken('Hello', 'company')).toContain(COMPANY_MODULE_TOKEN);
    expect(stripModuleToken(`Hello\n\n${ACCOUNT_MODULE_TOKEN}`)).toBe('Hello');
    expect(detectRecordModule({ description: withModuleToken('x', 'account') })).toBe('account');
    expect(detectRecordModule({ description: withModuleToken('x', 'company') })).toBe('company');
  });

  it('keeps account-module rows in Accounts even when account_type is Prospect', () => {
    const record = {
      id: 'a1',
      account_type: 'Prospect',
      description: withModuleToken('', 'account'),
    };
    expect(isAccountModuleRecord(record)).toBe(true);
    expect(isCompanyModuleRecord(record)).toBe(false);
  });

  it('keeps company-module rows in Companies even when account_type is Customer', () => {
    const record = {
      id: 'c1',
      account_type: 'Customer',
      description: withModuleToken('', 'company'),
    };
    expect(isAccountModuleRecord(record)).toBe(false);
    expect(isCompanyModuleRecord(record)).toBe(true);
  });

  it('falls back to Customer/deal heuristic when no module token exists', () => {
    expect(isAccountModuleRecord({ id: '1', account_type: 'Customer' })).toBe(true);
    expect(isAccountModuleRecord({ id: '2', account_type: 'Prospect' })).toBe(false);
    expect(isAccountModuleRecord(
      { id: '3', account_type: 'Prospect' },
      { dealAccountIds: new Set(['3']) },
    )).toBe(true);
  });
});
