'use client';
import { useState } from 'react';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as meetingsApi from '../../lib/services/meetings.js';
import { microsoftSyncStatusMeta } from '../../lib/services/microsoft.js';
import AppLink from '../ui/AppLink.js';

async function copyText(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Meeting detail: Teams online toggle, join URL, Outlook sync status + retry.
 */
export default function MeetingMicrosoftPanel({
  meeting,
  canEdit = false,
  onUpdated,
}) {
  const { showToast } = useToast();
  const [savingOnline, setSavingOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);

  if (!meeting) return null;

  const syncMeta = microsoftSyncStatusMeta(meeting.microsoft_sync_status);
  const statusKey = String(meeting.microsoft_sync_status || '').toLowerCase();

  const toggleOnlineMeeting = async (checked) => {
    setSavingOnline(true);
    try {
      const updated = await meetingsApi.updateMeeting(meeting.id, {
        is_online_meeting: checked,
        sync_to_microsoft: meeting.sync_to_microsoft !== false,
      });
      onUpdated?.(updated);
      showToast(checked ? 'Teams meeting enabled' : 'Teams meeting disabled', 'success');
      if (String(updated.microsoft_sync_status || '').toLowerCase() === 'disconnected') {
        showToast('Connect Microsoft in Settings to sync to Outlook', 'error');
      }
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSavingOnline(false);
    }
  };

  const retrySync = async () => {
    setSyncing(true);
    try {
      const updated = await meetingsApi.syncMeetingToMicrosoft(meeting.id);
      onUpdated?.(updated);
      showToast('Outlook sync retried', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSyncing(false);
    }
  };

  const copyJoinUrl = async () => {
    const ok = await copyText(meeting.teams_join_url);
    showToast(ok ? 'Teams join link copied' : 'Could not copy link', ok ? 'success' : 'error');
  };

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold mb-1">Microsoft / Teams</h2>
        <p className="text-xs text-zoho-muted">
          Outlook sync uses the host&apos;s connected Microsoft account.
          {' '}
          <AppLink href="/settings" className="text-brand-600 hover:underline">Open Settings</AppLink>
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={!!meeting.is_online_meeting}
          disabled={!canEdit || savingOnline}
          onChange={(e) => toggleOnlineMeeting(e.target.checked)}
          className="rounded border-zoho-border text-brand-600 focus:ring-brand-500"
        />
        <span>Add Teams meeting link</span>
        {savingOnline && <span className="text-xs text-zoho-muted">Saving…</span>}
      </label>

      {meeting.teams_join_url && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-zoho-muted">Teams join URL</p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={meeting.teams_join_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-600 hover:underline break-all"
            >
              {meeting.teams_join_url}
            </a>
            <button type="button" onClick={copyJoinUrl} className="btn-secondary text-xs shrink-0">
              Copy
            </button>
          </div>
        </div>
      )}

      {meeting.microsoft_sync_status && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zoho-muted">Outlook sync</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${syncMeta.className}`}>
            {syncMeta.label}
          </span>
          {meeting.microsoft_imported && (
            <span className="text-xs text-zoho-muted">Imported from Outlook</span>
          )}
        </div>
      )}

      {statusKey === 'failed' && (
        <div className="space-y-2">
          {meeting.microsoft_last_error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {meeting.microsoft_last_error}
            </p>
          )}
          {canEdit && (
            <button type="button" onClick={retrySync} disabled={syncing} className="btn-primary text-xs">
              {syncing ? 'Retrying…' : 'Retry sync'}
            </button>
          )}
        </div>
      )}

      {statusKey === 'disconnected' && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Connect Microsoft 365 in Settings to sync this meeting to Outlook.
        </p>
      )}
    </div>
  );
}
