'use client';
import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    const el = editorRef.current;
    if (!el || disabled) return;
    const next = value || '';
    if (next === lastValueRef.current) return;
    if (el.innerHTML !== next) {
      el.innerHTML = next || '';
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

  const insertLink = () => {
    if (disabled) return;
    const url = window.prompt('Link URL', 'https://');
    if (!url) return;
    run('createLink', url);
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
          <ToolbarButton label="Link" title="Insert hyperlink" onMouseDown={(e) => { e.preventDefault(); insertLink(); }} />
        </div>
      )}
      <div
        ref={editorRef}
        className="input !rounded-none !border-0 min-h-[120px] text-sm leading-relaxed focus:!ring-0"
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
    </div>
  );
}
