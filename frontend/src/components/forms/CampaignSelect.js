'use client';
import FormField from './FormField.js';
import CampaignCombobox from './CampaignCombobox.js';
import { useCampaignLookups } from '../../hooks/useCampaignLookups.js';

export default function CampaignSelect({
  value,
  valueLabel = '',
  onChange,
  label = 'Campaign',
  name = 'campaign_id',
  placeholder = 'Search or type campaign name',
  required = false,
  error,
}) {
  const { campaigns, loading } = useCampaignLookups();

  return (
    <FormField label={label} name={name} required={required} error={error}>
      <CampaignCombobox
        id={name}
        options={campaigns}
        valueId={value || ''}
        valueLabel={valueLabel}
        onChange={onChange}
        error={error}
        disabled={loading && !campaigns.length}
        placeholder={loading && !campaigns.length ? 'Loading campaigns…' : placeholder}
      />
    </FormField>
  );
}
