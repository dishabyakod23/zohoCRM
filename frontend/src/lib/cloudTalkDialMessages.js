import { CLOUDTALK_ORIGIN } from './cloudTalkHelpers.js';

/**
 * Payloads parent → CloudTalk iframe (paste into dial pad).
 * Mirror outbound event shape: { event, properties: { external_number } }.
 */
export function buildCloudTalkDialPayloads(number) {
  const properties = { external_number: number };

  const objects = [
    { event: 'paste', properties },
    { event: 'paste_number', properties },
    { event: 'set_number', properties },
    { event: 'click_to_call', properties },
    { event: 'dial', properties: { ...properties, autocall: false } },
    { event: 'dial', properties: { ...properties, autocall: true } },
    { event: 'call', properties },
    { action: 'paste', number, external_number: number },
    { action: 'call', number, external_number: number, autocall: false },
    { type: 'cloudtalk-paste', number, external_number: number },
    { type: 'cloudtalk-dial', number, external_number: number },
  ];

  const serialized = objects.map((payload) => JSON.stringify(payload));
  return [...serialized, ...objects];
}

export function postCloudTalkDialMessages(iframe, number) {
  const target = iframe?.contentWindow;
  if (!target || !number) return false;

  for (const payload of buildCloudTalkDialPayloads(number)) {
    try {
      if (typeof payload === 'string') {
        target.postMessage(payload, CLOUDTALK_ORIGIN);
      } else {
        target.postMessage(JSON.stringify(payload), CLOUDTALK_ORIGIN);
        target.postMessage(payload, CLOUDTALK_ORIGIN);
      }
    } catch {
      // try next format
    }
  }

  return true;
}

export async function postCloudTalkDialWithRetries(iframeRef, number, {
  attempts = 24,
  intervalMs = 300,
} = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const iframe = typeof iframeRef === 'function' ? iframeRef() : iframeRef?.current;
    if (iframe) postCloudTalkDialMessages(iframe, number);
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
