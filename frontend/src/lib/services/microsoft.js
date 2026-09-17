import api from '../api.js';

/**
 * Microsoft 365 / Outlook / Teams integration
 * GET    /integrations/microsoft/status
 * GET    /integrations/microsoft/connect  → { authorize_url }
 * DELETE /integrations/microsoft/disconnect
 * POST   /integrations/microsoft/ensure-webhook
 */

function extractData(res) {
  return res?.data?.data ?? res?.data ?? null;
}

export function normalizeMicrosoftStatus(raw = {}) {
  return {
    configured: !!raw.configured,
    connected: !!raw.connected,
    microsoft_email: raw.microsoft_email || null,
    webhook_subscription_active: !!raw.webhook_subscription_active,
    ...raw,
  };
}

/** GET /integrations/microsoft/status */
export async function getMicrosoftStatus() {
  const res = await api.get('/integrations/microsoft/status');
  return normalizeMicrosoftStatus(extractData(res) || {});
}

/** GET /integrations/microsoft/connect → open authorize_url in the browser */
export async function getMicrosoftConnectUrl() {
  const res = await api.get('/integrations/microsoft/connect');
  const data = extractData(res) || {};
  const authorizeUrl = data.authorize_url || data.authorization_url || null;
  if (!authorizeUrl) throw new Error('Microsoft connect URL was not returned by the API.');
  return authorizeUrl;
}

export async function startMicrosoftConnect() {
  const authorizeUrl = await getMicrosoftConnectUrl();
  if (typeof window !== 'undefined') {
    window.location.href = authorizeUrl;
  }
  return authorizeUrl;
}

/** DELETE /integrations/microsoft/disconnect */
export async function disconnectMicrosoft() {
  const res = await api.delete('/integrations/microsoft/disconnect');
  return extractData(res);
}

/** POST /integrations/microsoft/ensure-webhook — renew two-way calendar webhook */
export async function ensureMicrosoftWebhook() {
  const res = await api.post('/integrations/microsoft/ensure-webhook');
  return extractData(res);
}

export const MICROSOFT_SYNC_STATUS_META = {
  synced: { label: 'Synced', className: 'bg-green-50 text-green-700 border-green-200' },
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700 border-red-200' },
  disconnected: { label: 'Disconnected', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  cancelled_in_outlook: { label: 'Cancelled in Outlook', className: 'bg-orange-50 text-orange-700 border-orange-200' },
};

export function microsoftSyncStatusMeta(status) {
  const key = String(status || '').toLowerCase();
  return MICROSOFT_SYNC_STATUS_META[key] || {
    label: status ? String(status).replace(/_/g, ' ') : 'Unknown',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  };
}
