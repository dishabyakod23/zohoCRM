import api from '../api.js';

export function normalizeNote(note) {
  if (!note) return note;
  return {
    ...note,
    body: note.body || note.content || '',
  };
}

const ENTITY_NOTE_PATHS = {
  lead: (id) => `/leads/${id}/notes`,
  contact: (id) => `/contacts/${id}/notes`,
  account: (id) => `/accounts/${id}/notes`,
};

function entityNotesPath(relatedType, relatedId) {
  const build = ENTITY_NOTE_PATHS[relatedType];
  return build ? build(relatedId) : null;
}

export async function listNotes(relatedType, relatedId) {
  const base = entityNotesPath(relatedType, relatedId);
  if (!base) return [];
  const res = await api.get(base);
  return (res.data?.data || []).map(normalizeNote);
}

export async function createNote(relatedType, relatedId, body) {
  const base = entityNotesPath(relatedType, relatedId);
  if (!base) throw new Error(`Notes not supported for ${relatedType}`);
  const res = await api.post(base, { body });
  return normalizeNote(res.data?.data ?? res.data);
}

export async function updateNote(relatedType, relatedId, noteId, body) {
  const base = entityNotesPath(relatedType, relatedId);
  if (!base) throw new Error(`Notes not supported for ${relatedType}`);
  const res = await api.patch(`${base}/${noteId}`, { body });
  return normalizeNote(res.data?.data ?? res.data);
}

export async function deleteNote(relatedType, relatedId, noteId) {
  const base = entityNotesPath(relatedType, relatedId);
  if (!base) throw new Error(`Notes not supported for ${relatedType}`);
  await api.delete(`${base}/${noteId}`);
}
