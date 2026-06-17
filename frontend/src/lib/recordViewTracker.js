const STORAGE_KEY = 'crm_viewed_records';

function readStore() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeStore(store) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** Mark a record as viewed (read) in local storage. */
export function markRecordViewed(entityType, recordId) {
  if (!entityType || !recordId) return;
  const store = readStore();
  const key = `${entityType}:${recordId}`;
  store[key] = Date.now();
  writeStore(store);
}

export function isRecordUnread(entityType, recordId) {
  if (!entityType || !recordId) return false;
  const store = readStore();
  return !store[`${entityType}:${recordId}`];
}

/** Filter list rows to records the user has not opened yet. */
export function filterUnreadRecords(records, entityType, getId = (r) => r.id) {
  return records.filter((r) => isRecordUnread(entityType, getId(r)));
}
