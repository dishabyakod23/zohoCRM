'use client';
import { useState } from 'react';
import FormField, { inputClass } from '../forms/FormField.js';
import { validateRequired } from '../../lib/validators.js';
import { markRecordListStale } from '../../lib/recordUpdateEvents.js';

/**
 * Section card that displays fields read-only with per-section Edit → Save/Cancel.
 * @param {{ name: string, label: string, required?: boolean, requiredWhen?: (draft) => boolean, visibleWhen?: (draft) => boolean, colSpan?: boolean, readOnly?: boolean, format?: (v) => string, render?: (draft, setDraft) => React.ReactNode }} fields
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
  const [fieldErrors, setFieldErrors] = useState({});

  const isVisible = (f, ctx) => !f.visibleWhen || f.visibleWhen(ctx);
  const isRequired = (f, ctx) => Boolean(f.required || (typeof f.requiredWhen === 'function' && f.requiredWhen(ctx)));

  const startEdit = () => {
    const initial = {};
    fields.forEach((f) => {
      if (f.readOnly) return;
      initial[f.name] = values[f.name] ?? '';
    });
    setDraft(initial);
    setFieldErrors({});
    setEditing(true);
  };

  const cancel = () => {
    setFieldErrors({});
    setEditing(false);
  };

  const save = async () => {
    const requiredFields = {};
    fields.forEach((f) => {
      if (f.readOnly || !isVisible(f, draft)) return;
      if (isRequired(f, draft)) requiredFields[f.name] = f.label;
    });
    const errs = validateRequired(requiredFields, draft);
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await onSave(draft);
      markRecordListStale();
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

  const visibleFields = fields.filter((f) => isVisible(f, editing ? draft : values));

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
            {visibleFields.map((f) => (
              <div key={f.name} className={f.colSpan ? 'sm:col-span-2' : ''}>
                {f.readOnly ? (
                  <>
                    <p className="text-[11px] text-zoho-muted font-medium uppercase tracking-wider mb-1">{f.label}</p>
                    <p className="text-sm text-zoho-text">{display(f) ?? <span className="text-zoho-muted/50">—</span>}</p>
                  </>
                ) : (
                  <FormField label={f.label} required={isRequired(f, draft)} error={fieldErrors[f.name]}>
                    {f.render
                      ? f.render(draft, (updater) => {
                        setDraft(updater);
                        setFieldErrors((er) => ({ ...er, [f.name]: null }));
                      })
                      : (
                        <input
                          className={inputClass(fieldErrors[f.name])}
                          value={draft[f.name] ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDraft((d) => ({ ...d, [f.name]: value }));
                            setFieldErrors((er) => ({ ...er, [f.name]: null }));
                          }}
                        />
                      )}
                  </FormField>
                )}
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
          {visibleFields.map((f) => (
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
