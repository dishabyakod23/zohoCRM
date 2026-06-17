'use client';
import { formatNoteTime } from '../../lib/noteHelpers.js';

export default function RecordNoteHoverPreview({ note, moduleLabel, recordLabel }) {
  if (!note) {
    return (
      <div className="w-72 bg-white border border-zoho-border rounded-lg shadow-card-hover p-4 text-sm">
        <span className="inline-block bg-zoho-text text-white text-[10px] font-semibold px-2 py-0.5 rounded -mt-7 mb-2">Notes</span>
        <p className="text-zoho-muted">No notes yet</p>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border border-zoho-border rounded-lg shadow-card-hover overflow-hidden text-sm">
      <span className="inline-block bg-zoho-text text-white text-[10px] font-semibold px-2 py-0.5 rounded ml-3 -mt-3 relative z-10">Notes</span>
      <div className="px-4 pt-2 pb-3">
        <p className="text-xs font-semibold text-zoho-text mb-2">Last Added Note</p>
        <p className="text-zoho-text leading-relaxed mb-3 line-clamp-4">{note.body}</p>
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
