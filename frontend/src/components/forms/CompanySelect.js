'use client';
import FormField from './FormField.js';
import AccountNameCombobox from './AccountNameCombobox.js';
import { useCompanyLookups } from '../../hooks/useCompanyLookups.js';

/**
 * Searchable Company field for lead forms (stores company name string).
 * Mirrors CampaignSelect UX: pick existing or type a new name.
 */
export default function CompanySelect({
  value = '',
  onChange,
  label = 'Company',
  name = 'company',
  placeholder = 'Search or type company name',
  required = false,
  error,
}) {
  const { companies, loading } = useCompanyLookups();

  return (
    <FormField label={label} name={name} required={required} error={error}>
      <AccountNameCombobox
        id={name}
        options={companies}
        valueId=""
        valueLabel={value || ''}
        placeholder={loading && !companies.length ? 'Loading companies…' : placeholder}
        error={error}
        disabled={loading && !companies.length}
        onChange={({ account_name }) => onChange?.(account_name || '')}
      />
    </FormField>
  );
}
