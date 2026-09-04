'use client';
import { useEffect, useState } from 'react';
import AppLink from '../ui/AppLink.js';
import CRMLayout from '../layout/CRMLayout.js';
import FormField, { inputClass } from '../forms/FormField.js';
import TimezoneSelect from '../forms/TimezoneSelect.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';
import { fetchUsers } from '../../lib/services/lookups.js';
import * as sequencesApi from '../../lib/services/sequences.js';
import { emptySequenceForm, SEND_DAYS } from '../../lib/sequenceHelpers.js';
import { navigateToRecord, sequenceDetailHref } from '../../lib/recordNavigation.js';

const REQUIRED = {
  name: 'Sequence Name',
  sending_email: 'Sending Email',
};

function SectionTitle({ children }) {
  return (
    <h3 className="text-sm font-semibold text-zoho-text border-b border-zoho-border pb-3 mb-6 mt-10 first:mt-0">
      {children}
    </h3>
  );
}

export default function CreateSequenceForm() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState(() => emptySequenceForm(user?.id || ''));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (user?.id && !form.owner_id) setForm((f) => ({ ...f, owner_id: user.id }));
  }, [user?.id, form.owner_id]);

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => {});
  }, []);

  const toggleSendDay = (bit) => {
    setForm((f) => ({
      ...f,
      send_days: f.send_days & bit ? f.send_days & ~bit : f.send_days | bit,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validateRequired(REQUIRED, form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const created = await sequencesApi.createSequence(form);
      showToast('Sequence created', 'success');
      navigateToRecord(sequenceDetailHref(created.id));
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <AppLink href="/sequences" className="text-xs text-brand-600 hover:underline">← Sequences</AppLink>
        <h1 className="text-xl font-semibold text-zoho-text mt-2">Create Sequence</h1>
        <p className="text-sm text-zoho-muted mt-1">Configure sending rules, then add steps on the next screen.</p>

        <form onSubmit={handleSubmit} className="mt-6">
          <SectionTitle>Basic Info</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Sequence Name" required error={errors.name}>
              <input className={inputClass(errors.name)} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </FormField>
            <FormField label="Owner">
              <select className="input" value={form.owner_id} onChange={(e) => setForm((f) => ({ ...f, owner_id: e.target.value }))}>
                <option value="">Select owner</option>
                {users.map((u) => <option key={u.id || u.value} value={u.id || u.value}>{u.name}</option>)}
              </select>
            </FormField>
            <FormField label="Sending Email" required error={errors.sending_email} colSpan>
              <input className={inputClass(errors.sending_email)} type="email" value={form.sending_email} onChange={(e) => setForm((f) => ({ ...f, sending_email: e.target.value }))} placeholder="outreach@yourcompany.com" />
              <p className="text-xs text-zoho-muted mt-1.5">
                Must use an address on a domain verified in Resend (SPF, DKIM, DMARC). See docs/RESEND_SETUP.md.
              </p>
            </FormField>
            <FormField label="Description" colSpan>
              <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </FormField>
          </div>

          <SectionTitle>Schedule</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Timezone">
              <TimezoneSelect
                value={form.timezone}
                onChange={(timezone) => setForm((f) => ({ ...f, timezone }))}
              />
            </FormField>
            <FormField label="Send window start">
              <input className="input" type="time" value={form.send_window_start} onChange={(e) => setForm((f) => ({ ...f, send_window_start: e.target.value }))} />
            </FormField>
            <FormField label="Send window end">
              <input className="input" type="time" value={form.send_window_end} onChange={(e) => setForm((f) => ({ ...f, send_window_end: e.target.value }))} />
            </FormField>
            <FormField label="Send days" colSpan>
              <div className="flex flex-wrap gap-2">
                {SEND_DAYS.map((d) => (
                  <label key={d.bit} className="inline-flex items-center gap-1 text-xs border border-zoho-border rounded-lg px-2 py-1">
                    <input type="checkbox" checked={Boolean(form.send_days & d.bit)} onChange={() => toggleSendDay(d.bit)} />
                    {d.label}
                  </label>
                ))}
              </div>
            </FormField>
          </div>

          <SectionTitle>Limits &amp; Stop Rules</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Daily send limit">
              <input className="input" type="number" min={1} value={form.daily_send_limit} onChange={(e) => setForm((f) => ({ ...f, daily_send_limit: e.target.value }))} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-sm">
            {[
              ['stop_on_reply', 'Stop when recipient replies'],
              ['stop_on_click', 'Stop when link clicked'],
              ['stop_on_unsubscribe', 'Stop on unsubscribe'],
              ['stop_on_bounce', 'Stop on bounce'],
              ['allow_re_enrollment', 'Allow re-enrollment'],
            ].map(([key, label]) => (
              <label key={key} className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} />
                {label}
              </label>
            ))}
          </div>

          <div className="flex gap-2 justify-end pt-8">
            <AppLink href="/sequences" className="btn-secondary">Cancel</AppLink>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create & Add Steps'}</button>
          </div>
        </form>
      </div>
    </CRMLayout>
  );
}
