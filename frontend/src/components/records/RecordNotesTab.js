'use client';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as notesApi from '../../lib/services/notes.js';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function RecordNotesTab({ relatedType, recordId, canEdit = false }) {
  const { showToast } = useToast();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadNotes = useCallback(async () => {
    if (!relatedType || !recordId) return;
    setLoading(true);
    try {
      setNotes(await notesApi.listNotes(relatedType, recordId));
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [relatedType, recordId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      const note = await notesApi.createNote(relatedType, recordId, noteText.trim());
      setNotes((prev) => [note, ...prev]);
      setNoteText('');
      showToast('Note added', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (note) => {
    setEditingId(note.id);
    setEditText(note.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async (noteId) => {
    if (!editText.trim()) {
      showToast('Note cannot be empty');
      return;
    }
    setUpdatingId(noteId);
    try {
      const updated = await notesApi.updateNote(relatedType, recordId, noteId, editText.trim());
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, ...updated, body: updated.body } : n)));
      cancelEdit();
      showToast('Note updated', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setUpdatingId(null);
    }
  };

  const removeNote = async (noteId) => {
    setDeletingId(noteId);
    try {
      await notesApi.deleteNote(relatedType, recordId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (editingId === noteId) cancelEdit();
      showToast('Note deleted', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card p-5">
      {canEdit && (
        <div className="flex gap-2 mb-4">
          <textarea
            className="input flex-1 min-h-[72px] resize-y"
            placeholder="Add a note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <button type="button" onClick={addNote} disabled={saving || !noteText.trim()} className="btn-primary text-xs self-end">
            {saving ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      )}
      {loading ? (
        <p className="text-sm text-zoho-muted">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-zoho-muted">No notes yet</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => {
            const isEditing = editingId === n.id;
            return (
              <div key={n.id} className="text-sm bg-brand-50/60 border border-zoho-border/60 p-3 rounded-xl">
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      className="input min-h-[72px] resize-y w-full"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={cancelEdit} className="btn-secondary text-xs">Cancel</button>
                      <button type="button" onClick={() => saveEdit(n.id)} disabled={updatingId === n.id || !editText.trim()} className="btn-primary text-xs">
                        {updatingId === n.id ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-zoho-text whitespace-pre-wrap flex-1">{n.body}</p>
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => startEdit(n)} className="p-1 text-zoho-muted hover:text-brand-600 rounded" aria-label="Edit note" title="Edit">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => removeNote(n.id)} disabled={deletingId === n.id} className="p-1 text-zoho-muted hover:text-red-600 rounded" aria-label="Delete note" title="Delete">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {(n.owner_name || n.created_at) && (
                      <p className="text-[11px] text-zoho-muted mt-2">
                        {n.owner_name}{n.owner_name && n.created_at ? ' · ' : ''}{n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
