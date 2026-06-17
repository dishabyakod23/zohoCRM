'use client';
import Link from 'next/link';
import Modal from '../ui/Modal.js';
import { eventTypeMeta, formatShortDate, formatTime, isDueToday, isOverdue, todayKey } from '../../lib/calendarHelpers.js';

function EventRow({ event }) {
  const meta = eventTypeMeta(event.event_type);
  const today = todayKey();
  const overdue = isOverdue(event, today);
  const dueToday = isDueToday(event, today);

  return (
    <div className={`p-3 rounded-xl border-l-4 ${meta.border} border border-zoho-border bg-white`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-zoho-text">{event.title}</p>
          <p className="text-xs text-zoho-muted mt-1">
            {meta.label}
            {event.start_time && !event.all_day ? ` · ${formatTime(event.start_time)}` : ''}
            {dueToday ? ' · Due today' : overdue ? ' · Overdue' : ` · ${formatShortDate(event.event_date)}`}
          </p>
          {event.description && <p className="text-xs text-zoho-muted mt-1 line-clamp-2">{event.description}</p>}
        </div>
        <span className={`shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
          {meta.label}
        </span>
      </div>
    </div>
  );
}

export default function LoginReminderModal({ open, events = [], onClose, onDismissToday }) {
  if (!open || events.length === 0) return null;

  const today = todayKey();
  const todayEvents = events.filter((e) => e.event_date === today);
  const overdueEvents = events.filter((e) => e.event_date < today);

  return (
    <Modal title="Your reminders" onClose={onClose} wide>
      <p className="text-sm text-zoho-muted mb-4">
        Here is what you have on your calendar for today and any overdue items.
      </p>

      {overdueEvents.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Overdue</p>
          <div className="space-y-2">
            {overdueEvents.map((e) => <EventRow key={e.id} event={e} />)}
          </div>
        </div>
      )}

      {todayEvents.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-2">Today</p>
          <div className="space-y-2">
            {todayEvents.map((e) => <EventRow key={e.id} event={e} />)}
          </div>
        </div>
      )}

      {todayEvents.length === 0 && overdueEvents.length === 0 && (
        <div className="space-y-2">
          {events.map((e) => <EventRow key={e.id} event={e} />)}
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-end pt-4 mt-2 border-t border-zoho-border">
        <Link href="/calendar" onClick={onClose} className="btn-secondary text-sm">Open Calendar</Link>
        <button type="button" onClick={onDismissToday} className="btn-primary text-sm">Got it</button>
      </div>
    </Modal>
  );
}
