'use client';
import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLink from '../../components/ui/AppLink.js';
import CRMLayout from '../../components/layout/CRMLayout.js';
import CalendarEventModal from '../../components/calendar/CalendarEventModal.js';
import CreateMeetingModal from '../../components/meetings/CreateMeetingModal.js';
import { useToast } from '../../components/ui/Toast.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import * as calendarApi from '../../lib/services/calendar.js';
import * as meetingsApi from '../../lib/services/meetings.js';
import { fetchUsers } from '../../lib/services/lookups.js';
import {
  EVENT_TYPES,
  addDays,
  addMonths,
  buildMonthGrid,
  buildWeekDays,
  eventTypeMeta,
  formatMonthYear,
  formatTime,
  groupEventsByDate,
  startOfWeek,
  toDateKey,
  resolveCalendarAssigneeIds,
  ASSIGN_TO_ME,
} from '../../lib/calendarHelpers.js';
import {
  meetingToCalendarItem,
  filterMeetingsInRange,
  filterMeetingsByHost,
  defaultMeetingDatetimesForDate,
} from '../../lib/calendarMeetingHelpers.js';
import { defaultOwnerFilterId } from '../../lib/listRecordFilters.js';
import { navigateToRecord } from '../../lib/recordNavigation.js';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isCrmMeeting(item) {
  return item?.source === 'crm_meeting' || Boolean(item?.meeting_id);
}

function EventPill({ event, onClick }) {
  const meta = eventTypeMeta(event.event_type);
  const meeting = isCrmMeeting(event);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(event); }}
      className={`block w-full max-w-full text-left text-xs leading-snug px-2 py-1 rounded truncate shrink-0 ${meta.bg} ${meta.text} hover:opacity-90 ${event.completed ? 'opacity-50 line-through' : ''} ${meeting ? 'ring-1 ring-violet-300/80' : ''}`}
      title={meeting ? `${event.title} (CRM meeting)` : event.title}
    >
      {!event.all_day && event.start_time ? `${formatTime(event.start_time)} ` : ''}{event.title}
    </button>
  );
}

function SidebarEventRow({ event, onEdit, onToggleComplete, toggling, canEdit }) {
  const meta = eventTypeMeta(event.event_type);
  const completed = !!event.completed;
  const meeting = isCrmMeeting(event);

  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg border border-zoho-border hover:bg-brand-50 text-sm ${completed ? 'bg-gray-50/80' : ''}`}>
      {meeting ? (
        <span className="mt-1 w-4 h-4 shrink-0 rounded-full bg-violet-500" title="CRM / Outlook meeting" />
      ) : canEdit ? (
        <input
          type="checkbox"
          checked={completed}
          disabled={toggling}
          onChange={(e) => {
            e.stopPropagation();
            onToggleComplete(event, e.target.checked);
          }}
          className="mt-0.5 shrink-0 rounded border-zoho-border text-brand-600 focus:ring-brand-500"
          aria-label={completed ? `Mark ${event.title} as not done` : `Mark ${event.title} as done`}
        />
      ) : (
        <span className={`mt-1 w-4 h-4 shrink-0 rounded border flex items-center justify-center ${completed ? 'bg-emerald-500 border-emerald-500' : 'border-zoho-border'}`}>
          {completed && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      )}
      <button type="button" onClick={() => onEdit(event)} className="flex-1 min-w-0 text-left">
        <p className={`font-medium truncate ${completed ? 'line-through text-zoho-muted' : ''}`}>{event.title}</p>
        <p className="text-[10px] text-zoho-muted">{meeting ? 'CRM / Outlook meeting' : meta.label}</p>
      </button>
    </div>
  );
}

function MonthDayCell({
  day, viewDate, today, selectedDate, eventsByDate, onSelect, onCreate, onEdit,
}) {
  const key = toDateKey(day);
  const inMonth = day.getMonth() === viewDate.getMonth();
  const isToday = key === today;
  const isSelected = key === selectedDate;
  const dayEvents = eventsByDate[key] || [];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(key)}
      onDoubleClick={() => onCreate(key)}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(key); }}
      className={[
        'relative flex flex-col min-h-[8.5rem] h-full overflow-hidden',
        'border-r border-b border-zoho-border p-2 cursor-pointer',
        'hover:bg-blue-50/30 transition-colors',
        !inMonth ? 'bg-gray-50/70 text-zoho-muted' : 'bg-white',
        isSelected ? 'bg-brand-50/90 shadow-[inset_0_0_0_2px_theme(colors.brand.500)] z-[1]' : '',
      ].join(' ')}
    >
      <div className="shrink-0 mb-1.5 flex justify-end">
        <span
          className={[
            'inline-flex h-8 w-8 items-center justify-center rounded-full text-sm',
            isToday ? 'bg-brand-600 text-white font-semibold' : 'text-zoho-text',
          ].join(' ')}
        >
          {day.getDate()}
        </span>
      </div>
      <div
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain"
        onWheel={(e) => e.stopPropagation()}
      >
        {dayEvents.map((e) => (
          <EventPill key={e.id} event={e} onClick={onEdit} />
        ))}
      </div>
    </div>
  );
}

function CalendarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { can, canAssignLeads } = usePermissions();
  const canCreateEvent = can('calendar', 'create');
  const canEditEvent = can('calendar', 'edit');
  const canViewMeetings = can('meetings', 'view');
  const canCreateMeeting = can('meetings', 'create');
  const [view, setView] = useState('month');
  const [viewDate, setViewDate] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [meetingDefaults, setMeetingDefaults] = useState({});
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [users, setUsers] = useState([]);
  const [ownerFilter, setOwnerFilter] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    setOwnerFilter(defaultOwnerFilterId(user));
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!canCreateMeeting) return;
    if (searchParams.get('create_meeting') !== '1' && searchParams.get('create') !== '1') return;
    setMeetingDefaults(defaultMeetingDatetimesForDate(selectedDate));
    setMeetingModalOpen(true);
    router.replace('/calendar', { scroll: false });
  }, [searchParams, canCreateMeeting, router, selectedDate]);

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
    if (canEditEvent || canCreateMeeting) {
      fetchUsers().then(setUsers).catch(() => setUsers([]));
    }
  }, [canEditEvent, canCreateMeeting]);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const eventPromise = calendarApi.listEvents({
        ...range,
        owner_id: ownerFilter || undefined,
      });
      const meetingPromise = canViewMeetings
        ? meetingsApi.listMeetings({ page: 1, page_size: 200, limit: 200 }).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] });

      const [eventData, meetingResult] = await Promise.all([eventPromise, meetingPromise]);
      setEvents(eventData);
      const ranged = filterMeetingsInRange(meetingResult.data || [], range.from, range.to);
      setMeetings(filterMeetingsByHost(ranged, ownerFilter));
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [range, ownerFilter, showToast, canViewMeetings]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  const calendarItems = useMemo(() => {
    const meetingItems = meetings.map(meetingToCalendarItem);
    return [...events, ...meetingItems];
  }, [events, meetings]);

  const eventsByDate = useMemo(() => groupEventsByDate(calendarItems), [calendarItems]);
  const today = toDateKey(new Date());
  const monthGrid = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const weekDays = useMemo(() => buildWeekDays(viewDate), [viewDate]);
  const selectedEvents = eventsByDate[selectedDate] || [];

  const openCreateEvent = (dateKey) => {
    if (!canCreateEvent) return;
    setEditEvent({ event_date: dateKey || selectedDate });
    setModalOpen(true);
  };

  const openCreateMeeting = (dateKey) => {
    if (!canCreateMeeting) return;
    setMeetingDefaults(defaultMeetingDatetimesForDate(dateKey || selectedDate));
    setMeetingModalOpen(true);
  };

  const openItem = async (item) => {
    if (isCrmMeeting(item)) {
      navigateToRecord(`/meetings/${item.meeting_id}`);
      return;
    }
    setEditEvent(item);
    setModalOpen(true);
    try {
      const fresh = await calendarApi.getEvent(item.id);
      setEditEvent(fresh);
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.assign_to;

      if (editEvent?.id) {
        const ownerId = form.assign_to === ASSIGN_TO_ME ? user?.id : form.assign_to;
        await calendarApi.updateEvent(editEvent.id, { ...payload, owner_id: ownerId });
        showToast('Event saved', 'success');
      } else {
        const assigneeIds = resolveCalendarAssigneeIds(form.assign_to, users, user?.id);
        if (assigneeIds.length === 0) {
          await calendarApi.createEvent({ ...payload, owner_id: user?.id });
          showToast('Event saved', 'success');
        } else if (assigneeIds.length <= 1) {
          await calendarApi.createEvent({ ...payload, owner_id: assigneeIds[0] || user?.id });
          showToast('Event saved', 'success');
        } else {
          await calendarApi.createEventsForAssignees(payload, assigneeIds);
          showToast(`Event assigned to ${assigneeIds.length} team members`, 'success');
        }
      }
      setModalOpen(false);
      setEditEvent(null);
      loadCalendar();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editEvent?.id || isCrmMeeting(editEvent)) return;
    setSaving(true);
    try {
      await calendarApi.deleteEvent(editEvent.id);
      setModalOpen(false);
      setEditEvent(null);
      loadCalendar();
      showToast('Event deleted', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleEventComplete = async (event, completed) => {
    if (isCrmMeeting(event)) return;
    setTogglingId(event.id);
    try {
      await calendarApi.updateEvent(event.id, { completed });
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, completed } : e)));
      if (editEvent?.id === event.id) {
        setEditEvent((prev) => (prev ? { ...prev, completed } : prev));
      }
      showToast(completed ? 'Marked as done' : 'Marked as active', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setTogglingId(null);
    }
  };

  const currentUserName = user?.name
    || `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
    || user?.email
    || 'Me';

  return (
    <CRMLayout>
      <div className="h-[calc(100vh-6rem)] flex flex-col bg-white">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-zoho-border shrink-0">
          {canCreateEvent && (
            <button
              type="button"
              onClick={() => openCreateEvent(selectedDate)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-zoho-border shadow-sm hover:shadow text-sm font-medium"
            >
              <PlusIcon className="w-4 h-4" /> Event
            </button>
          )}
          {canCreateMeeting && (
            <button
              type="button"
              onClick={() => openCreateMeeting(selectedDate)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-600 text-white shadow-sm hover:bg-violet-700 text-sm font-medium"
            >
              <PlusIcon className="w-4 h-4" /> Meeting
            </button>
          )}
          <button type="button" onClick={() => { const n = new Date(); setViewDate(n); setSelectedDate(toDateKey(n)); }}
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
            {canViewMeetings && (
              <AppLink href="/settings" className="text-xs text-zoho-muted hover:text-brand-600 hidden md:inline">
                Outlook sync in Settings
              </AppLink>
            )}
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
          <aside className="w-56 shrink-0 border-r border-zoho-border p-4 hidden lg:block overflow-y-auto">
            <div className="mb-6">
              <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-2">Legend</p>
              <div className="space-y-2">
                {EVENT_TYPES.map((t) => (
                  <div key={t.value} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.label}{t.value === 'meeting' ? ' (CRM / Outlook)' : ''}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-2">
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-zoho-muted">No events or meetings</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((e) => (
                    <SidebarEventRow
                      key={e.id}
                      event={e}
                      onEdit={openItem}
                      onToggleComplete={toggleEventComplete}
                      toggling={togglingId === e.id}
                      canEdit={canEditEvent}
                    />
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-col gap-1">
                {canCreateEvent && (
                  <button type="button" onClick={() => openCreateEvent(selectedDate)} className="text-xs text-brand-600 hover:underline text-left">
                    + Add event
                  </button>
                )}
                {canCreateMeeting && (
                  <button type="button" onClick={() => openCreateMeeting(selectedDate)} className="text-xs text-violet-700 hover:underline text-left">
                    + Add meeting
                  </button>
                )}
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0 flex flex-col border-l border-zoho-border">
            <div className="grid grid-cols-7 border-b border-zoho-border bg-gray-50/80 shrink-0">
              {WEEKDAYS.map((d) => (
                <div key={d} className="border-r border-zoho-border py-2 text-center text-[11px] font-medium text-zoho-muted uppercase">
                  {d}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center text-sm text-zoho-muted">Loading calendar…</div>
            ) : view === 'month' ? (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div
                  className="grid grid-cols-7 border-t border-zoho-border min-h-full"
                  style={{ gridTemplateRows: `repeat(${monthGrid.length}, minmax(8.5rem, 1fr))` }}
                >
                  {monthGrid.flat().map((day) => (
                    <MonthDayCell
                      key={toDateKey(day)}
                      day={day}
                      viewDate={viewDate}
                      today={today}
                      selectedDate={selectedDate}
                      eventsByDate={eventsByDate}
                      onSelect={setSelectedDate}
                      onCreate={canCreateEvent ? openCreateEvent : openCreateMeeting}
                      onEdit={openItem}
                    />
                  ))}
                </div>
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
                      <div
                        className="flex-1 overflow-y-auto p-2 space-y-1"
                        onDoubleClick={() => (canCreateEvent ? openCreateEvent(key) : openCreateMeeting(key))}
                      >
                        {dayEvents.map((e) => <EventPill key={e.id} event={e} onClick={openItem} />)}
                        {dayEvents.length === 0 && (canCreateEvent || canCreateMeeting) && (
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
        onDelete={editEvent?.id && !isCrmMeeting(editEvent) ? handleDelete : null}
        initial={editEvent}
        saving={saving}
        users={users}
        currentUserId={user?.id}
        currentUserName={currentUserName}
        canAssignToOthers={canAssignLeads}
      />

      <CreateMeetingModal
        open={meetingModalOpen}
        onClose={() => setMeetingModalOpen(false)}
        onCreated={() => loadCalendar()}
        defaults={meetingDefaults}
        defaultHostId={user?.id || ''}
      />
    </CRMLayout>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={(
      <CRMLayout>
        <div className="p-6 text-sm text-zoho-muted">Loading calendar…</div>
      </CRMLayout>
    )}>
      <CalendarPageContent />
    </Suspense>
  );
}
