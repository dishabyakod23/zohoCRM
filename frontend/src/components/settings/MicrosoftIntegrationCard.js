'use client';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as microsoftApi from '../../lib/services/microsoft.js';

/**
 * Settings → My Profile card for Microsoft 365 connect / disconnect / webhook.
 */
export default function MicrosoftIntegrationCard() {
  const { showToast } = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await microsoftApi.getMicrosoftStatus());
    } catch (err) {
      setStatus(null);
      showToast(getApiError(err) || 'Could not load Microsoft connection status.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const connect = async () => {
    setBusy(true);
    try {
      await microsoftApi.startMicrosoftConnect();
    } catch (err) {
      showToast(getApiError(err) || 'Could not start Microsoft connect.');
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await microsoftApi.disconnectMicrosoft();
      showToast('Microsoft 365 disconnected', 'success');
      await loadStatus();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const enableWebhook = async () => {
    setBusy(true);
    try {
      await microsoftApi.ensureMicrosoftWebhook();
      showToast('Calendar sync webhook enabled', 'success');
      await loadStatus();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold mb-1">Microsoft 365</h2>
      <p className="text-sm text-zoho-muted mb-4">
        Connect Outlook calendar and Teams so CRM meetings can sync and include join links.
        The host who creates the meeting must be the connected Microsoft account.
      </p>

      {loading ? (
        <p className="text-sm text-zoho-muted">Checking connection…</p>
      ) : !status?.configured ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Admin must set Microsoft env on the API before users can connect.
        </p>
      ) : status.connected ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              Connected
            </span>
            {status.microsoft_email && (
              <span className="text-zoho-text">{status.microsoft_email}</span>
            )}
          </div>
          {!status.webhook_subscription_active && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-zoho-muted">Two-way calendar sync webhook is not active.</p>
              <button
                type="button"
                onClick={enableWebhook}
                disabled={busy}
                className="btn-secondary text-xs"
              >
                {busy ? 'Working…' : 'Enable calendar sync'}
              </button>
            </div>
          )}
          {status.webhook_subscription_active && (
            <p className="text-xs text-green-700">Calendar sync webhook is active.</p>
          )}
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="btn-secondary text-xs"
          >
            {busy ? 'Working…' : 'Disconnect'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={connect}
          disabled={busy}
          className="btn-primary text-xs"
        >
          {busy ? 'Redirecting…' : 'Connect Microsoft 365'}
        </button>
      )}
    </div>
  );
}
