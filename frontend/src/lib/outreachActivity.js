const STORAGE_KEY = 'crm_outreach_activity';

function bareRecordId(contactId) {
  const raw = String(contactId || '').trim();
  if (!raw) return '';
  // List rows may use "contact:uuid" / "lead:uuid"; always store/lookup by bare id.
  const splitAt = raw.indexOf(':');
  if (splitAt > 0) return raw.slice(splitAt + 1);
  return raw;
}

function readStore() {
  if (typeof window === 'undefined') return { linkedin: {}, emails: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      linkedin: parsed.linkedin && typeof parsed.linkedin === 'object' ? parsed.linkedin : {},
      emails: parsed.emails && typeof parsed.emails === 'object' ? parsed.emails : {},
    };
  } catch {
    return { linkedin: {}, emails: {} };
  }
}

function writeStore(store) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    linkedin: store.linkedin || {},
    emails: store.emails || {},
  }));
}

export function getLinkedInRequestSent(contactId) {
  if (!contactId) return null;
  const store = readStore();
  const key = String(contactId);
  if (store.linkedin[key]) return store.linkedin[key];
  const bare = bareRecordId(contactId);
  if (bare && store.linkedin[bare]) return store.linkedin[bare];
  return null;
}

export function isLinkedInRequestSent(contactId) {
  return Boolean(getLinkedInRequestSent(contactId)?.sent_at);
}

export function setLinkedInRequestSent(contactId, { sent, user } = {}) {
  if (!contactId) return null;
  const store = readStore();
  const key = bareRecordId(contactId) || String(contactId);
  const composite = String(contactId);

  if (!sent) {
    delete store.linkedin[key];
    if (composite !== key) delete store.linkedin[composite];
    writeStore(store);
    return null;
  }

  if (composite !== key) delete store.linkedin[composite];

  const entry = {
    sent_at: new Date().toISOString(),
    user_id: user?.id || null,
    user_name: user?.name || null,
  };
  store.linkedin[key] = entry;
  writeStore(store);
  return entry;
}

/** Mark many contacts as LinkedIn-request-sent (same timestamp/user). Returns count updated. */
export function bulkSetLinkedInRequestSent(contactIds, { sent = true, user } = {}) {
  const ids = (contactIds || []).filter(Boolean);
  if (!ids.length) return { updated: 0, sent_at: null };
  let updated = 0;
  let sent_at = null;
  for (const id of ids) {
    const entry = setLinkedInRequestSent(id, { sent, user });
    if (sent && entry?.sent_at) {
      sent_at = entry.sent_at;
      updated += 1;
    } else if (!sent) {
      updated += 1;
    }
  }
  return { updated, sent_at };
}

export function logEmailSent(contactId, { user } = {}) {
  if (!contactId) return null;
  const store = readStore();
  const key = String(contactId);
  const entry = {
    sent_at: new Date().toISOString(),
    user_id: user?.id || null,
    user_name: user?.name || null,
  };
  if (!store.emails[key]) store.emails[key] = [];
  store.emails[key].push(entry);
  writeStore(store);
  return entry;
}

export function getEmailSentEvents(contactId) {
  if (!contactId) return [];
  const store = readStore();
  return store.emails?.[String(contactId)] || [];
}

/** All outreach timestamps keyed by contact id for list filtering and enrichment. */
export function buildOutreachActivityIndex() {
  const store = readStore();
  const byContactId = {};

  for (const [contactId, entry] of Object.entries(store.linkedin || {})) {
    if (!byContactId[contactId]) byContactId[contactId] = [];
    byContactId[contactId].push({ type: 'linkedin', at: entry.sent_at, user_id: entry.user_id });
  }

  for (const [contactId, events] of Object.entries(store.emails || {})) {
    for (const event of events || []) {
      if (!byContactId[contactId]) byContactId[contactId] = [];
      byContactId[contactId].push({ type: 'email', at: event.sent_at, user_id: event.user_id });
    }
  }

  return byContactId;
}

export function formatLinkedInRequestLabel(entry) {
  if (!entry?.sent_at) return 'No';
  const date = new Date(entry.sent_at);
  if (Number.isNaN(date.getTime())) return 'Yes';
  return `Yes · ${date.toLocaleDateString()}`;
}
