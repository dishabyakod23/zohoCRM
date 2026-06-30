'use client';
import { useState } from 'react';
import ListViewLayout from './ListViewLayout.js';

/** Compact search row for list pages without ListToolbar views. */
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
  filterTitle = 'Filter by',
  hasActiveFilters = false,
  onClearFilters = null,
  table,
}) {
  const [showFilters, setShowFilters] = useState(true);
  const hasFilters = !!filterFields;

  const toolbarLeft = (
    <>
      {leftActions}
      {onLimitChange && (
        <select className="input w-28 text-xs" value={limit} onChange={(e) => onLimitChange(+e.target.value)}>
          {limitOptions.map((n) => <option key={n} value={n}>{n} per page</option>)}
        </select>
      )}
      {total != null && (
        <span className="text-xs text-zoho-muted">
          {total} {total === 1 ? totalLabel.replace(/s$/, '') : totalLabel}
        </span>
      )}
    </>
  );

  const toolbarRight = onSearchChange ? (
    <input
      className="input w-52 text-xs"
      placeholder={placeholder}
      value={search || ''}
      onChange={(e) => onSearchChange(e.target.value)}
    />
  ) : null;

  return (
    <ListViewLayout
      toolbarLeft={toolbarLeft}
      toolbarRight={toolbarRight}
      showFilters={showFilters}
      onToggleFilters={() => setShowFilters((v) => !v)}
      hasFilters={hasFilters}
      filterTitle={filterTitle}
      filterContent={hasFilters ? filterFields : null}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      table={table}
    />
  );
}
