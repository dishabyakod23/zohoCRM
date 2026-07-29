'use client';
import FormField from './FormField.js';
import { useCampaignLookups } from '../../hooks/useCampaignLookups.js';

export default function CampaignSelect({
  value,
  onChange,
  label = 'Campaign',
  name = 'campaign_id',
  className = 'input',
  placeholder = '—None—',
  required = false,
  error,
}) {
  const { campaigns, loading } = useCampaignLookups();

  return (
    <FormField label={label} name={name} required={required} error={error}>
      <select
        className={className}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading && !campaigns.length}
      >
        <option value="">{loading ? 'Loading campaigns…' : placeholder}</option>
        {campaigns.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
    </FormField>
  );
}
