'use client';
import { useEffect, useRef } from 'react';
import {
  isNoteBodyEmpty,
  looksLikeMarkdown,
  markdownToHtml,
  noteBodyToHtml,
  sanitizeNoteHtml,
} from '../../lib/noteRichText.js';

function ToolbarButton({ label, onMouseDown, title }) {
  return (
    <button
      type="button"
      title={title || label}
      className="px-2 py-1 text-xs rounded border border-zoho-border bg-white text-zoho-text hover:bg-gray-50"
      onMouseDown={onMouseDown}
    >
      {label}
    </button>
  );
}

/**
 * Rich-text note editor (contentEditable). Stores HTML; paste converts Markdown.
 */
export default function NoteRichTextEditor({
  value = '',
  onChange,
  disabled = false,
  minHeight = 120,
  placeholder = 'Add a note…',
  className = '',
}) {
  const editorRef = useRef(null);
  const lastValueRef = useRef(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const next = noteBodyToHtml(value);
    if (next === lastValueRef.current && el.innerHTML === next) return;
    if (el.innerHTML !== next) el.innerHTML = next || '';
    lastValueRef.current = next;
  }, [value, disabled]);

  const emit = () => {
    const html = sanitizeNoteHtml(editorRef.current?.innerHTML || '');
    lastValueRef.current = html;
    onChange?.(isNoteBodyEmpty(html) ? '' : html);
  };

  const run = (cmd, arg) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg ?? null);
    emit();
  };

  const onPaste = (e) => {
    if (disabled) return;
    const html = e.clipboardData?.getData('text/html');
    const text = e.clipboardData?.getData('text/plain') || '';
    if (html && /<\/?[a-z]/i.test(html) && !looksLikeMarkdown(text)) {
      // Let the browser paste HTML (Word / Docs / CRM copy).
      return;
    }
    if (!text.trim()) return;
    e.preventDefault();
    const insert = looksLikeMarkdown(text) || text.includes('\n')
      ? markdownToHtml(text)
      : markdownToHtml(text);
    document.execCommand('insertHTML', false, sanitizeNoteHtml(insert || text));
    emit();
  };

  return (
    <div className={`rounded-lg border border-zoho-border overflow-hidden bg-white ${disabled ? 'opacity-60' : ''} ${className}`}>
      {!disabled && (
        <div className="flex flex-wrap gap-1 p-1.5 bg-gray-50 border-b border-zoho-border">
          <ToolbarButton label={<strong>B</strong>} title="Bold" onMouseDown={(e) => { e.preventDefault(); run('bold'); }} />
          <ToolbarButton label={<em>I</em>} title="Italic" onMouseDown={(e) => { e.preventDefault(); run('italic'); }} />
          <ToolbarButton label={<span className="underline">U</span>} title="Underline" onMouseDown={(e) => { e.preventDefault(); run('underline'); }} />
          <ToolbarButton label="H2" title="Heading" onMouseDown={(e) => { e.preventDefault(); run('formatBlock', 'h2'); }} />
          <ToolbarButton label="H3" title="Subheading" onMouseDown={(e) => { e.preventDefault(); run('formatBlock', 'h3'); }} />
          <ToolbarButton label="• List" title="Bullet list" onMouseDown={(e) => { e.preventDefault(); run('insertUnorderedList'); }} />
          <ToolbarButton label="1. List" title="Numbered list" onMouseDown={(e) => { e.preventDefault(); run('insertOrderedList'); }} />
        </div>
      )}
      <div
        ref={editorRef}
        className="px-3 py-2 text-sm text-zoho-text leading-relaxed outline-none focus:ring-0 note-rich-body empty:before:content-[attr(data-placeholder)] empty:before:text-zoho-muted empty:before:pointer-events-none"
        style={{ minHeight }}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
      />
    </div>
  );
}

/** Read-only rendered note body (HTML or legacy markdown/plain). */
export function NoteBody({ body, className = '' }) {
  const html = noteBodyToHtml(body);
  if (!html) return null;
  return (
    <div
      className={`note-rich-body text-sm text-zoho-text leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
