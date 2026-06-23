'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Modal from '../ui/Modal.js';
import ReminderItem from './ReminderItem.js';
import * as calendarApi from '../../lib/services/calendar.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { todayKey } from '../../lib/calendarHelpers.js';

export default function LoginReminderModal({ open, events = [], onClose, onDismissToday, onEventCompleted }) {
  const { showToast } = useToast();
  const [items, setItems] = useState(events);
  const [completingId, setCompletingId] = useState(null);

  useEffect(() => {
    if (open) setItems(events);
  }, [open, events]);

  if (!open || items.length === 0) return null;

  const today = todayKey();
  const todayEvents = items.filter((e) => e.event_date === today);
  const overdueEvents = items.filter((e) => e.event_date < today);

  const markComplete = async (event) => {
    setCompletingId(event.id);
    try {
      await calendarApi.updateEvent(event.id, { completed: true });
      setItems((prev) => prev.filter((e) => e.id !== event.id));
      onEventCompleted?.(event.id);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setCompletingId(null);
    }
  };

  const renderSection = (title, sectionEvents, titleClass) => (
    sectionEvents.length > 0 && (
      <div className="mb-4">
        <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${titleClass}`}>{title}</p>
        <div className="space-y-2">
          {sectionEvents.map((e) => (
            <ReminderItem
              key={e.id}
              event={e}
              onComplete={markComplete}
              completing={completingId === e.id}
              showOpenLink={false}
            />
          ))}
        </div>
      </div>
    )
  );

  return (
    <Modal title="Your reminders" onClose={onClose} wide>
      <p className="text-sm text-zoho-muted mb-4">
        Mark items done when finished, or open the calendar for full details.
      </p>

      {renderSection('Overdue', overdueEvents, 'text-red-600')}
      {renderSection('Today', todayEvents, 'text-brand-600')}

      {todayEvents.length === 0 && overdueEvents.length === 0 && (
        <div className="space-y-2">
          {items.map((e) => (
            <ReminderItem
              key={e.id}
              event={e}
              onComplete={markComplete}
              completing={completingId === e.id}
              showOpenLink={false}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-end pt-4 mt-2 border-t border-zoho-border">
        <Link href="/calendar" onClick={onClose} className="btn-secondary text-sm">Open Calendar</Link>
        <button type="button" onClick={onDismissToday} className="btn-primary text-sm">Got it</button>
      </div>
    </Modal>
  );
}
