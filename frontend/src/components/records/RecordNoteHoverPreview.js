'use client';
import { formatNoteTime } from '../../lib/noteHelpers.js';
import { NoteBody } from './NoteRichTextEditor.js';

function NotesBadge() {
  return (
    <span className="inline-block bg-zoho-text text-white text-[10px] font-semibold px-2 py-0.5 rounded">
      Notes
    </span>
  );
}

export default function RecordNoteHoverPreview({ note, moduleLabel, recordLabel, loading = false }) {
  if (loading) {
    return (
      <div className="w-72 bg-white border border-zoho-border rounded-lg shadow-card-hover px-4 pt-3 pb-4 text-sm">
        <NotesBadge />
        <p className="text-zoho-muted mt-3">Loading notes…</p>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="w-72 bg-white border border-zoho-border rounded-lg shadow-card-hover px-4 pt-3 pb-4 text-sm">
        <NotesBadge />
        <p className="text-zoho-muted mt-3">No notes yet</p>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border border-zoho-border rounded-lg shadow-card-hover overflow-hidden text-sm">
      <div className="px-4 pt-3 pb-2">
        <NotesBadge />
      </div>
      <div className="px-4 pt-1 pb-3">
        <p className="text-xs font-semibold text-zoho-text mb-2">Last Added Note</p>
        <div className="mb-3 line-clamp-4 overflow-hidden">
          <NoteBody body={note.body} />
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-zoho-border/60">
          <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
          <div className="min-w-0 text-[11px] text-zoho-muted">
            <span className="text-brand-600">{moduleLabel} - {recordLabel}</span>
            <span className="mx-1">·</span>
            <span>{formatNoteTime(note.created_at)}{note.owner_name ? ` by ${note.owner_name}` : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
