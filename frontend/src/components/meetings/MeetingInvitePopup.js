'use client';
import { useRouter } from 'next/navigation';
import { useMeetingReminders } from '../../hooks/useMeetingReminders.js';
import { userBriefName } from '../../lib/activityHelpers.js';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

export default function MeetingInvitePopup() {
  const router = useRouter();
  const { reminders, popupOpen, acknowledge, dismissPopup } = useMeetingReminders();
  const invite = reminders[0];

  if (!popupOpen || !invite) return null;

  const hostLabel = invite.host_name || userBriefName(invite.host) || 'Someone';
  const remaining = Math.max(0, reminders.length - 1);

  const onDismiss = async () => {
    try {
      await acknowledge(invite.id);
    } catch {
      // toast handled in hook
    }
  };

  const onView = async () => {
    const id = invite.id;
    dismissPopup();
    try {
      await acknowledge(id);
    } catch {
      // still navigate
    }
    router.push(`/meetings/${id}`);
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-4 bg-black/35 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-labelledby="meeting-invite-title"
        className="w-full max-w-md bg-white rounded-2xl shadow-card-hover border border-zoho-border overflow-hidden animate-scaleIn"
      >
        <div className="px-5 py-4 border-b border-zoho-border bg-brand-50/70">
          <p className="text-[10px] font-bold uppercase tracking-wide text-brand-600">Meeting invite</p>
          <h2 id="meeting-invite-title" className="text-base font-semibold text-zoho-text mt-0.5">
            {invite.title}
          </h2>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-zoho-text">{invite.message}</p>
          <dl className="text-xs text-zoho-muted space-y-1.5">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 font-medium text-zoho-text">When</dt>
              <dd>{formatWhen(invite.start_at)}{invite.end_at ? ` – ${formatWhen(invite.end_at)}` : ''}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 font-medium text-zoho-text">Host</dt>
              <dd>{hostLabel}</dd>
            </div>
            {invite.location && (
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 font-medium text-zoho-text">Where</dt>
                <dd>{invite.location}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 font-medium text-zoho-text">Role</dt>
              <dd className="capitalize">{invite.role}</dd>
            </div>
          </dl>
          {remaining > 0 && (
            <p className="text-xs text-brand-600">+{remaining} more invite{remaining === 1 ? '' : 's'} waiting</p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zoho-border flex items-center justify-end gap-2 bg-neutral-50/80">
          <button type="button" onClick={onDismiss} className="btn-secondary text-xs">
            Dismiss
          </button>
          <button type="button" onClick={onView} className="btn-primary text-xs">
            View meeting
          </button>
        </div>
      </div>
    </div>
  );
}
