'use client';
import { useState } from 'react';

/**
 * List toolbar — secondary actions + filters on the left, search on the right.
 * Primary Create belongs in ListPageHeader (top-right).
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
}) {
  const [showFilters, setShowFilters] = useState(true);

  return (
    <div className="mb-0">
      <div className="zoho-toolbar">
        <div className="zoho-toolbar-left">
          {extraActions}
          {extraActions && <div className="h-4 w-px bg-zoho-border mx-1" />}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`zoho-filter-btn ${showFilters ? 'border-brand-300 text-brand-600 bg-brand-50' : ''}`}
          >
            Filter{showFilters ? ' ▲' : ' ▼'}
          </button>
          {total != null && (
            <span className="text-xs text-zoho-muted">{total} {total !== 1 ? 'records' : 'record'}</span>
          )}
        </div>
        {onSearch && (
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zoho-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="input w-52 pl-8 py-1.5 text-xs"
              placeholder={`Search ${moduleName}…`}
              value={searchValue || ''}
              onChange={(e) => onSearch?.(e.target.value)}
            />
          </div>
        )}
      </div>

      {showFilters && children && (
        <div className="px-4 py-3 bg-brand-50/30 border border-t-0 border-zoho-border flex gap-3 flex-wrap items-end">
          {children}
        </div>
      )}

      {views.length > 1 && (
        <div className="flex px-4 bg-white border border-t-0 border-zoho-border rounded-b-none">
          {views.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange?.(v)}
              className={`zoho-view-tab ${activeView === v ? 'zoho-view-tab-active' : 'zoho-view-tab-inactive'}`}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
