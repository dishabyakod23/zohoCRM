export const EVENT_TYPES = [
  { value: 'task', label: 'Task', color: '#2563eb', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-400' },
  { value: 'deadline', label: 'Deadline', color: '#ea4335', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-400' },
  { value: 'todo', label: 'To-Do', color: '#34a853', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-400' },
  { value: 'meeting', label: 'Meeting', color: '#7c3aed', bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-400' },
];

export function eventTypeMeta(type) {
  return EVENT_TYPES.find((t) => t.value === type) || EVENT_TYPES[0];
}

export function toDateKey(date) {
  if (date == null || date === '') return '';
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey() {
  return toDateKey(new Date());
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

export function addDays(date, count) {
  const d = new Date(date);
  d.setDate(d.getDate() + count);
  return d;
}

export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatShortDate(dateKey) {
  if (!dateKey) return '—';
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function buildMonthGrid(viewDate) {
  const first = startOfMonth(viewDate);
  const last = endOfMonth(viewDate);
  const start = addDays(first, -first.getDay());
  const weeks = [];
  let cursor = new Date(start);

  while (cursor <= last || cursor.getDay() !== 0) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
    if (weeks.length >= 6 && cursor > last) break;
  }
  return weeks;
}

export function buildWeekDays(viewDate) {
  const start = startOfWeek(viewDate);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function groupEventsByDate(events = []) {
  return events.reduce((acc, event) => {
    const key = toDateKey(event.event_date);
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});
}

export const ASSIGN_TO_ME = 'me';
export const ASSIGN_TO_ALL = 'all';

export function emptyEventForm(defaults = {}) {
  return {
    title: '',
    description: '',
    event_type: 'task',
    event_date: todayKey(),
    start_time: '',
    end_time: '',
    all_day: true,
    completed: false,
    remind_on_login: true,
    assign_to: ASSIGN_TO_ME,
    owner_id: '',
    ...defaults,
  };
}

/** Resolve calendar assign-to value into one or more owner user IDs. */
export function resolveCalendarAssigneeIds(assignTo, users = [], currentUserId) {
  if (!assignTo || assignTo === ASSIGN_TO_ME) {
    return currentUserId ? [currentUserId] : [];
  }
  if (assignTo === ASSIGN_TO_ALL) {
    return users
      .map((u) => u.id || u.value)
      .filter(Boolean);
  }
  return assignTo ? [assignTo] : (currentUserId ? [currentUserId] : []);
}

export function normalizeEvent(event) {
  if (!event) return event;
  const parseTime = (value) => (value ? String(value).slice(0, 5) : '');
  return {
    ...event,
    event_date: toDateKey(event.event_date),
    start_time: parseTime(event.start_time),
    end_time: parseTime(event.end_time),
    all_day: event.all_day !== false,
    completed: !!event.completed,
    remind_on_login: event.remind_on_login !== false,
    event_type_label: eventTypeMeta(event.event_type).label,
  };
}

export function isOverdue(event, refDate = todayKey()) {
  if (event.completed) return false;
  return toDateKey(event.event_date) < refDate;
}

export function isDueToday(event, refDate = todayKey()) {
  if (event.completed) return false;
  return toDateKey(event.event_date) === refDate;
}
