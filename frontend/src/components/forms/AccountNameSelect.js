'use client';
import FormField from './FormField.js';
import AccountNameCombobox from './AccountNameCombobox.js';
import { useAccountLookups } from '../../hooks/useAccountLookups.js';

/**
 * Searchable Account Name field.
 * - Default: stores/returns the account name string (create forms).
 * - With `linkMode`: emits { account_id, account_name } for linking to an existing account.
 */
export default function AccountNameSelect({
  value = '',
  valueId = '',
  onChange,
  label = 'Account Name',
  name = 'account_name',
  placeholder = 'Search or type account name',
  required = false,
  error,
  linkMode = false,
}) {
  const { accounts, loading } = useAccountLookups({ includeCompanies: true });

  return (
    <FormField label={label} name={name} required={required} error={error}>
      <AccountNameCombobox
        id={name}
        options={accounts}
        valueId={linkMode ? (valueId || '') : ''}
        valueLabel={value || ''}
        placeholder={loading && !accounts.length ? 'Loading accounts…' : placeholder}
        error={error}
        disabled={loading && !accounts.length}
        entityLabel="account"
        onChange={({ account_id, account_name }) => {
          if (linkMode) onChange?.({ account_id: account_id || '', account_name: account_name || '' });
          else onChange?.(account_name || '');
        }}
      />
    </FormField>
  );
}
