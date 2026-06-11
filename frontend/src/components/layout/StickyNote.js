'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'crm_sticky_note';
const NOTE_COLORS = ['#fff9c4', '#ffcdd2', '#c8e6c9', '#bbdefb', '#e1bee7', '#ffe0b2'];

const DEFAULT_CONTENT = `You can pin personal sticky notes to your screens for jotting down vital information, setting reminders, and keeping a watch on important tasks. You can also update the content and formatting of your own sticky note.`;

const DEFAULT_STATE = {
  color: '#fff9c4',
  content: DEFAULT_CONTENT,
  x: null,
  y: null,
  width: 380,
  height: 300,
  pinned: false,
  reminder: null,
};

function loadState() {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!stored) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...stored };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(state) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ToolbarBtn({ title, onClick, active, children, className = '' }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded text-[#5a5a5a] hover:bg-black/5 ${active ? 'bg-black/10' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export default function StickyNote({ visible, onClose }) {
  const [note, setNote] = useState(DEFAULT_STATE);
  const [showColors, setShowColors] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [reminderInput, setReminderInput] = useState('');
  const editorRef = useRef(null);
  const noteRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  useEffect(() => {
    const loaded = loadState();
    if (loaded.x == null || loaded.y == null) {
      loaded.x = Math.max(80, window.innerWidth - loaded.width - 48);
      loaded.y = Math.max(72, window.innerHeight - loaded.height - 80);
    }
    setNote(loaded);
    setReminderInput(loaded.reminder || '');
  }, []);

  useEffect(() => {
    if (!visible || !editorRef.current) return;
    if (editorRef.current.innerHTML !== note.content) {
      editorRef.current.innerHTML = note.content || '';
    }
  }, [visible, note.content]);

  const persist = useCallback((patch) => {
    setNote(prev => {
      const next = { ...prev, ...patch };
      saveState(next);
      return next;
    });
  }, []);

  const exec = (cmd, value) => {
    document.execCommand(cmd, false, value ?? null);
    editorRef.current?.focus();
    persist({ content: editorRef.current?.innerHTML || '' });
  };

  const onContentInput = () => {
    persist({ content: editorRef.current?.innerHTML || '' });
  };

  const onDelete = () => {
    if (!confirm('Delete this sticky note?')) return;
    const reset = {
      ...DEFAULT_STATE,
      x: note.x,
      y: note.y,
      width: note.width,
      height: note.height,
    };
    saveState(reset);
    setNote(reset);
    if (editorRef.current) editorRef.current.innerHTML = DEFAULT_CONTENT;
    onClose?.();
  };

  const onPin = () => persist({ pinned: !note.pinned });

  const onColor = (color) => {
    persist({ color });
    setShowColors(false);
  };

  const onReminderSave = () => {
    persist({ reminder: reminderInput || null });
    setShowReminder(false);
  };

  useEffect(() => {
    const onMove = (e) => {
      if (dragRef.current) {
        const { startX, startY, origX, origY } = dragRef.current;
        persist({
          x: Math.max(0, origX + e.clientX - startX),
          y: Math.max(0, origY + e.clientY - startY),
        });
      }
      if (resizeRef.current) {
        const { startX, startY, origW, origH } = resizeRef.current;
        persist({
          width: Math.max(280, origW + e.clientX - startX),
          height: Math.max(200, origH + e.clientY - startY),
        });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [persist]);

  if (!visible) return null;

  return (
    <div
      ref={noteRef}
      className="sticky-note fixed z-[60] flex flex-col rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-[#e8d87a]/60 select-none"
      style={{
        left: note.x,
        top: note.y,
        width: note.width,
        height: note.height,
        backgroundColor: note.color,
      }}
    >
      {/* Top action bar */}
      <div
        className="flex items-center justify-end gap-0.5 px-2 pt-2 pb-1 cursor-move shrink-0"
        onMouseDown={e => {
          if (e.target.closest('button')) return;
          dragRef.current = { startX: e.clientX, startY: e.clientY, origX: note.x, origY: note.y };
        }}
      >
        <div className="relative">
          <button
            type="button"
            title="Change color"
            onClick={() => setShowColors(v => !v)}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/5"
          >
            <span className="w-4 h-4 rounded-full border border-[#c9b84c]" style={{ backgroundColor: note.color }} />
            <svg className="w-2 h-2 ml-0.5 text-[#666]" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
          </button>
          {showColors && (
            <div className="absolute top-8 right-0 bg-white rounded shadow-lg border border-gray-200 p-2 flex gap-1.5 z-10">
              {NOTE_COLORS.map(c => (
                <button key={c} type="button" onClick={() => onColor(c)}
                  className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            title="Set reminder"
            onClick={() => setShowReminder(v => !v)}
            className={`w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 ${note.reminder ? 'text-brand-600' : 'text-[#5a5a5a]'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {showReminder && (
            <div className="absolute top-8 right-0 bg-white rounded shadow-lg border border-gray-200 p-3 z-10 w-52">
              <p className="text-xs font-medium text-gray-700 mb-2">Reminder</p>
              <input
                type="datetime-local"
                className="input text-xs mb-2"
                value={reminderInput}
                onChange={e => setReminderInput(e.target.value)}
              />
              <div className="flex gap-2">
                <button type="button" onClick={onReminderSave} className="btn-primary text-xs flex-1">Save</button>
                <button type="button" onClick={() => { setReminderInput(''); persist({ reminder: null }); setShowReminder(false); }} className="btn-secondary text-xs">Clear</button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          title={note.pinned ? 'Unpin' : 'Pin to screen'}
          onClick={onPin}
          className={`w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 ${note.pinned ? 'text-brand-600' : 'text-[#5a5a5a]'}`}
        >
          <svg className="w-4 h-4" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z" />
          </svg>
        </button>

        <button type="button" title="Delete" onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded text-[#5a5a5a] hover:bg-black/5 hover:text-red-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-0 px-2 pb-1 border-b border-black/5 shrink-0 flex-wrap">
        <ToolbarBtn title="Font size" onClick={() => exec('fontSize', '4')}>
          <span className="text-sm font-serif font-bold">T</span>
        </ToolbarBtn>
        <ToolbarBtn title="Bold" onClick={() => exec('bold')}>
          <span className="text-sm font-bold">B</span>
        </ToolbarBtn>
        <ToolbarBtn title="Italic" onClick={() => exec('italic')}>
          <span className="text-sm italic">I</span>
        </ToolbarBtn>
        <ToolbarBtn title="Underline" onClick={() => exec('underline')}>
          <span className="text-sm underline">U</span>
        </ToolbarBtn>
        <ToolbarBtn title="Strikethrough" onClick={() => exec('strikeThrough')}>
          <span className="text-sm line-through">S</span>
        </ToolbarBtn>
        <ToolbarBtn title="Text color" onClick={() => exec('foreColor', '#d32f2f')}>
          <span className="text-sm font-bold relative">A<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" /></span>
        </ToolbarBtn>
        <ToolbarBtn title="Highlight" onClick={() => exec('hiliteColor', '#fff59d')}>
          <span className="text-sm font-bold bg-yellow-200 px-0.5">A</span>
        </ToolbarBtn>
        <ToolbarBtn title="Bullet list" onClick={() => exec('insertUnorderedList')}>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" /></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Numbered list" onClick={() => exec('insertOrderedList')}>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" /></svg>
        </ToolbarBtn>
      </div>

      {/* Editable content */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={onContentInput}
        className="sticky-note-editor flex-1 overflow-auto px-4 py-3 text-sm text-[#333] leading-relaxed outline-none min-h-0"
        style={{ wordBreak: 'break-word' }}
      />

      {/* Resize handle */}
      <div
        className="absolute bottom-1 right-1 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5"
        onMouseDown={e => {
          e.preventDefault();
          resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: note.width, origH: note.height };
        }}
      >
        <svg className="w-3 h-3 text-gray-400" viewBox="0 0 12 12" fill="currentColor">
          <path d="M12 12H8V10h2V8h2v4zM6 12H4v-2h2v2zM10 6H8V4h2v2z" />
        </svg>
      </div>
    </div>
  );
}

export function isStickyNotePinned() {
  if (typeof window === 'undefined') return false;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return !!stored?.pinned;
  } catch {
    return false;
  }
}
