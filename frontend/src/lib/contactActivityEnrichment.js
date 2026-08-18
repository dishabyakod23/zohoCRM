import { formatCallDuration } from './services/cloudTalkCalls.js';
import { phoneMatchKeys, phoneDigits } from './phoneLookup.js';
import { matchesDateRange } from './listRecordFilters.js';
import { buildOutreachActivityIndex, getLinkedInRequestSent } from './outreachActivity.js';
import { leadStatusLabel } from './leadHelpers.js';
import { directoryLeadStatusValue } from './contactDirectoryHelpers.js';

function formatActivityDateTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatContactLastCallLabel(call) {
  if (!call?.created_at) return '—';
  const when = formatActivityDateTime(call.created_at);
  if (call.status === 'missed' || !call.duration) {
    return `missed on ${when}`;
  }
  return `connected (${formatCallDuration(call.duration)}) on ${when}`;
}

function callMeta(log) {
  const cdr = log.meta?.cdr || {};
  const duration = Number(log.meta?.duration ?? cdr.talking_time ?? cdr.billsec) || 0;
  const type = String(cdr.type || (log.summary?.includes('Incoming') ? 'incoming' : 'outgoing')).toLowerCase();
  const status = log.summary?.includes('missed') || duration === 0 ? 'missed' : 'answered';
  const phone = log.meta?.external_number
    || cdr.public_external
    || cdr.public_internal
    || null;
  return { duration, type, status, phone, created_at: log.created_at };
}

/** Latest answered/missed call per phone key from CloudTalk activity logs. */
export function buildLatestCallByPhoneKey(calls = []) {
  const byKey = new Map();

  for (const log of calls || []) {
    if (log.source !== 'cloudtalk') continue;
    const meta = callMeta(log);
    if (!meta.phone) continue;

    for (const key of phoneMatchKeys(meta.phone)) {
      const existing = byKey.get(key);
      if (!existing || new Date(meta.created_at) > new Date(existing.created_at)) {
        byKey.set(key, {
          ...meta,
          caller_name: log.user_name,
          contact_name: log.resolved_contact?.name || log.meta?.contact_name || null,
          contact_id: log.resolved_contact?.id || null,
          summary: log.summary,
        });
      }
    }
  }

  return byKey;
}

function resolveCallForRow(row, callByPhone) {
  const phones = [row.phone, row.mobile, row.other_phone, row.home_phone, row.asst_phone].filter(Boolean);
  for (const phone of phones) {
    for (const key of phoneMatchKeys(phone)) {
      const match = callByPhone.get(key);
      if (match) return match;
    }
  }
  return null;
}

function resolveActivitiesForRow(row, outreachIndex, latestCall) {
  const recordId = String(row.record_id || row.id || '').split(':').pop();
  const activities = [...(outreachIndex[recordId] || [])];

  if (latestCall?.created_at) {
    activities.push({ type: 'call', at: latestCall.created_at, user_id: latestCall.user_id });
  }

  return activities;
}

export function rowMatchesActivityDateRange(row, { activity_from, activity_to }, {
  outreachIndex = {},
  callByPhone = new Map(),
} = {}) {
  if (!activity_from && !activity_to) return true;
  const latestCall = resolveCallForRow(row, callByPhone);
  const activities = resolveActivitiesForRow(row, outreachIndex, latestCall);
  if (!activities.length) return false;
  return activities.some((activity) => matchesDateRange(activity.at, activity_from, activity_to));
}

export function enrichContactDirectoryRows(rows = [], {
  calls = [],
  outreachIndex = null,
  statusOptions = [],
} = {}) {
  const callByPhone = buildLatestCallByPhoneKey(calls);
  const outreach = outreachIndex || buildOutreachActivityIndex();

  return (rows || []).map((row) => {
    const recordId = String(row.record_id || row.id || '').split(':').pop();
    const latestCall = resolveCallForRow(row, callByPhone);
    const linkedinEntry = getLinkedInRequestSent(recordId)
      || (row.linkedin_request_sent_at ? { sent_at: row.linkedin_request_sent_at } : null);

    const rawLeadStatus = directoryLeadStatusValue(row);
    const lead_status_label = rawLeadStatus
      ? (leadStatusLabel(rawLeadStatus, statusOptions) || rawLeadStatus)
      : '—';

    return {
      ...row,
      lead_status: rawLeadStatus || null,
      lead_status_label,
      linkedin_request_sent: Boolean(linkedinEntry?.sent_at),
      linkedin_request_sent_at: linkedinEntry?.sent_at || null,
      linkedin_request_label: linkedinEntry?.sent_at ? 'Yes' : 'No',
      last_call: latestCall,
      last_call_label: formatContactLastCallLabel(latestCall),
      _activityIndex: resolveActivitiesForRow(row, outreach, latestCall),
    };
  });
}

export function filterRowsByActivityDate(rows = [], filters = {}, {
  outreachIndex = null,
  calls = [],
} = {}) {
  if (!filters.activity_from && !filters.activity_to) return rows;
  const callByPhone = buildLatestCallByPhoneKey(calls);
  const outreach = outreachIndex || buildOutreachActivityIndex();
  return rows.filter((row) => rowMatchesActivityDateRange(row, filters, { outreachIndex: outreach, callByPhone }));
}
