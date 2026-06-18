'use client';

export function FilterField({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}

export function TextFilter({ label, value, onChange, placeholder, className = 'w-40' }) {
  return (
    <FilterField label={label}>
      <input
        className={`input text-xs ${className}`}
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
  className = 'w-40',
}) {
  return (
    <FilterField label={label}>
      <select className={`input text-xs ${className}`} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{emptyLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </FilterField>
  );
}

export function DateFilter({ label, value, onChange, className = 'w-36' }) {
  return (
    <FilterField label={label}>
      <input
        type="date"
        className={`input text-xs ${className}`}
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
