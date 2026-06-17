'use client';
import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useRecordNotes } from '../../hooks/useRecordNotes.js';
import { formatNoteTime } from '../../lib/noteHelpers.js';

export default function RecordNotesSidePanel({
  open,
  onClose,
  relatedType,
  recordId,
  recordLabel,
  moduleLabel,
  canEdit = false,
  onNotesChange,
}) {
  const notes = useRecordNotes(relatedType, recordId);

  useEffect(() => {
    if (open && onNotesChange && !notes.loading) {
      onNotesChange(notes.notes);
    }
  }, [open, notes.notes, notes.loading, onNotesChange]);

  if (!open) return null;

  const handleAdd = async () => {
    await notes.addNote();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slideInRight">
        <button
          type="button"
          onClick={onClose}
          className="absolute -left-10 top-4 w-8 h-8 rounded-full bg-white border border-zoho-border shadow flex items-center justify-center text-zoho-muted hover:text-zoho-text"
          aria-label="Close notes"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>

        <div className="px-5 py-4 border-b border-zoho-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base font-semibold text-zoho-text">Notes</h2>
            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">{notes.notes.length}</span>
            <span className="text-xs text-zoho-muted truncate">{recordLabel}</span>
          </div>
          <select
            className="input text-xs w-32 py-1 shrink-0"
            value={notes.sortOrder}
            onChange={(e) => notes.setSortOrder(e.target.value)}
          >
            <option value="recent_last">Recent Last</option>
            <option value="recent_first">Recent First</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {notes.loading ? (
            <p className="text-sm text-zoho-muted">Loading notes…</p>
          ) : notes.notes.length === 0 ? (
            <p className="text-sm text-zoho-muted">No notes yet. Add one below.</p>
          ) : (
            notes.notes.map((n) => {
              const isEditing = notes.editingId === n.id;
              return (
                <div key={n.id} className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          className="input min-h-[72px] resize-y w-full text-sm"
                          value={notes.editText}
                          onChange={(e) => notes.setEditText(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={notes.cancelEdit} className="btn-secondary text-xs">Cancel</button>
                          <button type="button" onClick={() => notes.saveEdit(n.id)} disabled={notes.updatingId === n.id} className="btn-primary text-xs">
                            {notes.updatingId === n.id ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-zoho-text whitespace-pre-wrap">{n.body}</p>
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1.5 text-[11px] text-zoho-muted">
                          <span className="text-brand-600">{moduleLabel} - {recordLabel}</span>
                          {canEdit && (
                            <>
                              <button type="button" onClick={() => notes.startEdit(n)} className="text-brand-600 hover:underline">Edit</button>
                              <button type="button" onClick={() => notes.removeNote(n.id)} disabled={notes.deletingId === n.id} className="text-red-600 hover:underline">Delete</button>
                            </>
                          )}
                          <span>{formatNoteTime(n.created_at)}{n.owner_name ? ` by ${n.owner_name}` : ''}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {canEdit && (
          <div className="px-5 py-4 border-t border-zoho-border bg-gray-50/80">
            <textarea
              className="input w-full min-h-[80px] resize-y text-sm"
              placeholder="Add a note"
              value={notes.noteText}
              onChange={(e) => notes.setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd();
              }}
            />
            <div className="flex justify-end mt-2">
              <button type="button" onClick={handleAdd} disabled={notes.saving || !notes.noteText.trim()} className="btn-primary text-xs">
                {notes.saving ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
