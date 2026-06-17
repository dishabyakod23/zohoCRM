import api from '../api.js';

export function normalizeNote(note) {
  if (!note) return note;
  return {
    ...note,
    body: note.body || note.content || '',
  };
}

const LEAD_RELATED_TYPE = 'lead';

/** Lead notes use GET/POST/PATCH/DELETE /leads/{id}/notes per hosted API spec */
function isLeadNotes(relatedType) {
  return relatedType === LEAD_RELATED_TYPE;
}

export async function listNotes(relatedType, relatedId) {
  if (isLeadNotes(relatedType)) {
    const res = await api.get(`/leads/${relatedId}/notes`);
    return (res.data?.data || []).map(normalizeNote);
  }
  try {
    const res = await api.get('/notes', { params: { related_type: relatedType, related_id: relatedId } });
    const rows = Array.isArray(res.data) ? res.data : res.data?.data || [];
    return rows.map(normalizeNote);
  } catch {
    return [];
  }
}

export async function createNote(relatedType, relatedId, body) {
  if (isLeadNotes(relatedType)) {
    const res = await api.post(`/leads/${relatedId}/notes`, { body });
    return normalizeNote(res.data?.data ?? res.data);
  }
  const res = await api.post('/notes', { content: body, related_type: relatedType, related_id: relatedId });
  return normalizeNote(res.data?.data ?? res.data);
}

export async function updateNote(relatedType, relatedId, noteId, body) {
  if (isLeadNotes(relatedType)) {
    const res = await api.patch(`/leads/${relatedId}/notes/${noteId}`, { body });
    return normalizeNote(res.data?.data ?? res.data);
  }
  const res = await api.patch(`/notes/${noteId}`, { content: body });
  return normalizeNote(res.data?.data ?? res.data);
}

export async function deleteNote(relatedType, relatedId, noteId) {
  if (isLeadNotes(relatedType)) {
    await api.delete(`/leads/${relatedId}/notes/${noteId}`);
    return;
  }
  await api.delete(`/notes/${noteId}`);
}
