'use client';

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
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {leftActions}
      <input
        className="input max-w-xs text-sm"
        placeholder={placeholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
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
  );
}
