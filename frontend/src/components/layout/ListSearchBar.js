'use client';
import { useState } from 'react';

/** Compact search + page-size row for list pages without ListToolbar views. */
export default function ListSearchBar({
  search,
  onSearchChange,
  placeholder = 'Search…',
  limit,
  onLimitChange,
  limitOptions = [10, 15, 25, 50],
  total,
  totalLabel = 'records',
  leftActions = null,
  filterFields = null,
  hasActiveFilters = false,
  onClearFilters = null,
}) {
  const [showFilters, setShowFilters] = useState(true);

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        {leftActions}
        {filterFields && (
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`zoho-filter-btn ${showFilters || hasActiveFilters ? 'border-brand-300 text-brand-600 bg-brand-50' : ''}`}
          >
            Filter{showFilters ? ' ▲' : ' ▼'}{hasActiveFilters ? ' •' : ''}
          </button>
        )}
        {onSearchChange && (
          <input
            className="input max-w-xs text-sm"
            placeholder={placeholder}
            value={search || ''}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        )}
        {onLimitChange && (
          <select className="input w-28 text-xs" value={limit} onChange={(e) => onLimitChange(+e.target.value)}>
            {limitOptions.map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
        )}
        {total != null && (
          <span className="text-xs text-zoho-muted ml-auto">
            {total} {total === 1 ? totalLabel.replace(/s$/, '') : totalLabel}
          </span>
        )}
      </div>

      {showFilters && filterFields && (
        <div className="mt-2 px-4 py-3 bg-brand-50/30 border border-zoho-border rounded-lg flex gap-3 flex-wrap items-end">
          {filterFields}
          {hasActiveFilters && onClearFilters && (
            <button type="button" onClick={onClearFilters} className="btn-secondary text-xs py-1.5">
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
