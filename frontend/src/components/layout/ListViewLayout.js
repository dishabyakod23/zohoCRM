'use client';

import ListFilterSidebar from './ListFilterSidebar.js';

/**
 * Zoho-style list shell: toolbar on top, optional view tabs, separate filter + table cards.
 */
export default function ListViewLayout({
  toolbarLeft,
  toolbarRight,
  views = [],
  activeView,
  onViewChange,
  showFilters = true,
  onToggleFilters,
  hasFilters = false,
  filterTitle,
  filterContent,
  hasActiveFilters = false,
  onClearFilters,
  table,
}) {
  const showSidebar = showFilters && hasFilters && filterContent;
  const hasBody = showSidebar || table;

  return (
    <div className="list-view-shell">
      <div className={`list-view-toolbar-card ${views.length > 1 ? 'list-view-toolbar-card-tabs' : ''}`}>
        <div className="zoho-toolbar list-view-toolbar">
          <div className="zoho-toolbar-left">
            {toolbarLeft}
            {hasFilters && onToggleFilters && (
              <>
                {toolbarLeft && <div className="h-4 w-px bg-zoho-border mx-1" />}
                <button
                  type="button"
                  onClick={onToggleFilters}
                  className={`zoho-filter-btn ${showFilters ? 'border-brand-300 text-brand-600 bg-brand-50' : ''}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filter
                </button>
              </>
            )}
          </div>
          {toolbarRight}
        </div>

        {views.length > 1 && (
          <div className="flex px-4 border-t border-zoho-border list-view-tabs">
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

      {hasBody && (
        <div className="list-view-panels">
          <div className="list-view-body">
            {showSidebar && (
              <ListFilterSidebar
                title={filterTitle}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={onClearFilters}
              >
                {filterContent}
              </ListFilterSidebar>
            )}
            {table && (
              <div className="list-view-table-card">
                {table}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
