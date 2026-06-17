import api from '../api.js';

export function normalizeNote(note) {
  if (!note) return note;
  return {
    ...note,
    body: note.body || note.content || '',
    owner_name: note.owner_name || note.created_by_name || note.author_name || '',
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
