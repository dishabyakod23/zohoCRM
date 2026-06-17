'use client';
import { useState } from 'react';
import FormField, { inputClass } from '../forms/FormField.js';

/**
 * Section card that displays fields read-only with per-section Edit → Save/Cancel.
 * @param {{ name: string, label: string, required?: boolean, colSpan?: boolean, format?: (v) => string, render?: (draft, setDraft) => React.ReactNode }} fields
 */
export default function EditableFieldSection({
  title,
  canEdit = true,
  fields = [],
  values = {},
  onSave,
  saving = false,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});

  const startEdit = () => {
    const initial = {};
    fields.forEach((f) => { initial[f.name] = values[f.name] ?? ''; });
    setDraft(initial);
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = async () => {
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // Stay in edit mode when save fails; onSave shows the error toast.
    }
  };

  const display = (f) => {
    const v = values[f.name];
    if (f.format) return f.format(v);
    if (v === null || v === undefined || v === '') return null;
    return String(v);
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-zoho-muted uppercase tracking-wider">{title}</h3>
        {canEdit && !editing && (
          <button type="button" onClick={startEdit} className="text-xs font-medium text-brand-600 hover:text-brand-700">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.name} className={f.colSpan ? 'sm:col-span-2' : ''}>
                <FormField label={f.label} required={f.required}>
                  {f.render
                    ? f.render(draft, setDraft)
                    : (
                      <input
                        className={inputClass()}
                        value={draft[f.name] ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, [f.name]: e.target.value }))}
                      />
                    )}
                </FormField>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-5 justify-end pt-4 border-t border-zoho-border/60">
            <button type="button" onClick={cancel} className="btn-secondary text-xs">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="btn-primary text-xs">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          {fields.map((f) => (
            <div key={f.name} className={f.colSpan ? 'sm:col-span-2' : ''}>
              <dt className="text-[11px] text-zoho-muted font-medium uppercase tracking-wider mb-1">{f.label}</dt>
              <dd className="text-zoho-text">{display(f) ?? <span className="text-zoho-muted/50">—</span>}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
