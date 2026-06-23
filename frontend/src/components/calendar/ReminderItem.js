'use client';
import Link from 'next/link';
import { eventTypeMeta, formatShortDate, formatTime, isDueToday, isOverdue, todayKey } from '../../lib/calendarHelpers.js';

export default function ReminderItem({
  event,
  onComplete,
  completing = false,
  showOpenLink = true,
  onNavigate,
}) {
  const meta = eventTypeMeta(event.event_type);
  const today = todayKey();
  const overdue = isOverdue(event, today);
  const dueToday = isDueToday(event, today);

  return (
    <div className="p-3 rounded-xl border border-zoho-border hover:bg-brand-50/40 hover:border-brand-200 text-sm transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {showOpenLink ? (
            <Link
              href="/calendar"
              onClick={onNavigate}
              className="font-medium text-zoho-text hover:text-brand-600"
            >
              {event.title}
            </Link>
          ) : (
            <p className="font-medium text-zoho-text">{event.title}</p>
          )}
          <p className={`text-xs mt-1 ${overdue ? 'text-red-600' : 'text-zoho-muted'}`}>
            {dueToday ? 'Due today' : overdue ? `Overdue · ${formatShortDate(event.event_date)}` : formatShortDate(event.event_date)}
            {event.start_time && !event.all_day ? ` · ${formatTime(event.start_time)}` : ''}
          </p>
          {event.description && (
            <p className="text-xs text-zoho-muted mt-1 line-clamp-2">{event.description}</p>
          )}
        </div>
        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
          {meta.label}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zoho-border/60">
        <button
          type="button"
          onClick={() => onComplete?.(event)}
          disabled={completing || !onComplete}
          className="text-xs font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50 flex items-center gap-1.5"
        >
          <span className={`w-4 h-4 rounded border flex items-center justify-center ${completing ? 'border-emerald-300' : 'border-emerald-500 hover:bg-emerald-50'}`}>
            {completing ? (
              <span className="w-2 h-2 border border-emerald-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          {completing ? 'Saving…' : 'Mark done'}
        </button>
        {showOpenLink && (
          <Link href="/calendar" onClick={onNavigate} className="text-xs text-brand-600 hover:underline ml-auto">
            Open calendar
          </Link>
        )}
      </div>
    </div>
  );
}
