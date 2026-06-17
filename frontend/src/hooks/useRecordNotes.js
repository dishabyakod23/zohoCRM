'use client';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../components/ui/Toast.js';
import { getApiError } from '../lib/api.js';
import * as notesApi from '../lib/services/notes.js';

export function useRecordNotes(relatedType, recordId) {
  const { showToast } = useToast();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [sortOrder, setSortOrder] = useState('recent_last');

  const loadNotes = useCallback(async () => {
    if (!relatedType || !recordId) return;
    setLoading(true);
    try {
      const rows = await notesApi.listNotes(relatedType, recordId);
      setNotes(rows);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [relatedType, recordId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const sortedNotes = [...notes].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return sortOrder === 'recent_first' ? ta - tb : tb - ta;
  });

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      const note = await notesApi.createNote(relatedType, recordId, noteText.trim());
      setNotes((prev) => [note, ...prev]);
      setNoteText('');
      showToast('Note added', 'success');
      return note;
    } catch (err) {
      showToast(getApiError(err));
      return null;
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
      const updated = await notesApi.updateNote(noteId, editText.trim());
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
      await notesApi.deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (editingId === noteId) cancelEdit();
      showToast('Note deleted', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setDeletingId(null);
    }
  };

  return {
    notes: sortedNotes,
    loading,
    noteText,
    setNoteText,
    saving,
    editingId,
    editText,
    setEditText,
    updatingId,
    deletingId,
    sortOrder,
    setSortOrder,
    loadNotes,
    addNote,
    startEdit,
    cancelEdit,
    saveEdit,
    removeNote,
  };
}
