import { CLOUDTALK_ORIGIN } from './cloudTalkHelpers.js';

/** Payloads sent parent → CloudTalk iframe (symmetric with their outbound events). */
export function buildCloudTalkDialPayloads(number) {
  const properties = { external_number: number };

  const objects = [
    { event: 'dial', properties },
    { event: 'paste', properties },
    { event: 'set_number', properties },
    { action: 'paste', number },
    { action: 'call', number, autocall: false },
    { action: 'call', number, autocall: true },
    { type: 'cloudtalk-paste', number },
    { type: 'cloudtalk-dial', number },
  ];

  const serialized = objects.map((payload) => JSON.stringify(payload));
  return [...serialized, ...objects, number];
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
  attempts = 20,
  intervalMs = 350,
} = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const iframe = typeof iframeRef === 'function' ? iframeRef() : iframeRef?.current;
    if (iframe) postCloudTalkDialMessages(iframe, number);
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
