import { CLOUDTALK_ORIGIN } from './cloudTalkHelpers.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Paste number into the dial pad (no call yet). */
export function buildCloudTalkPastePayloads(number) {
  const properties = { external_number: number };
  const objects = [
    { event: 'paste', properties },
    { event: 'paste_number', properties },
    { event: 'set_number', properties },
    { action: 'paste', number, external_number: number },
    { type: 'cloudtalk-paste', number, external_number: number },
  ];
  return [...objects.map((p) => JSON.stringify(p)), ...objects];
}

/** Trigger an outbound call (auto-dial when supported by CloudTalk). */
export function buildCloudTalkDialPayloads(number, { autoCall = true } = {}) {
  const properties = { external_number: number };
  const objects = [
    { event: 'dial', properties: { ...properties, autocall: autoCall, auto_call: autoCall } },
    { event: 'click_to_call', properties: { ...properties, autocall: autoCall } },
    { event: 'call', properties: { ...properties, autocall: autoCall } },
    { action: 'call', number, external_number: number, autocall: autoCall },
    { action: 'dial', number, external_number: number, autocall: autoCall },
    { type: 'cloudtalk-dial', number, external_number: number, autocall: autoCall },
  ];
  return [...objects.map((p) => JSON.stringify(p)), ...objects];
}

function postPayloads(iframe, payloads) {
  const target = iframe?.contentWindow;
  if (!target || !payloads?.length) return false;

  for (const payload of payloads) {
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

export function postCloudTalkPasteMessages(iframe, number) {
  return postPayloads(iframe, buildCloudTalkPastePayloads(number));
}

export function postCloudTalkDialMessages(iframe, number, { autoCall = true } = {}) {
  return postPayloads(iframe, buildCloudTalkDialPayloads(number, { autoCall }));
}

/** Paste the number, then send dial/autocall commands. */
export async function postCloudTalkAutocallMessages(iframe, number) {
  if (!iframe || !number) return false;
  postCloudTalkPasteMessages(iframe, number);
  await sleep(180);
  return postCloudTalkDialMessages(iframe, number, { autoCall: true });
}

export async function postCloudTalkDialWithRetries(iframeRef, number, {
  autoCall = true,
  attempts = 30,
  intervalMs = 280,
} = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const iframe = typeof iframeRef === 'function' ? iframeRef() : iframeRef?.current;
    if (iframe) {
      if (autoCall) {
        await postCloudTalkAutocallMessages(iframe, number);
      } else {
        postCloudTalkPasteMessages(iframe, number);
      }
    }
    if (i < attempts - 1) {
      await sleep(intervalMs);
    }
  }
}
