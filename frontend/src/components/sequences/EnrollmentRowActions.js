'use client';
import { canMarkEnrollmentReplied, canRemoveEnrollment, canResumeEnrollment } from '../../lib/sequenceHelpers.js';

export default function EnrollmentRowActions({
  enrollment,
  canManage = false,
  busy = false,
  onResume,
  onMarkReplied,
  onRemove,
}) {
  if (!canManage || !enrollment) return null;

  const showResume = canResumeEnrollment(enrollment.status);
  const showMarkReplied = canMarkEnrollmentReplied(enrollment.status);
  const showRemove = canRemoveEnrollment(enrollment.status);
  if (!showResume && !showMarkReplied && !showRemove) {
    return <span className="text-xs text-zoho-muted">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {showResume && (
        <button
          type="button"
          className="text-xs text-brand-600 hover:underline disabled:opacity-50"
          disabled={busy}
          onClick={() => onResume?.(enrollment)}
        >
          Resume
        </button>
      )}
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
