'use client';
import { useMemo, useState, Children, isValidElement } from 'react';
import { FilterLayoutProvider } from './ListFilterFields.js';

function FilterSection({ title, open, onToggle, children }) {
  return (
    <div className="list-filter-section">
      <button type="button" onClick={onToggle} className="list-filter-section-header">
        <span>{title}</span>
        <svg
          className={`w-3.5 h-3.5 text-zoho-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="list-filter-section-body">{children}</div>}
    </div>
  );
}

function childLabel(child) {
  if (!isValidElement(child)) return '';
  const fromProps = child.props?.label || child.props?.['data-filter-label'] || '';
  if (fromProps) return String(fromProps);
  const type = child.type;
  if (typeof type === 'function' && type.filterLabel) return String(type.filterLabel);
  return '';
}

function matchScore(label, query) {
  const normalized = String(label || '').toLowerCase();
  const q = String(query || '').toLowerCase().trim();
  if (!q || !normalized) return null;
  if (normalized === q) return 0;
  if (normalized.startsWith(q)) return 1;
  // Match any word in composite labels (e.g. "Created from Created to …").
  const words = normalized.split(/[\s,/|-]+/).filter(Boolean);
  if (words.some((word) => word.startsWith(q))) return 2;
  if (normalized.includes(q)) return 3;
  if (words.some((word) => word.includes(q))) return 4;
  return null;
}

export default function ListFilterSidebar({
  title = 'Filter by',
  children,
  hasActiveFilters = false,
  onClearFilters,
  onListSearch,
  listSearchValue,
}) {
  const [filterSearch, setFilterSearch] = useState('');
  const [fieldsOpen, setFieldsOpen] = useState(true);
  const useListSearch = typeof onListSearch === 'function';

  const visibleChildren = useMemo(() => {
    const list = Children.toArray(children).filter(isValidElement);
    if (useListSearch) return list;
    const q = filterSearch.trim().toLowerCase();
    if (!q) return list;

    return list
      .map((child) => {
        const label = childLabel(child);
        const score = matchScore(label, q);
        if (score == null) return null;
        return { child, score, label: label.toLowerCase() };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
      .map((entry) => entry.child);
  }, [children, filterSearch, useListSearch]);

  if (!children) return null;

  const searchValue = useListSearch ? (listSearchValue || '') : filterSearch;
  const searchPlaceholder = useListSearch ? 'Search list…' : 'Filter fields…';

  return (
    <aside className="list-filter-sidebar">
      <div className="list-filter-sidebar-header">
        <h4 className="text-sm font-semibold text-zoho-text">{title}</h4>
        <div className="relative mt-2">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zoho-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            className="input w-full pl-8 py-1.5 text-xs"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => {
              const next = e.target.value;
              if (useListSearch) onListSearch(next);
              else setFilterSearch(next);
            }}
          />
        </div>
      </div>

      <div className="list-filter-sidebar-scroll">
        <FilterSection title="Filter By Fields" open={fieldsOpen} onToggle={() => setFieldsOpen((v) => !v)}>
          {visibleChildren.length > 0 ? (
            <FilterLayoutProvider variant="sidebar">{visibleChildren}</FilterLayoutProvider>
          ) : (
            <p className="text-xs text-zoho-muted px-1 py-2">No matching filters</p>
          )}
        </FilterSection>
      </div>

      {hasActiveFilters && onClearFilters && (
        <div className="list-filter-sidebar-footer">
          <button type="button" onClick={onClearFilters} className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline">
            Clear all filters
          </button>
        </div>
      )}
    </aside>
  );
}
