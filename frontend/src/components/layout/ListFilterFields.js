'use client';
import { createContext, useContext } from 'react';

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

export function DateFilter({ label, value, onChange, className = '' }) {
  const layout = useFilterLayout();
  const widthClass = layout === 'sidebar' ? 'w-full' : (className || 'w-36');

  return (
    <FilterField label={label}>
      <input
        type="date"
        className={`input text-xs ${widthClass}`}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </FilterField>
  );
}

export function OwnerFilter({ users = [], value, onChange }) {
  return (
    <SelectFilter
      label="Owner"
      value={value}
      onChange={onChange}
      options={users.map((u) => ({
        value: u.id || u.value,
        label: u.name || u.label,
      }))}
      emptyLabel="All owners"
    />
  );
}
