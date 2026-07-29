import { CLOUDTALK_ORIGIN } from './cloudTalkHelpers.js';

/** Payloads CloudTalk Phone may accept from the parent CRM (paste into dialpad). */
export function buildCloudTalkDialPayloads(number) {
  const payloads = [
    { event: 'dial', properties: { external_number: number } },
    { event: 'paste', properties: { external_number: number } },
    { event: 'set_number', properties: { external_number: number } },
    { action: 'paste', number },
    { action: 'call', number, autocall: false },
    { action: 'call', number, autocall: true },
    { type: 'cloudtalk-paste', number },
    { type: 'cloudtalk-dial', number },
    number,
  ];

  const serialized = payloads.map((payload) => {
    if (typeof payload === 'string') return payload;
    return JSON.stringify(payload);
  });

  return [...payloads, ...serialized];
}

export function postCloudTalkDialMessages(iframe, number) {
  const target = iframe?.contentWindow;
  if (!target || !number) return false;

  for (const payload of buildCloudTalkDialPayloads(number)) {
    try {
      if (typeof payload === 'string') {
        target.postMessage(payload, CLOUDTALK_ORIGIN);
      } else {
        target.postMessage(payload, CLOUDTALK_ORIGIN);
        target.postMessage(JSON.stringify(payload), CLOUDTALK_ORIGIN);
      }
    } catch {
      // try next format
    }
  }

  return true;
}

export async function postCloudTalkDialWithRetries(iframeRef, number, {
  attempts = 12,
  intervalMs = 400,
} = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const iframe = typeof iframeRef === 'function' ? iframeRef() : iframeRef?.current;
    if (iframe) postCloudTalkDialMessages(iframe, number);
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
