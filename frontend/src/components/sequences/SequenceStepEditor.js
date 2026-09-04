'use client';
import { useEffect, useMemo, useState } from 'react';
import FormField from '../forms/FormField.js';
import TimezoneSelect from '../forms/TimezoneSelect.js';
import EmailHtmlEditor from '../forms/EmailHtmlEditor.js';
import {
  STEP_TYPES,
  TEMPLATE_VARIABLES,
  renderTemplatePreview,
  ensureEmailHtmlBody,
  isEmailStep,
  isAbEmailStep,
  isLinkedInStep,
  isManualTaskStep,
  formatStepSchedule,
  normalizeSequenceTimezone,
} from '../../lib/sequenceHelpers.js';
import { listEmailTemplates, templateLabel } from '../../lib/services/emailTemplates.js';
import * as sequencesApi from '../../lib/services/sequences.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';

function VariantEditor({ variant, onChange, templates, readOnly }) {
  const applyTemplate = (templateId) => {
    const t = templates.find((x) => String(x.id) === String(templateId));
    if (!t) return;
    onChange({
      ...variant,
      template_id: templateId,
      subject: t.subject || variant.subject,
      html_body: t.html_body || t.body || variant.html_body,
      text_body: t.text_body || variant.text_body,
    });
  };

  return (
    <div className="rounded-lg border border-zoho-border p-3 space-y-3 bg-gray-50/50">
      <p className="text-xs font-semibold text-brand-700">Variant {variant.variant_key}</p>
      <FormField label="Template">
        <select
          className="input"
          value={variant.template_id || ''}
          disabled={readOnly}
          onChange={(e) => applyTemplate(e.target.value)}
        >
          <option value="">Custom content</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{templateLabel(t)}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Subject">
        <input className="input" value={variant.subject || ''} disabled={readOnly} onChange={(e) => onChange({ ...variant, subject: e.target.value })} />
      </FormField>
      <FormField label="HTML body (what recipients see)">
        <EmailHtmlEditor
          value={variant.html_body || ''}
          disabled={readOnly}
          minHeight={100}
          onChange={(html_body) => onChange({ ...variant, html_body })}
        />
      </FormField>
    </div>
  );
}

export default function SequenceStepEditor({
  step,
  onChange,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  stepIndex,
  sequenceId,
  sequenceTimezone = 'UTC',
  readOnly = false,
}) {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    listEmailTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const previewSubject = useMemo(
    () => renderTemplatePreview(step.subject || step.variants?.[0]?.subject),
    [step.subject, step.variants],
  );
  const previewBodyHtml = useMemo(() => {
    const merged = renderTemplatePreview(
      step.html_body || step.text_body || step.variants?.[0]?.html_body,
    );
    return ensureEmailHtmlBody(merged);
  }, [step.html_body, step.text_body, step.variants]);

  const update = (patch) => onChange({ ...step, ...patch });

  const applyTemplate = (templateId) => {
    const t = templates.find((x) => String(x.id) === String(templateId));
    if (!t) {
      update({ template_id: templateId });
      return;
    }
    update({
      template_id: templateId,
      subject: t.subject || step.subject,
      html_body: t.html_body || t.body || step.html_body,
      text_body: t.text_body || step.text_body,
    });
  };

  const sendTest = async () => {
    if (!sequenceId || !step.id) {
      showToast('Save the step before sending a test');
      return;
    }
    setSendingTest(true);
    try {
      await sequencesApi.sendSequenceTest(sequenceId, { step_id: step.id, to_email: testEmail || undefined });
      showToast('Test email queued', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="border border-zoho-border rounded-xl bg-white p-4 space-y-4 relative">
      <div className="absolute left-1/2 -bottom-3 w-px h-6 bg-zoho-border hidden md:block" aria-hidden="true" />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide">Step {stepIndex}</p>
          <p className="text-sm font-medium text-zoho-text">{formatStepSchedule(step, sequenceTimezone)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!readOnly && onMoveUp && (
            <button type="button" onClick={onMoveUp} className="text-xs text-zoho-muted hover:text-brand-600">↑</button>
          )}
          {!readOnly && onMoveDown && (
            <button type="button" onClick={onMoveDown} className="text-xs text-zoho-muted hover:text-brand-600">↓</button>
          )}
          {!readOnly && onDuplicate && (
            <button type="button" onClick={onDuplicate} className="text-xs text-zoho-muted hover:text-brand-600">Duplicate</button>
          )}
          {!readOnly && onDelete && (
            <button type="button" onClick={onDelete} className="text-xs text-red-600 hover:underline">Remove</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Action Type">
          <select className="input" value={step.type} disabled={readOnly} onChange={(e) => update({ type: e.target.value })}>
            {STEP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Active">
          <label className="inline-flex items-center gap-2 text-sm mt-2">
            <input type="checkbox" checked={step.active !== false} disabled={readOnly} onChange={(e) => update({ active: e.target.checked })} />
            Enabled
          </label>
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Scheduled Date" required>
          <input className="input" type="date" value={step.scheduled_date || ''} disabled={readOnly} onChange={(e) => update({ scheduled_date: e.target.value })} />
        </FormField>
        <FormField label="Scheduled Time" required>
          <input className="input" type="time" value={step.scheduled_time || ''} disabled={readOnly} onChange={(e) => update({ scheduled_time: e.target.value })} />
        </FormField>
        <FormField label="Timezone">
          <TimezoneSelect
            value={normalizeSequenceTimezone(step.timezone || sequenceTimezone)}
            disabled={readOnly}
            onChange={(timezone) => update({ timezone })}
          />
        </FormField>
      </div>

      {isEmailStep(step.type) && !isAbEmailStep(step) && (
        <>
          <FormField label="Email Template">
            <select className="input" value={step.template_id || ''} disabled={readOnly} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">Custom content</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{templateLabel(t)}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Subject">
            <input className="input" value={step.subject || ''} disabled={readOnly} onChange={(e) => update({ subject: e.target.value })} />
          </FormField>
          <FormField label="HTML body (what recipients see)">
            <EmailHtmlEditor
              value={step.html_body || ''}
              disabled={readOnly}
              minHeight={140}
              onChange={(html_body) => update({ html_body })}
            />
          </FormField>
          <FormField label="Plain text body (optional fallback)">
            <textarea className="input min-h-[80px] font-mono text-xs" value={step.text_body || ''} disabled={readOnly} onChange={(e) => update({ text_body: e.target.value })} placeholder="Leave blank to auto-generate from the HTML body" />
            <p className="text-[11px] text-zoho-muted mt-1">
              Used only as the text/plain part for clients that cannot show HTML. The formatted HTML body is what Outlook and Gmail display.
            </p>
          </FormField>
        </>
      )}

      {isAbEmailStep(step) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(step.variants || []).map((variant, vi) => (
            <VariantEditor
              key={variant.variant_key || vi}
              variant={variant}
              templates={templates}
              readOnly={readOnly}
              onChange={(next) => {
                const variants = [...(step.variants || [])];
                variants[vi] = next;
                update({ variants });
              }}
            />
          ))}
        </div>
      )}

      {isManualTaskStep(step.type) && (
        <>
          <FormField label={isLinkedInStep(step.type) ? 'LinkedIn Task Title' : 'Call Title'}>
            <input className="input" value={step.task_title || ''} disabled={readOnly} onChange={(e) => update({ task_title: e.target.value })} />
          </FormField>
          <FormField label="Instructions / Notes">
            <textarea className="input min-h-[80px]" value={step.task_description || ''} disabled={readOnly} onChange={(e) => update({ task_description: e.target.value })} />
          </FormField>
          <p className="text-xs text-zoho-muted">LinkedIn and call steps are performed manually by the salesperson. The CRM tracks due dates and completion.</p>
        </>
      )}

      {isEmailStep(step.type) && (
        <div className="rounded-lg bg-gray-50 border border-zoho-border p-3">
          <p className="text-xs font-semibold text-zoho-muted mb-2">Email Preview</p>
          <p className="text-sm font-medium">{previewSubject || '—'}</p>
          {previewBodyHtml ? (
            <div
              className="text-sm mt-3 text-zoho-text leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
            />
          ) : (
            <p className="text-xs text-zoho-muted mt-2">—</p>
          )}
        </div>
      )}

      {isEmailStep(step.type) && !readOnly && sequenceId && (
        <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-zoho-border">
          <FormField label="Send test to">
            <input className="input" type="email" placeholder="you@company.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          </FormField>
          <button type="button" onClick={sendTest} disabled={sendingTest} className="btn-secondary-sm mb-0.5">
            {sendingTest ? 'Sending…' : 'Send Test'}
          </button>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-zoho-muted mb-2">Merge fields</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_VARIABLES.map((v) => (
            <code key={v.key} className="text-[11px] px-2 py-1 rounded bg-brand-50 text-brand-700">{`{{${v.key}}}`}</code>
          ))}
        </div>
      </div>
    </div>
  );
}
