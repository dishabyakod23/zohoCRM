'use client';

function SkeletonLine({ className = '' }) {
  return <div className={`animate-pulse rounded bg-zoho-border/60 ${className}`} />;
}

export function TabPanelSkeleton({ rows = 4 }) {
  return (
    <div className="card p-5 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            <SkeletonLine className="h-3 w-16" />
            <SkeletonLine className="h-4 w-48" />
          </div>
          <SkeletonLine className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export default function RecordDetailSkeleton() {
  return (
    <div className="min-h-full animate-pulse">
      <div className="zoho-record-header">
        <SkeletonLine className="h-3 w-20" />
        <div className="flex items-start gap-4 mt-4">
          <SkeletonLine className="h-12 w-12 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="h-5 w-56" />
            <SkeletonLine className="h-4 w-36" />
          </div>
        </div>
      </div>
      <div className="zoho-record-tabs px-6 pt-4 flex gap-4">
        <SkeletonLine className="h-4 w-16" />
        <SkeletonLine className="h-4 w-12" />
        <SkeletonLine className="h-4 w-20" />
      </div>
      <div className="p-6 space-y-4">
        <div className="card p-5 space-y-4">
          <SkeletonLine className="h-3 w-28" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <SkeletonLine className="h-3 w-20" />
                <SkeletonLine className="h-4 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
