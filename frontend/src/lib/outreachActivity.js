const STORAGE_KEY = 'crm_outreach_activity';

function readStore() {
  if (typeof window === 'undefined') return { linkedin: {}, emails: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { linkedin: {}, emails: {} };
  } catch {
    return { linkedin: {}, emails: {} };
  }
}

function writeStore(store) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getLinkedInRequestSent(contactId) {
  if (!contactId) return null;
  const store = readStore();
  return store.linkedin?.[String(contactId)] || null;
}

export function isLinkedInRequestSent(contactId) {
  return Boolean(getLinkedInRequestSent(contactId)?.sent_at);
}

export function setLinkedInRequestSent(contactId, { sent, user } = {}) {
  if (!contactId) return null;
  const store = readStore();
  const key = String(contactId);

  if (!sent) {
    delete store.linkedin[key];
    writeStore(store);
    return null;
  }

  const entry = {
    sent_at: new Date().toISOString(),
    user_id: user?.id || null,
    user_name: user?.name || null,
  };
  store.linkedin[key] = entry;
  writeStore(store);
  return entry;
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
