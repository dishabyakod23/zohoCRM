/** Multi-touch outreach sequence helpers — labels, scheduling, templates, variants. */

export const SEQUENCE_STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export const ENROLLMENT_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REMOVED', label: 'Removed' },
];

/** P1 email + P2 manual LinkedIn/call step types. */
export const STEP_TYPES = [
  { value: 'AUTO_EMAIL', label: 'Email', phase: 1 },
  { value: 'AB_EMAIL', label: 'A/B Email', phase: 1 },
  { value: 'LINKEDIN_CONNECTION', label: 'LinkedIn Connection', phase: 2 },
  { value: 'LINKEDIN_MESSAGE', label: 'LinkedIn Message', phase: 2 },
  { value: 'LINKEDIN_FOLLOWUP', label: 'LinkedIn Follow-up', phase: 2 },
  { value: 'CALL', label: 'Call Task', phase: 2 },
];

export const EMAIL_EVENT_LABELS = {
  SENT: 'Sent',
  DELIVERED: 'Delivered',
  OPENED: 'Opened',
  CLICKED: 'Clicked',
  REPLIED: 'Replied',
  BOUNCED: 'Bounced',
  UNSUBSCRIBED: 'Unsubscribed',
  PENDING: 'Pending',
};

export const TEMPLATE_VARIABLES = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'company_name', label: 'Company Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'owner_name', label: 'Owner Name' },
  { key: 'job_title', label: 'Job Title' },
];

export const SEND_DAYS = [
  { bit: 1, label: 'Mon' },
  { bit: 2, label: 'Tue' },
  { bit: 4, label: 'Wed' },
  { bit: 8, label: 'Thu' },
  { bit: 16, label: 'Fri' },
  { bit: 32, label: 'Sat' },
  { bit: 64, label: 'Sun' },
];

export const DEFAULT_SEND_DAYS = 62;

export const CALL_STATUSES = [
  { value: 'connected', label: 'Connected' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'callback_requested', label: 'Callback Requested' },
  { value: 'wrong_number', label: 'Wrong Number' },
  { value: 'not_interested', label: 'Not Interested' },
];

export const LINKEDIN_STATUSES = [
  { value: 'not_connected', label: 'Not Connected' },
  { value: 'pending', label: 'Request Sent' },
  { value: 'connected', label: 'Connected' },
];

export function sequenceStatusLabel(status) {
  return SEQUENCE_STATUSES.find((s) => s.value === status)?.label || status || '—';
}

export function enrollmentStatusLabel(status) {
  return ENROLLMENT_STATUSES.find((s) => s.value === status)?.label || status || '—';
}

export function stepTypeLabel(type) {
  return STEP_TYPES.find((s) => s.value === type)?.label || type || '—';
}

export function formatSendDays(sendDays) {
  if (!sendDays) return '—';
  const labels = SEND_DAYS.filter((d) => sendDays & d.bit).map((d) => d.label);
  return labels.length ? labels.join(', ') : '—';
}

const TIMEZONE_ALIASES = {
  'Asia/Calcutta': 'Asia/Kolkata',
};

/** Canonical IANA timezone (e.g. Asia/Calcutta → Asia/Kolkata). */
export function normalizeSequenceTimezone(timezone) {
  const value = String(timezone || 'UTC').trim() || 'UTC';
  return TIMEZONE_ALIASES[value] || value;
}

/** HTML time input → HH:MM:SS for API. */
export function normalizeScheduledTime(time) {
  if (!time) return null;
  const parts = String(time).trim().split(':');
  if (parts.length < 2) return null;
  const hh = parts[0].padStart(2, '0');
  const mm = parts[1].padStart(2, '0');
  const ss = (parts[2] || '00').padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Wall-clock date + time in an IANA timezone → UTC ISO string for the API.
 * Example: 2026-08-31, 10:18, Asia/Kolkata → 2026-08-31T04:48:00.000Z
 */
export function buildScheduledAtIso(scheduledDate, scheduledTime, timezone) {
  if (!scheduledDate || !scheduledTime) return null;
  const time = normalizeScheduledTime(scheduledTime);
  if (!time) return null;
  const tz = normalizeSequenceTimezone(timezone);
  const [year, month, day] = scheduledDate.split('-').map(Number);
  const [hour, minute, second] = time.split(':').map(Number);
  if (!year || !month || !day) return null;

  let guessMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  for (let i = 0; i < 4; i += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(guessMs)).map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    guessMs += Date.UTC(year, month - 1, day, hour, minute, second) - asUtc;
  }

  return new Date(guessMs).toISOString();
}

/** Display an API instant in the sequence/step timezone (not browser default). */
export function formatDateTimeInTimezone(iso, timezone) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: normalizeSequenceTimezone(timezone),
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

/** ISO instant → value for `<input type="datetime-local">` in the given timezone. */
export function isoToDatetimeLocalInput(iso, timezone) {
  if (!iso) return '';
  const tz = normalizeSequenceTimezone(timezone);
  const date = new Date(iso);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** `<input type="datetime-local">` wall time in timezone → UTC ISO for API. */
export function datetimeLocalInputToIso(localValue, timezone) {
  if (!localValue) return null;
  const [datePart, timePart] = String(localValue).split('T');
  if (!datePart || !timePart) return null;
  return buildScheduledAtIso(datePart, timePart, timezone);
}

/** Compare API timestamps (ISO strings) within one minute. */
export function sameScheduleInstant(a, b) {
  if (!a || !b) return false;
  const aMs = new Date(a).getTime();
  const bMs = new Date(b).getTime();
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return false;
  return Math.abs(aMs - bMs) < 60_000;
}

/** Primary schedule label — exact date/time per corrected plan. */
export function formatStepSchedule(step, fallbackTimezone = 'UTC') {
  if (!step) return '—';
  const date = step.scheduled_date;
  const time = step.scheduled_time;
  if (!date) {
    if (step.wait_value != null && step.wait_unit) {
      const u = step.wait_unit;
      return step.wait_value ? `Wait ${step.wait_value} ${u}` : 'Immediately';
    }
    return '—';
  }
  const tz = normalizeSequenceTimezone(step.timezone || fallbackTimezone);
  const timePart = time ? ` ${time}` : '';
  return `${date}${timePart} (${tz})`;
}

export function emptySequenceForm(ownerId = '') {
  return {
    name: '',
    description: '',
    sending_email: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    send_window_start: '09:00',
    send_window_end: '18:00',
    send_days: DEFAULT_SEND_DAYS,
    daily_send_limit: 100,
    stop_on_reply: true,
    stop_on_click: false,
    stop_on_unsubscribe: true,
    stop_on_bounce: true,
    allow_re_enrollment: false,
    owner_id: ownerId,
  };
}

function defaultScheduledDate(order) {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, (order - 1) * 2));
  return d.toISOString().slice(0, 10);
}

export function emptyStepVariant(key = 'A') {
  return {
    variant_key: key,
    subject: '',
    html_body: '',
    text_body: '',
    template_id: '',
  };
}

export function emptyStepForm(order = 1, sequenceTimezone = 'UTC') {
  return {
    step_order: order,
    type: 'AUTO_EMAIL',
    scheduled_date: defaultScheduledDate(order),
    scheduled_time: '10:00',
    timezone: sequenceTimezone,
    template_id: '',
    subject: '',
    html_body: '',
    text_body: '',
    task_title: '',
    task_description: '',
    variants: [emptyStepVariant('A'), emptyStepVariant('B')],
    active: true,
  };
}

export function isAbEmailStep(step) {
  return step?.type === 'AB_EMAIL';
}

export function isEmailStep(type) {
  return type === 'AUTO_EMAIL' || type === 'AB_EMAIL';
}

export function isLinkedInStep(type) {
  return type === 'LINKEDIN_CONNECTION' || type === 'LINKEDIN_MESSAGE' || type === 'LINKEDIN_FOLLOWUP';
}

export function isManualTaskStep(type) {
  return isLinkedInStep(type) || type === 'CALL';
}

/** Client-side preview merge (server renders on send). */
export function renderTemplatePreview(template, sample = {}) {
  if (!template) return '';
  const ctx = {
    first_name: sample.first_name || 'Alex',
    last_name: sample.last_name || 'Smith',
    company_name: sample.company_name || sample.company || 'Acme Corp',
    email: sample.email || 'alex@example.com',
    phone: sample.phone || sample.mobile || '',
    owner_name: sample.owner_name || 'Sales Rep',
    job_title: sample.job_title || sample.title || 'Director',
  };
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => ctx[key] ?? '');
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** True when the string already looks like HTML markup (not plain text with newlines). */
export function looksLikeHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

/**
 * Convert plain-text email bodies (with newlines) into HTML so clients like Outlook
 * keep paragraph breaks. Leaves real HTML content unchanged.
 */
export function ensureEmailHtmlBody(value) {
  const raw = String(value || '');
  if (!raw.trim()) return '';
  if (looksLikeHtml(raw)) return raw;

  const escaped = escapeHtml(raw);
  return escaped
    .split(/\r?\n\r?\n/)
    .map((para) => {
      const withBreaks = para.replace(/\r?\n/g, '<br />');
      return `<p style="margin:0 0 12px 0;">${withBreaks}</p>`;
    })
    .join('');
}

/** Rough HTML → plain text for the text/plain part of the email. */
export function htmlToPlainText(value) {
  if (!value) return '';
  if (!looksLikeHtml(value)) return String(value);
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function memberRefFromRecord(record, memberType) {
  return { member_type: memberType, member_id: record.id };
}

export function replyRatePercent(stats) {
  const sent = stats?.sent ?? stats?.emails_sent ?? stats?.sent_count ?? 0;
  const replied = stats?.replied ?? stats?.reply_count ?? 0;
  if (!sent) return '—';
  return `${Math.round((replied / sent) * 100)}%`;
}

export function normalizeStepFromApi(step) {
  if (!step) return step;
  const variants = step.variants?.length
    ? step.variants
    : (step.type === 'AB_EMAIL' ? [emptyStepVariant('A'), emptyStepVariant('B')] : []);
  return { ...step, variants };
}
