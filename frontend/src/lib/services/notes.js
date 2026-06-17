import api from '../api.js';

function normalizeNote(note) {
  if (!note) return note;
  return {
    ...note,
    body: note.body || note.content || '',
  };
}

export async function listNotes(relatedType, relatedId) {
  const res = await api.get('/notes', { params: { related_type: relatedType, related_id: relatedId } });
  const rows = Array.isArray(res.data) ? res.data : res.data?.data || [];
  return rows.map(normalizeNote);
}

export async function createNote(relatedType, relatedId, content) {
  const res = await api.post('/notes', { content, related_type: relatedType, related_id: relatedId });
  return normalizeNote(res.data?.data ?? res.data);
}

export async function updateNote(noteId, content) {
  const res = await api.patch(`/notes/${noteId}`, { content });
  return normalizeNote(res.data?.data ?? res.data);
}

export async function deleteNote(noteId) {
  await api.delete(`/notes/${noteId}`);
}
