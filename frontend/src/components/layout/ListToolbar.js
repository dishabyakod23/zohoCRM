'use client';
import { useState } from 'react';
import ListViewLayout from './ListViewLayout.js';
import ListSortSelect from './ListSortSelect.js';

/**
 * List toolbar — views, filter sidebar, search, and integrated table.
 */
export default function ListToolbar({
  moduleName,
  total,
  views = ['All Records'],
  activeView,
  onViewChange,
  onSearch,
  searchValue,
  children,
  extraActions,
  table,
  hasActiveFilters = false,
  onClearFilters,
  sort,
  onSortChange,
}) {
  const [showFilters, setShowFilters] = useState(true);
  const hasFilters = !!children;

  const toolbarLeft = (
    <>
      {extraActions}
      <ListSortSelect value={sort} onChange={onSortChange} />
      {total != null && (
        <span className="text-xs text-zoho-muted">
          {total} {total !== 1 ? 'records' : 'record'}
        </span>
      )}
    </>
  );

  const toolbarRight = onSearch ? (
    <div className="relative">
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zoho-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        className="input w-52 pl-8 py-1.5 text-xs"
        placeholder={`Search ${moduleName}…`}
        value={searchValue || ''}
        onChange={(e) => onSearch?.(e.target.value)}
      />
    </div>
  ) : null;

  return (
    <ListViewLayout
      toolbarLeft={toolbarLeft}
      toolbarRight={toolbarRight}
      views={views}
      activeView={activeView}
      onViewChange={onViewChange}
      showFilters={showFilters}
      onToggleFilters={() => setShowFilters((v) => !v)}
      hasFilters={hasFilters}
      filterTitle={`Filter ${moduleName} by`}
      filterContent={hasFilters ? children : null}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      table={table}
    />
  );
}
