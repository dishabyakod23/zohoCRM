import { ownerName } from './recordHelpers.js';

const PHONE_IN_TEXT_RE = /(\+?[\d][\d\s()./-]{6,}\d)/g;

const ENTITY_PRIORITY = {
  contact: 4,
  lead: 3,
  account: 2,
};

export function phoneDigits(raw) {
  if (raw == null || raw === '') return '';
  return String(raw).replace(/\D/g, '');
}

/** Keys used for fuzzy phone matching (full digits + common local suffix). */
export function phoneMatchKeys(raw) {
  const digits = phoneDigits(raw);
  if (!digits || digits.length < 7) return [];

  const keys = new Set([digits]);
  if (digits.length > 10) keys.add(digits.slice(-10));
  if (digits.length === 11 && digits.startsWith('1')) keys.add(digits.slice(1));
  return [...keys];
}

export function recordDisplayName(record) {
  if (!record) return '';
  const person = `${record.first_name || ''} ${record.last_name || ''}`.trim();
  if (person) return person;
  if (record.company) return record.company;
  if (record.name) return record.name;
  return '';
}

export function buildPhoneLookupIndex(records = []) {
  const index = new Map();

  for (const { record, entityType, phoneFields } of records) {
    const name = recordDisplayName(record);
    if (!name) continue;

    const priority = ENTITY_PRIORITY[entityType] ?? 0;
    const entry = {
      name,
      entityType,
      id: record.id,
      priority,
      owner_id: record.owner_id || null,
      owner_name: ownerName(record) || record.owner_name || null,
      phone: null,
    };

    for (const field of phoneFields) {
      const value = record[field];
      if (!value) continue;
      for (const key of phoneMatchKeys(value)) {
        const existing = index.get(key);
        const nextEntry = { ...entry, phone: value };
        if (!existing || priority > existing.priority) {
          index.set(key, nextEntry);
        }
      }
    }
  }

  return index;
}

export function createPhoneLookup(index) {
  return {
    resolve(raw) {
      for (const key of phoneMatchKeys(raw)) {
        const match = index.get(key);
        if (match) return match;
      }
      return null;
    },
    replaceInText(text) {
      if (!text) return text;
      return String(text).replace(PHONE_IN_TEXT_RE, (match) => {
        const resolved = this.resolve(match);
        return resolved?.name || match;
      });
    },
  };
}

export function extractCloudTalkPhone(log) {
  return (
    log?.meta?.external_number
    || log?.meta?.cdr?.public_external
    || log?.meta?.cdr?.public_internal
    || null
  );
}
