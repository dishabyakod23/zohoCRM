'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CRMLayout from '../../components/layout/CRMLayout.js';
import CalendarEventModal from '../../components/calendar/CalendarEventModal.js';
import { useToast } from '../../components/ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import * as calendarApi from '../../lib/services/calendar.js';
import { fetchUsers } from '../../lib/services/lookups.js';
import {
  EVENT_TYPES,
  addDays,
  addMonths,
  buildMonthGrid,
  buildWeekDays,
  endOfMonth,
  eventTypeMeta,
  formatMonthYear,
  formatTime,
  groupEventsByDate,
  startOfMonth,
  startOfWeek,
  toDateKey,
  todayKey,
} from '../../lib/calendarHelpers.js';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function EventPill({ event, onClick }) {
  const meta = eventTypeMeta(event.event_type);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(event); }}
      className={`w-full text-left text-[11px] px-1.5 py-0.5 rounded truncate ${meta.bg} ${meta.text} hover:opacity-90`}
      title={event.title}
    >
      {!event.all_day && event.start_time ? `${formatTime(event.start_time)} ` : ''}{event.title}
    </button>
  );
}

export default function CalendarPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { canEdit, canAssignLeads } = usePermissions();
  const [view, setView] = useState('month');
  const [viewDate, setViewDate] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [ownerFilter, setOwnerFilter] = useState('');

  const ctx = useMemo(() => ({
    userId: user?.id,
    isAdmin: canAssignLeads,
  }), [user?.id, canAssignLeads]);

  const range = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(viewDate);
      const end = addDays(start, 6);
      return { from: toDateKey(start), to: toDateKey(end) };
    }
    const grid = buildMonthGrid(viewDate);
    const start = grid[0][0];
    const end = grid[grid.length - 1][6];
    return { from: toDateKey(start), to: toDateKey(end) };
  }, [view, viewDate]);

  useEffect(() => {
    if (canAssignLeads) fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, [canAssignLeads]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await calendarApi.listEvents({
        ...range,
        owner_id: ownerFilter || undefined,
        ...ctx,
      });
      setEvents(data);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [range, ownerFilter, ctx, showToast]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  const today = todayKey();
  const monthGrid = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const weekDays = useMemo(() => buildWeekDays(viewDate), [viewDate]);
  const selectedEvents = eventsByDate[selectedDate] || [];

  const openCreate = (dateKey) => {
    if (!canEdit) return;
    setEditEvent({ event_date: dateKey || selectedDate });
    setModalOpen(true);
  };

  const openEdit = (event) => {
    setEditEvent(event);
    setModalOpen(true);
  };

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (editEvent?.id) await calendarApi.updateEvent(editEvent.id, form, ctx);
      else await calendarApi.createEvent(form, ctx);
      setModalOpen(false);
      setEditEvent(null);
      loadEvents();
      showToast('Event saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editEvent?.id) return;
    setSaving(true);
    try {
      await calendarApi.deleteEvent(editEvent.id, ctx);
      setModalOpen(false);
      setEditEvent(null);
      loadEvents();
      showToast('Event deleted', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col bg-white">
        {/* Google Calendar-style toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-zoho-border shrink-0">
          <button type="button" onClick={() => openCreate(selectedDate)} disabled={!canEdit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-zoho-border shadow-sm hover:shadow text-sm font-medium disabled:opacity-50">
            <PlusIcon className="w-4 h-4" /> Create
          </button>
          <button type="button" onClick={() => { const n = new Date(); setViewDate(n); setSelectedDate(todayKey()); }}
            className="px-4 py-2 rounded-full border border-zoho-border text-sm font-medium hover:bg-gray-50">
            Today
          </button>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setViewDate((d) => (view === 'week' ? addDays(d, -7) : addMonths(d, -1)))} className="p-2 rounded-full hover:bg-gray-100" aria-label="Previous">
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => setViewDate((d) => (view === 'week' ? addDays(d, 7) : addMonths(d, 1)))} className="p-2 rounded-full hover:bg-gray-100" aria-label="Next">
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
          <h1 className="text-xl text-zoho-text font-normal min-w-[180px]">{formatMonthYear(viewDate)}</h1>
          <div className="ml-auto flex items-center gap-2">
            {canAssignLeads && users.length > 0 && (
              <select className="input text-sm w-40" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
                <option value="">All users</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            <select className="input text-sm w-28" value={view} onChange={(e) => setView(e.target.value)}>
              <option value="month">Month</option>
              <option value="week">Week</option>
            </select>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left sidebar */}
          <aside className="w-56 shrink-0 border-r border-zoho-border p-4 hidden lg:block overflow-y-auto">
            <div className="mb-6">
              <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-2">Legend</p>
              <div className="space-y-2">
                {EVENT_TYPES.map((t) => (
                  <div key={t.value} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.label}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-2">
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-zoho-muted">No events</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((e) => (
                    <button key={e.id} type="button" onClick={() => openEdit(e)}
                      className="w-full text-left p-2 rounded-lg border border-zoho-border hover:bg-brand-50 text-sm">
                      <p className="font-medium truncate">{e.title}</p>
                      <p className="text-[10px] text-zoho-muted">{eventTypeMeta(e.event_type).label}</p>
                    </button>
                  ))}
                </div>
              )}
              {canEdit && (
                <button type="button" onClick={() => openCreate(selectedDate)} className="mt-3 text-xs text-brand-600 hover:underline">
                  + Add event
                </button>
              )}
            </div>
          </aside>

          {/* Main calendar grid */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="grid grid-cols-7 border-b border-zoho-border bg-gray-50/80 shrink-0">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2 text-center text-[11px] font-medium text-zoho-muted uppercase">{d}</div>
              ))}
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center text-sm text-zoho-muted">Loading calendar…</div>
            ) : view === 'month' ? (
              <div className="flex-1 grid grid-rows-6 min-h-0">
                {monthGrid.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 border-b border-zoho-border min-h-[100px]">
                    {week.map((day) => {
                      const key = toDateKey(day);
                      const inMonth = day.getMonth() === viewDate.getMonth();
                      const isToday = key === today;
                      const isSelected = key === selectedDate;
                      const dayEvents = eventsByDate[key] || [];
                      return (
                        <div
                          key={key}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedDate(key)}
                          onDoubleClick={() => openCreate(key)}
                          className={`border-r border-zoho-border p-1 cursor-pointer overflow-hidden hover:bg-blue-50/40 ${!inMonth ? 'bg-gray-50/60 text-zoho-muted' : ''} ${isSelected ? 'ring-2 ring-inset ring-brand-400' : ''}`}
                        >
                          <div className={`text-xs w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-brand-600 text-white font-semibold' : ''}`}>
                            {day.getDate()}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 3).map((e) => (
                              <EventPill key={e.id} event={e} onClick={openEdit} />
                            ))}
                            {dayEvents.length > 3 && (
                              <p className="text-[10px] text-zoho-muted px-1">+{dayEvents.length - 3} more</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-7 min-h-0 divide-x divide-zoho-border">
                {weekDays.map((day) => {
                  const key = toDateKey(day);
                  const isToday = key === today;
                  const dayEvents = eventsByDate[key] || [];
                  return (
                    <div key={key} className="flex flex-col min-h-0">
                      <button type="button" onClick={() => setSelectedDate(key)}
                        className={`py-2 text-center border-b border-zoho-border ${isToday ? 'bg-brand-50' : ''}`}>
                        <p className="text-[10px] text-zoho-muted uppercase">{WEEKDAYS[day.getDay()]}</p>
                        <p className={`text-lg ${isToday ? 'text-brand-600 font-semibold' : ''}`}>{day.getDate()}</p>
                      </button>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1" onDoubleClick={() => openCreate(key)}>
                        {dayEvents.map((e) => <EventPill key={e.id} event={e} onClick={openEdit} />)}
                        {dayEvents.length === 0 && canEdit && (
                          <p className="text-[10px] text-zoho-muted text-center pt-4">Double-click to add</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <CalendarEventModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditEvent(null); }}
        onSave={handleSave}
        onDelete={editEvent?.id ? handleDelete : null}
        initial={editEvent}
        saving={saving}
        users={users}
        canAssign={canAssignLeads}
        currentUserId={user?.id}
      />
    </CRMLayout>
  );
}
