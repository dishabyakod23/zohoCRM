import api from '../api.js';
import { noteOwnerId } from '../noteHelpers.js';

export function normalizeNote(note) {
  if (!note) return note;
  return {
    ...note,
    body: note.body || note.content || '',
    owner_name: note.owner_name || note.created_by_name || note.author_name || '',
    owner_id: noteOwnerId(note) || note.owner_id || '',
  };
}

function entityParams(relatedType, relatedId) {
  return {
    entity_type: relatedType,
    entity_id: relatedId,
    related_type: relatedType,
    related_id: relatedId,
  };
}

function noteCreatePayload(relatedType, relatedId, body) {
  return {
    ...entityParams(relatedType, relatedId),
    body,
    content: body,
  };
}

function parseListResponse(res) {
  const raw = res.data?.data ?? res.data;
  const rows = Array.isArray(raw) ? raw : [];
  return rows.map(normalizeNote);
}

function parseSingleResponse(res) {
  const raw = res.data?.data ?? res.data;
  return normalizeNote(raw);
}

/** GET /notes?entity_type=&entity_id= */
export async function listNotes(relatedType, relatedId) {
  if (!relatedType || !relatedId) return [];
  const res = await api.get('/notes', { params: entityParams(relatedType, relatedId) });
  return parseListResponse(res);
}

/** Entity types GET /notes/batch supports, and its id limit per request. */
const NOTES_BATCH_TYPES = new Set(['lead', 'contact', 'account']);
export const NOTES_BATCH_LIMIT = 200;

let pendingNotesBatch = null;

/** True when a list can load this type's notes for every row in one batched request. */
export function supportsNotesBatch(relatedType) {
  return NOTES_BATCH_TYPES.has(relatedType);
}

/** Group a flat notes list by entity_id (string keys). */
export function groupNotesByEntity(notes = []) {
  const byId = new Map();
  for (const note of notes) {
    const key = String(note.entity_id ?? note.related_id ?? '');
    if (!key) continue;
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key).push(note);
  }
  return byId;
}

async function flushNotesBatch() {
  const batch = pendingNotesBatch;
  pendingNotesBatch = null;
  const requests = [];
  for (const [entityType, waiters] of batch) {
    const ids = [...waiters.keys()];
    for (let i = 0; i < ids.length; i += NOTES_BATCH_LIMIT) {
      const chunk = ids.slice(i, i + NOTES_BATCH_LIMIT);
      requests.push(
        api.get('/notes/batch', { params: { entity_type: entityType, entity_ids: chunk.join(',') } })
          .then((res) => {
            const byId = groupNotesByEntity(parseListResponse(res));
            for (const id of chunk) waiters.get(id).forEach(({ resolve }) => resolve(byId.get(id) || []));
          })
          .catch((err) => {
            for (const id of chunk) waiters.get(id).forEach(({ reject }) => reject(err));
          }),
      );
    }
  }
  await Promise.all(requests);
}

/**
 * Same result as listNotes, but rows that ask in the same tick (e.g. every note icon on a
 * list page) share one GET /notes/batch request per entity type, chunked to 200 ids.
 */
export function listNotesBatched(relatedType, relatedId) {
  if (!relatedType || !relatedId) return Promise.resolve([]);
  if (!NOTES_BATCH_TYPES.has(relatedType)) return listNotes(relatedType, relatedId);
  if (!pendingNotesBatch) {
    pendingNotesBatch = new Map();
    setTimeout(flushNotesBatch, 0);
  }
  if (!pendingNotesBatch.has(relatedType)) pendingNotesBatch.set(relatedType, new Map());
  const waiters = pendingNotesBatch.get(relatedType);
  const key = String(relatedId);
  if (!waiters.has(key)) waiters.set(key, []);
  return new Promise((resolve, reject) => waiters.get(key).push({ resolve, reject }));
}

/** POST /notes */
export async function createNote(relatedType, relatedId, body) {
  if (!relatedType || !relatedId) throw new Error('Related record is required');
  const res = await api.post('/notes', noteCreatePayload(relatedType, relatedId, body));
  return parseSingleResponse(res);
}

/** PATCH /notes/{note_id} */
export async function updateNote(_relatedType, _relatedId, noteId, body) {
  const res = await api.patch(`/notes/${noteId}`, { body, content: body });
  return parseSingleResponse(res);
}

/** DELETE /notes/{note_id} */
export async function deleteNote(_relatedType, _relatedId, noteId) {
  await api.delete(`/notes/${noteId}`);
}

/**
 * Copy notes from one record to another after convert (API does not reparent notes).
 * Skips empty bodies and bodies already present on the target (case-insensitive).
 */
export async function migrateRecordNotes(fromType, fromId, toType, toId) {
  if (!fromType || !fromId || !toType || !toId) return { migrated: 0 };
  if (String(fromType) === String(toType) && String(fromId) === String(toId)) {
    return { migrated: 0 };
  }

  const [source, existing] = await Promise.all([
    listNotes(fromType, fromId).catch(() => []),
    listNotes(toType, toId).catch(() => []),
  ]);
  if (!source.length) return { migrated: 0 };

  const seen = new Set(
    (existing || [])
      .map((n) => String(n.body || '').trim().toLowerCase())
      .filter(Boolean),
  );

  let migrated = 0;
  for (const note of source) {
    const body = String(note.body || '').trim();
    if (!body) continue;
    const key = body.toLowerCase();
    if (seen.has(key)) continue;
    try {
      await createNote(toType, toId, body);
      seen.add(key);
      migrated += 1;
    } catch {
      // Keep converting even if one note fails to copy.
    }
  }
  return { migrated };
}
