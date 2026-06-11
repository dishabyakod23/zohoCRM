'use client';
import { useState } from 'react';

/**
 * Zoho-style list view toolbar: views tabs, filters, sort, bulk actions, create CTA
 */
export default function ListToolbar({
  moduleName,
  total,
  views = ['All Records'],
  activeView,
  onViewChange,
  onSearch,
  searchValue,
  onCreate,
  createLabel,
  children,
  extraActions,
}) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="mb-0">
      <div className="zoho-toolbar">
        <div className="zoho-toolbar-left">
          <button onClick={onCreate} className="btn-primary text-xs px-4">{createLabel || `+ Create ${moduleName}`}</button>
          {extraActions}
          <div className="h-5 w-px bg-zoho-border mx-1" />
          <button onClick={() => setShowFilters(!showFilters)} className="zoho-filter-btn">Filter</button>
          <button className="zoho-filter-btn">Sort</button>
          <span className="text-xs text-zoho-muted ml-2">{total} Record{total !== 1 ? 's' : ''}</span>
        </div>
        <input
          className="input max-w-[200px] py-1 text-xs"
          placeholder={`Search ${moduleName}...`}
          value={searchValue || ''}
          onChange={e => onSearch?.(e.target.value)}
        />
      </div>

      {showFilters && children && (
        <div className="px-4 py-3 bg-[#fafbfc] border border-t-0 border-zoho-border rounded-b flex gap-3 flex-wrap">
          {children}
        </div>
      )}

      {views.length > 1 && (
        <div className="flex gap-0 px-4 bg-white border border-t-0 border-zoho-border">
          {views.map(v => (
            <button key={v} onClick={() => onViewChange?.(v)}
              className={`zoho-view-tab ${activeView === v ? 'zoho-view-tab-active' : 'zoho-view-tab-inactive'}`}>
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
