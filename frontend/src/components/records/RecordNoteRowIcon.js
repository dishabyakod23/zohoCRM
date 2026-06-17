'use client';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import RecordNoteHoverPreview from './RecordNoteHoverPreview.js';

function NoteIconSvg({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6m-6 8l-2 2V6a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2H7z" />
    </svg>
  );
}

export default function RecordNoteRowIcon({ latestNote, noteCount = 0, moduleLabel, recordLabel, onOpen }) {
  const btnRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState(null);

  const showPreview = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.top, left: rect.right + 8 });
    setHover(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        onMouseEnter={showPreview}
        onMouseLeave={() => setHover(false)}
        className={`w-7 h-7 rounded border flex items-center justify-center transition-colors shrink-0 ${
          noteCount > 0
            ? 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100'
            : 'border-zoho-border/80 bg-white text-zoho-muted hover:border-brand-200 hover:text-brand-600'
        }`}
        aria-label={noteCount ? `${noteCount} notes` : 'Notes'}
        title="Notes"
      >
        <NoteIconSvg className="w-3.5 h-3.5" />
      </button>
      {hover && pos && typeof document !== 'undefined' && createPortal(
        <div className="fixed z-[100] pointer-events-none" style={{ top: pos.top, left: pos.left }}>
          <RecordNoteHoverPreview note={latestNote} moduleLabel={moduleLabel} recordLabel={recordLabel} />
        </div>,
        document.body,
      )}
    </>
  );
}
