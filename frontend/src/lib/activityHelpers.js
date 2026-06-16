import { ownerName } from './recordHelpers.js';

export function userBriefName(user) {
  if (!user) return '—';
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || '—';
}

export function assigneeName(record) {
  return userBriefName(record?.assigned_to) || userBriefName(record?.owner) || ownerName(record) || '—';
}

export function formatEnumLabel(value) {
  if (!value) return '—';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function toIsoDatetime(localValue) {
  if (!localValue) return null;
  const d = new Date(localValue);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function toDateOnly(value) {
  if (!value) return null;
  return value.slice(0, 10);
}

export function listResult(res) {
  return {
    data: res.data.data || [],
    total: res.data.meta?.total ?? 0,
    meta: res.data.meta,
  };
}

export function omitEmpty(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '' && v !== null) out[k] = v;
  }
  return out;
}
