'use client';

/** Standard list page header — title left, secondary actions + primary Create on the right. */
export default function ListPageHeader({
  title,
  subtitle,
  primaryAction = null,
  secondaryActions = null,
}) {
  return (
    <div className="page-header mb-4">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {(primaryAction || secondaryActions) && (
        <div className="page-actions flex flex-wrap items-center gap-2">
          {secondaryActions}
          {primaryAction}
        </div>
      )}
    </div>
  );
}
