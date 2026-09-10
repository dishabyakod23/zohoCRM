'use client';
import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal.js';
import FormField, { inputClass } from './FormField.js';

const FONT_FACES = [
  { value: 'Calibri, Candara, Segoe, Segoe UI, Optima, Arial, sans-serif', label: 'Calibri' },
  { value: 'Times New Roman, Times, serif', label: 'Times New Roman' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
];

const FONT_SIZES = [
  { value: '2', label: 'Small' },
  { value: '3', label: 'Normal' },
  { value: '4', label: 'Large' },
  { value: '5', label: 'X-Large' },
];

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeHref(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function ToolbarButton({ label, onMouseDown, active = false, title }) {
  return (
    <button
      type="button"
      title={title || label}
      className={`px-2 py-1 text-xs rounded border border-zoho-border ${active ? 'bg-brand-50 text-brand-700' : 'bg-white text-zoho-text hover:bg-gray-50'}`}
      onMouseDown={onMouseDown}
    >
      {label}
    </button>
  );
}

/**
 * Lightweight Outlook-oriented HTML email editor (contentEditable + execCommand).
 * Stores HTML suitable for Resend html_body; preview should match send.
 */
export default function EmailHtmlEditor({
  value = '',
  onChange,
  disabled = false,
  minHeight = 140,
  placeholder = 'Write your email…',
}) {
  const editorRef = useRef(null);
  const lastValueRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkText, setLinkText] = useState('');
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const next = value || '';
    // Always sync HTML into the DOM — including when disabled/read-only —
    // otherwise the box looks empty while Email Preview still shows content.
    if (next === lastValueRef.current && el.innerHTML === next) return;
    if (el.innerHTML !== next) {
      el.innerHTML = next;
    }
    lastValueRef.current = next;
  }, [value, disabled]);

  const emit = () => {
    const html = editorRef.current?.innerHTML || '';
    lastValueRef.current = html;
    onChange?.(html);
  };

  const run = (cmd, arg) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg ?? null);
    emit();
  };

  const openLinkDialog = () => {
    if (disabled) return;
    const sel = window.getSelection();
    let selectedText = '';
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      selectedText = sel.toString();
    } else {
      savedRangeRef.current = null;
    }
    setLinkUrl('https://');
    setLinkText(selectedText || '');
    setLinkError('');
    setLinkOpen(true);
  };

  const closeLinkDialog = () => {
    setLinkOpen(false);
    setLinkError('');
    savedRangeRef.current = null;
  };

  const applyLink = () => {
    const href = normalizeHref(linkUrl);
    if (!href || href === 'https://') {
      setLinkError('Enter a link URL.');
      return;
    }
    const display = String(linkText || '').trim() || href;
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      if (savedRangeRef.current) {
        try {
          sel.addRange(savedRangeRef.current);
        } catch {
          // Selection may be stale after modal focus; insert at end of editor.
        }
      }
    }
    const html = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(display)}</a>`;
    document.execCommand('insertHTML', false, html);
    emit();
    closeLinkDialog();
  };

  return (
    <div className={`rounded-lg border border-zoho-border overflow-hidden ${disabled ? 'opacity-60' : ''}`}>
      {!disabled && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 border-b border-zoho-border">
          <ToolbarButton label={<strong>B</strong>} title="Bold" onMouseDown={(e) => { e.preventDefault(); run('bold'); }} />
          <ToolbarButton label={<em>I</em>} title="Italic" onMouseDown={(e) => { e.preventDefault(); run('italic'); }} />
          <select
            className="input text-xs py-1 w-36"
            defaultValue=""
            title="Font"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              if (e.target.value) run('fontName', e.target.value);
              e.target.value = '';
            }}
          >
            <option value="">Font</option>
            {FONT_FACES.map((f) => (
              <option key={f.label} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            className="input text-xs py-1 w-28"
            defaultValue=""
            title="Font size"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              if (e.target.value) run('fontSize', e.target.value);
              e.target.value = '';
            }}
          >
            <option value="">Size</option>
            {FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <ToolbarButton label="Left" title="Align left" onMouseDown={(e) => { e.preventDefault(); run('justifyLeft'); }} />
          <ToolbarButton label="Center" title="Align center" onMouseDown={(e) => { e.preventDefault(); run('justifyCenter'); }} />
          <ToolbarButton label="Right" title="Align right" onMouseDown={(e) => { e.preventDefault(); run('justifyRight'); }} />
          <ToolbarButton label="• List" title="Bullet list" onMouseDown={(e) => { e.preventDefault(); run('insertUnorderedList'); }} />
          <ToolbarButton label="Link" title="Insert hyperlink" onMouseDown={(e) => { e.preventDefault(); openLinkDialog(); }} />
        </div>
      )}
      <div
        ref={editorRef}
        className="input !rounded-none !border-0 min-h-[120px] text-sm leading-relaxed focus:!ring-0 [&_a]:text-brand-600 [&_a]:underline"
        style={{ minHeight }}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
      />
      <p className="text-[11px] text-zoho-muted px-3 py-1.5 border-t border-zoho-border bg-white">
        Formatting is sent as HTML (Outlook/Gmail). Use blank lines for spacing. Preview below should match the sent email.
      </p>

      {linkOpen && (
        <Modal title="Insert hyperlink" onClose={closeLinkDialog}>
          <div className="space-y-4">
            <FormField label="Link text (name)" required error={linkError && !linkText.trim() && !linkUrl.trim() ? linkError : null}>
              <input
                className={inputClass()}
                value={linkText}
                placeholder="e.g. Book a demo"
                autoFocus
                onChange={(e) => setLinkText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }}
              />
            </FormField>
            <FormField label="Link URL" required error={linkError}>
              <input
                className={inputClass(linkError)}
                value={linkUrl}
                placeholder="https://example.com"
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  if (linkError) setLinkError('');
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }}
              />
            </FormField>
            <p className="text-xs text-zoho-muted">
              Recipients will see the link text as a clickable hyperlink that opens the URL.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={closeLinkDialog}>Cancel</button>
              <button type="button" className="btn-primary" onClick={applyLink}>Insert link</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
