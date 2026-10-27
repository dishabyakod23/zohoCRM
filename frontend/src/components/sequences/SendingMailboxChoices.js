'use client';
import { useEffect, useMemo, useState } from 'react';
import { inputClass } from '../forms/FormField.js';
import { getApiError } from '../../lib/api.js';
import { useToast } from '../ui/Toast.js';
import * as microsoftApi from '../../lib/services/microsoft.js';

export const SENDING_EMAIL_OUTLOOK_HINT =
  'Use the Outlook address connected in Settings. Disconnect Microsoft there and connect again before the first send.';

export default function SendingMailboxChoices({
  value,
  onChange,
  disabled = false,
  error = false,
  name = 'sending_email',
}) {
  const { showToast } = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    microsoftApi.getMicrosoftStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus(null);
          showToast(getApiError(err) || 'Could not load Outlook mailboxes.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [showToast]);

  const emails = useMemo(() => {
    const connected = microsoftApi.sendableMicrosoftEmails(status);
    const current = String(value || '').trim();
    if (current && !connected.some((email) => email.toLowerCase() === current.toLowerCase())) {
      return [current, ...connected];
    }
    return connected;
  }, [status, value]);

  useEffect(() => {
    if (loading || disabled) return;
    if (String(value || '').trim()) return;
    const preferred = microsoftApi.microsoftMailboxesFromStatus(status)
      .find((row) => row.can_send && row.is_calendar)
      || microsoftApi.microsoftMailboxesFromStatus(status).find((row) => row.can_send);
    if (preferred?.email) onChange(preferred.email);
  }, [loading, disabled, value, status, onChange]);

  return (
    <>
      <select
        className={inputClass(error)}
        name={name}
        value={value || ''}
        disabled={disabled || loading || emails.length === 0}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {loading ? 'Loading Outlook mailboxes…' : 'Select a connected Outlook address'}
        </option>
        {emails.map((email) => (
          <option key={email} value={email}>{email}</option>
        ))}
      </select>
      <p className="text-xs text-zoho-muted mt-1.5">
        {SENDING_EMAIL_OUTLOOK_HINT}
      </p>
    </>
  );
}
