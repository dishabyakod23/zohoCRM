'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import RecordNoteHoverPreview from './RecordNoteHoverPreview.js';
import * as notesApi from '../../lib/services/notes.js';
import { RECORD_NOTES_CHANGED_EVENT } from '../../lib/recordUpdateEvents.js';

function NoteIconSvg({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6m-6 8l-2 2V6a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2H7z" />
    </svg>
  );
}

/** Strip `entity:uuid` row ids so notes API gets a bare record id. */
function bareRecordId(value) {
  const raw = String(value || '');
  const splitAt = raw.indexOf(':');
  if (splitAt > 0) return raw.slice(splitAt + 1);
  return raw;
}

export default function RecordNoteRowIcon({
  relatedType,
  recordId,
  moduleLabel,
  recordLabel,
  onOpen,
  latestNote: latestNoteProp,
  noteCount: noteCountProp = 0,
}) {
  const btnRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState(null);
  const [latestNote, setLatestNote] = useState(latestNoteProp || null);
  const [noteCount, setNoteCount] = useState(noteCountProp);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const requestIdRef = useRef(0);
  const notesRecordId = bareRecordId(recordId);

  const loadNotes = useCallback(async (force = false) => {
    if (!force && loaded) return;
    if (!relatedType || !notesRecordId) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const notes = await notesApi.listNotes(relatedType, notesRecordId);
      if (requestId !== requestIdRef.current) return;
      const sorted = [...notes].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
      setLatestNote(sorted[0] || null);
      setNoteCount(sorted.length);
      setLoaded(true);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setLatestNote(null);
      setNoteCount(0);
      setLoaded(false);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [relatedType, notesRecordId, loaded]);

  useEffect(() => {
    setLatestNote(latestNoteProp || null);
    setNoteCount(noteCountProp);
    setLoaded(false);
  }, [relatedType, notesRecordId, latestNoteProp, noteCountProp]);

  useEffect(() => {
    const onNotesChanged = (event) => {
      const { relatedType: type, recordId: id } = event.detail || {};
      if (type !== relatedType || String(id) !== String(notesRecordId)) return;
      setLoaded(false);
      loadNotes(true);
    };
    window.addEventListener(RECORD_NOTES_CHANGED_EVENT, onNotesChanged);
    return () => window.removeEventListener(RECORD_NOTES_CHANGED_EVENT, onNotesChanged);
  }, [relatedType, notesRecordId, loadNotes]);

  const showPreview = () => {
    loadNotes();
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.top, left: rect.right + 8 });
    setHover(true);
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    loadNotes().then(() => onOpen());
  };

  const displayCount = noteCountProp || noteCount;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        onMouseEnter={showPreview}
        onMouseLeave={() => setHover(false)}
        onFocus={() => loadNotes()}
        className={`w-7 h-7 rounded border flex items-center justify-center transition-colors shrink-0 ${
          displayCount > 0
            ? 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100'
            : 'border-zoho-border/80 bg-white text-zoho-muted hover:border-brand-200 hover:text-brand-600'
        }`}
        aria-label={displayCount ? `${displayCount} notes` : 'Notes'}
        title={loading ? 'Loading notes…' : 'Notes'}
      >
        <NoteIconSvg className="w-3.5 h-3.5" />
      </button>
      {hover && pos && typeof document !== 'undefined' && createPortal(
        <div className="fixed z-[100] pointer-events-none" style={{ top: pos.top, left: pos.left }}>
          <RecordNoteHoverPreview
            note={latestNote}
            loading={loading && !loaded}
            moduleLabel={moduleLabel}
            recordLabel={recordLabel}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
