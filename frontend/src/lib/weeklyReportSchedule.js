const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function getZonedDateParts(date, timeZone = 'UTC') {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour === '24' ? 0 : parts.hour);
  return {
    dayOfWeek: WEEKDAY_SHORT.indexOf(parts.weekday),
    hour,
    minute: Number(parts.minute),
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
}

/** Unique key for the current scheduled slot (one send per week per configured time). */
export function weeklyReportSlotKey(settings, date = new Date()) {
  if (!settings) return '';
  const tz = settings.timezone || 'UTC';
  const parts = getZonedDateParts(date, tz);
  return `${parts.year}-${parts.month}-${parts.day}-${settings.day_of_week}-${settings.hour}-${settings.minute}`;
}

export function isWeeklyReportDue(settings, date = new Date()) {
  if (!settings?.enabled) return false;

  const tz = settings.timezone || 'UTC';
  const parts = getZonedDateParts(date, tz);
  const targetDay = Number(settings.day_of_week);
  const targetHour = Number(settings.hour);
  const targetMinute = Number(settings.minute);

  return (
    parts.dayOfWeek === targetDay
    && parts.hour === targetHour
    && parts.minute === targetMinute
  );
}

export function formatWeeklyReportSchedule(settings) {
  if (!settings) return '';
  const day = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][settings.day_of_week] || '—';
  const hour = String(settings.hour ?? 0).padStart(2, '0');
  const minute = String(settings.minute ?? 0).padStart(2, '0');
  const tz = settings.timezone || 'UTC';
  return `${day} at ${hour}:${minute} (${tz})`;
}
