'use client';
import { createContext, useContext, useMemo } from 'react';
import CampaignCombobox from '../forms/CampaignCombobox.js';
import { resolveCampaignId } from '../../lib/campaignRecordHelpers.js';
import { useAuth } from '../../hooks/useAuth.js';
import { userDisplayName } from '../../lib/userHelpers.js';

const FilterLayoutContext = createContext('inline');

export function FilterLayoutProvider({ variant, children }) {
  return (
    <FilterLayoutContext.Provider value={variant}>
      {children}
    </FilterLayoutContext.Provider>
  );
}

function useFilterLayout() {
  return useContext(FilterLayoutContext);
}

/** Local calendar date as YYYY-MM-DD for <input type="date" max/min>. */
export function todayDateInputValue(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function FilterField({ label, children, className = '' }) {
  const layout = useFilterLayout();
  const isSidebar = layout === 'sidebar';

  return (
    <div className={`${isSidebar ? 'mb-3 last:mb-0' : ''} ${className}`}>
      <label className={isSidebar ? 'text-xs font-medium text-zoho-text block mb-1' : 'text-xs text-gray-500 block mb-1'}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function TextFilter({ label, value, onChange, placeholder, className = '' }) {
  const layout = useFilterLayout();
  const widthClass = layout === 'sidebar' ? 'w-full' : (className || 'w-40');

  return (
    <FilterField label={label}>
      <input
        className={`input text-xs ${widthClass}`}
        value={value || ''}
        placeholder={placeholder || `Filter ${label.toLowerCase()}…`}
        onChange={(e) => onChange(e.target.value)}
      />
    </FilterField>
  );
}

export function SelectFilter({
  label,
  value,
  onChange,
  options = [],
  emptyLabel = 'All',
  className = '',
}) {
  const layout = useFilterLayout();
  const widthClass = layout === 'sidebar' ? 'w-full' : (className || 'w-40');

  return (
    <FilterField label={label}>
      <select className={`input text-xs ${widthClass}`} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{emptyLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </FilterField>
  );
}

export function DateFilter({
  label,
  value,
  onChange,
  className = '',
  max,
  min,
  allowFuture = false,
}) {
  const layout = useFilterLayout();
  const widthClass = layout === 'sidebar' ? 'w-full' : (className || 'w-36');
  const maxDate = max ?? (allowFuture ? undefined : todayDateInputValue());

  return (
    <FilterField label={label}>
      <input
        type="date"
        className={`input text-xs ${widthClass}`}
        value={value || ''}
        min={min || undefined}
        max={maxDate || undefined}
        onChange={(e) => {
          let next = e.target.value;
          if (maxDate && next && next > maxDate) next = maxDate;
          if (min && next && next < min) next = min;
          onChange(next);
        }}
      />
    </FilterField>
  );
}

export function CreatedUpdatedDateFilters({ filters, onChange }) {
  const today = todayDateInputValue();
  return (
    <>
      <DateFilter label="Created from" value={filters.created_from} max={today} onChange={(v) => onChange('created_from', v)} />
      <DateFilter label="Created to" value={filters.created_to} max={today} onChange={(v) => onChange('created_to', v)} />
      <DateFilter label="Updated from" value={filters.updated_from} max={today} onChange={(v) => onChange('updated_from', v)} />
      <DateFilter label="Updated to" value={filters.updated_to} max={today} onChange={(v) => onChange('updated_to', v)} />
    </>
  );
}
CreatedUpdatedDateFilters.filterLabel = 'Created from Created to Updated from Updated to';

export function OwnerFilter({ users = [], value, onChange, label = 'Owner' }) {
  const { user } = useAuth();
  const options = useMemo(() => {
    const byId = new Map();
    users.forEach((u) => {
      const id = String(u.id || u.value || '');
      if (!id) return;
      byId.set(id, u.name || u.label || id);
    });
    if (user?.id) {
      const currentId = String(user.id);
      if (!byId.has(currentId)) {
        byId.set(currentId, userDisplayName(user));
      }
    }
    return Array.from(byId.entries()).map(([optionValue, optionLabel]) => ({
      value: optionValue,
      label: optionLabel,
    }));
  }, [users, user]);

  return (
    <SelectFilter
      label={label}
      value={value ? String(value) : ''}
      onChange={onChange}
      options={options}
      emptyLabel="All owners"
    />
  );
}
OwnerFilter.filterLabel = 'Owner';

export function CampaignFilter({ campaigns = [], value, onChange, loading = false, label = 'Campaign' }) {
  const layout = useFilterLayout();
  const widthClass = layout === 'sidebar' ? 'w-full' : 'w-48';
  const selected = campaigns.find((c) => String(c.value) === String(value));

  return (
    <FilterField label={label}>
      <div className={widthClass}>
        <CampaignCombobox
          options={campaigns}
          valueId={value || ''}
          valueLabel={selected?.label || ''}
          onChange={({ campaign_id, campaign_name }) => {
            const id = campaign_id || resolveCampaignId(campaign_name, campaigns) || '';
            onChange(id);
          }}
          disabled={loading && !campaigns.length}
          placeholder={loading ? 'Loading…' : 'Search or type campaign'}
        />
      </div>
    </FilterField>
  );
}
CampaignFilter.filterLabel = 'Campaign';

