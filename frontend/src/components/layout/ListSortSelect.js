'use client';
import { LIST_SORT_OPTIONS, DEFAULT_LIST_SORT } from '../../lib/listSortHelpers.js';

export default function ListSortSelect({ value, onChange, className = 'input w-44 text-xs' }) {
  if (!onChange) return null;
  return (
    <select
      className={className}
      value={value || DEFAULT_LIST_SORT}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Sort records"
    >
      {LIST_SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}
