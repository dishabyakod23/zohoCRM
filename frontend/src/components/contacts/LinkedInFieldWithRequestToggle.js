'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import {
  getLinkedInRequestSent,
  isLinkedInRequestSent,
  setLinkedInRequestSent,
} from '../../lib/outreachActivity.js';
import { userDisplayName } from '../../lib/userHelpers.js';
import { markRecordListStale } from '../../lib/recordUpdateEvents.js';
import * as contactsApi from '../../lib/services/contacts.js';

function LinkedInRequestCheckbox({ contactId, disabled }) {
  const { user } = useAuth();
  const [sent, setSent] = useState(false);
  const [sentAt, setSentAt] = useState(null);

  useEffect(() => {
    const entry = getLinkedInRequestSent(contactId);
    setSent(isLinkedInRequestSent(contactId));
    setSentAt(entry?.sent_at || null);
  }, [contactId]);

  const toggleSent = async (checked) => {
    const entry = setLinkedInRequestSent(contactId, {
      sent: checked,
      user: { id: user?.id, name: userDisplayName(user) },
    });
    setSent(checked);
    setSentAt(entry?.sent_at || null);
    markRecordListStale();
    if (contactId) {
      try {
        await contactsApi.updateContact(contactId, checked
          ? {
            linkedin_request_sent: true,
            linkedin_request_sent_at: entry?.sent_at || new Date().toISOString(),
            linkedin_request_sent_by: user?.id || null,
          }
          : {
            linkedin_request_sent: false,
            linkedin_request_sent_at: null,
            linkedin_request_sent_by: null,
          });
      } catch {
        /* API may not support these fields yet — local flag still applies */
      }
    }
  };

  return (
    <label className="flex items-center gap-2 text-sm text-zoho-text cursor-pointer mt-2">
      <input
        type="checkbox"
        className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
        checked={sent}
        onChange={(e) => toggleSent(e.target.checked)}
        disabled={disabled}
      />
      LinkedIn request sent
      {sentAt && (
        <span className="text-xs text-zoho-muted">
          ({new Date(sentAt).toLocaleDateString()})
        </span>
      )}
    </label>
  );
}

export default function LinkedInFieldWithRequestToggle({
  contactId,
  value,
  onChange,
  linkPreview,
  disabled,
  readOnly = false,
}) {
  if (readOnly) {
    return (
      <div>
        {linkPreview || '—'}
        <LinkedInRequestCheckbox contactId={contactId} disabled={disabled} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        className="input"
        type="url"
        placeholder="https://linkedin.com/in/…"
        value={value ?? ''}
        onChange={onChange}
        disabled={disabled}
      />
      <LinkedInRequestCheckbox contactId={contactId} disabled={disabled} />
    </div>
  );
}
