const STORAGE_KEY = 'crm_cloudtalk_call_log';
const MAX_ENTRIES = 500;
const MAX_AGE_DAYS = 30;

function readStore() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(entries) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function pruneEntries(entries) {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return entries
    .filter((entry) => {
      const ts = new Date(entry.created_at || entry.ended_at || entry.started_at).getTime();
      return !Number.isNaN(ts) && ts >= cutoff;
    })
    .slice(0, MAX_ENTRIES);
}

export function getStoredCloudTalkCalls({ userId, days = MAX_AGE_DAYS } = {}) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return pruneEntries(readStore()).filter((entry) => {
    const ts = new Date(entry.created_at || entry.ended_at || entry.started_at).getTime();
    if (Number.isNaN(ts) || ts < cutoff) return false;
    if (!userId) return true;
    return entry.user_id === userId;
  });
}

export function upsertStoredCloudTalkCall(entry) {
  if (!entry?.id) return;
  const entries = pruneEntries(readStore());
  const index = entries.findIndex((item) => item.id === entry.id);
  if (index >= 0) entries[index] = { ...entries[index], ...entry };
  else entries.unshift(entry);
  writeStore(pruneEntries(entries));
}

export function removeStoredCloudTalkCalls(ids = []) {
  if (!ids.length) return;
  const idSet = new Set(ids);
  writeStore(readStore().filter((entry) => !idSet.has(entry.id)));
}
