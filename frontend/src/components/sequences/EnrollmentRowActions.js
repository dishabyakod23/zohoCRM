'use client';
import { canMarkEnrollmentReplied, canRemoveEnrollment } from '../../lib/sequenceHelpers.js';

export default function EnrollmentRowActions({
  enrollment,
  canManage = false,
  busy = false,
  onMarkReplied,
  onRemove,
}) {
  if (!canManage || !enrollment) return null;

  const showMarkReplied = canMarkEnrollmentReplied(enrollment.status);
  const showRemove = canRemoveEnrollment(enrollment.status);
  if (!showMarkReplied && !showRemove) {
    return <span className="text-xs text-zoho-muted">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {showMarkReplied && (
        <button
          type="button"
          className="text-xs text-brand-600 hover:underline disabled:opacity-50"
          disabled={busy}
          onClick={() => onMarkReplied?.(enrollment)}
        >
          Mark replied
        </button>
      )}
      {showRemove && (
        <button
          type="button"
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
          disabled={busy}
          onClick={() => onRemove?.(enrollment)}
        >
          Remove
        </button>
      )}
    </div>
  );
}
