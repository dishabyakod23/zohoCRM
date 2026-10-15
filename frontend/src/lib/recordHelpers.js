import { ROLE_LABELS } from './roles.js';

const LEGACY_ROLE_LABELS = ['Sales Manager', 'Business Rep'];
const GENERIC_PERSON_LABELS = new Set(
  [...Object.values(ROLE_LABELS), ...LEGACY_ROLE_LABELS, 'Admin', 'System', 'Unknown'].map((s) => s.toLowerCase()),
);

/** True when a "name" is actually a role placeholder ("Super Admin") rather than a real person's name. */
export function isGenericRoleName(name) {
  return GENERIC_PERSON_LABELS.has(String(name || '').trim().toLowerCase());
}

/** Prefer a person's real name; fall back to their email when the stored name is just a role label. */
export function personDisplayName({ name, email } = {}) {
  const trimmed = String(name || '').trim();
  if (trimmed && !isGenericRoleName(trimmed)) return trimmed;
  return email || trimmed || null;
}

export function ownerName(record) {
  if (!record?.owner) return record?.owner_name || null;
  const name = `${record.owner.first_name || ''} ${record.owner.last_name || ''}`.trim();
  return personDisplayName({ name, email: record.owner.email }) || record.owner_name || null;
}

export function parseLookupOptions(data, labelFn) {
  if (!Array.isArray(data) || data.length === 0) return [];
  return data.map((item) => {
    if (typeof item === 'string') return { value: item, label: labelFn ? labelFn(item) : item };
    const value = item.value ?? item.key ?? item.code ?? item.id;
    const label = item.label ?? item.name ?? item.display_name ?? item.title ?? (labelFn ? labelFn(value) : value);
    return { value, label };
  }).filter((item) => item.value);
}

function insensitiveKey(value) {
  return String(value || '').trim().toLowerCase();
}

/** Prefer mixed/title case over an all-lowercase duplicate (`Apollo.io` over `apollo.io`). */
export function preferredCasedLabel(current, candidate) {
  const a = String(current || '').trim();
  const b = String(candidate || '').trim();
  if (!a) return b;
  if (!b) return a;
  const aCaps = (a.match(/[A-Z]/g) || []).length;
  const bCaps = (b.match(/[A-Z]/g) || []).length;
  if (bCaps !== aCaps) return bCaps > aCaps ? b : a;
  return a.length >= b.length ? a : b;
}

/** Collapse lookup options that differ only by capitalization. */
export function dedupeLookupOptionsInsensitive(options = []) {
  const byKey = new Map();
  for (const option of options) {
    if (!option) continue;
    const value = option.value ?? option.label;
    const label = option.label ?? value;
    const key = insensitiveKey(label) || insensitiveKey(value);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...option, value, label });
      continue;
    }
    const preferredLabel = preferredCasedLabel(existing.label, label);
    const preferredValue = preferredCasedLabel(existing.value, value);
    byKey.set(key, { ...existing, ...option, value: preferredValue, label: preferredLabel });
  }
  return Array.from(byKey.values());
}

/** Sum report rows whose labels differ only by capitalization. */
export function mergeCountRowsInsensitive(rows = [], { nameKey = 'label', countKey = 'count' } = {}) {
  const byKey = new Map();
  for (const row of rows) {
    if (!row) continue;
    const rawName = row[nameKey] ?? row.label ?? row.name ?? row.value;
    const key = insensitiveKey(rawName);
    if (!key) continue;
    const count = Number(row[countKey] ?? row.count ?? row.value ?? 0) || 0;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...row, [nameKey]: String(rawName ?? '').trim(), [countKey]: count });
      continue;
    }
    byKey.set(key, {
      ...existing,
      ...row,
      [nameKey]: preferredCasedLabel(existing[nameKey], rawName),
      [countKey]: (Number(existing[countKey]) || 0) + count,
    });
  }
  return Array.from(byKey.values());
}

export function recordDetailHref(entityType, recordId) {
  if (!entityType || recordId == null) return null;
  const routes = {
    lead: '/leads',
    contact: '/contacts',
    account: '/accounts',
    deal: '/deals',
    task: '/tasks',
    call: '/calls',
    meeting: '/calendar',
    campaign: '/campaigns',
    document: '/documents',
    visit: '/visits',
    project: '/projects',
  };
  const base = routes[entityType];
  return base ? `${base}/${recordId}` : null;
}

export function relatedRecordFromActivity(record) {
  if (record?.related_type && record?.related_id) {
    const type = record.related_type;
    const label = record.related_name
      || record.account_name
      || record.contact_name
      || `${type.charAt(0).toUpperCase()}${type.slice(1)} #${record.related_id}`;
    return { type, id: record.related_id, label };
  }
  if (record?.contact_id) {
    return {
      type: 'contact',
      id: record.contact_id,
      label: record.contact_name || `Contact #${record.contact_id}`,
    };
  }
  if (record?.account_id) {
    return {
      type: 'account',
      id: record.account_id,
      label: record.account_name || `Account #${record.account_id}`,
    };
  }
  return null;
}
