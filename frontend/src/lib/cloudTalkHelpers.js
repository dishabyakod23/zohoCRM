export const CLOUDTALK_ORIGIN = 'https://phone.cloudtalk.io';

export const CLOUDTALK_PARTNER =
  process.env.NEXT_PUBLIC_CLOUDTALK_PARTNER || 'sale-crm';

export const CLOUDTALK_ENABLED = process.env.NEXT_PUBLIC_CLOUDTALK_ENABLED !== 'false';

/** Normalize a phone string for CloudTalk dialer (E.164-ish). */
export function normalizePhoneForDial(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  if (/[a-zA-Z]/.test(trimmed) && !/^\s*\+?[\d\s()./-]+$/.test(trimmed)) return '';

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits || digits.length < 7) return '';

  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 11) return `+${digits}`;
  return `+${digits}`;
}

/**
 * The embedded CloudTalk Phone (phone.cloudtalk.io) only documents a `partner` query
 * param for the iframe URL, and only broadcasts *outbound* events (login/ringing/dialing/
 * ended/etc) via postMessage — there is no documented way to inject a number or trigger a
 * call into it from the parent page. Don't add undocumented query params here; the agent
 * dials manually inside the iframe (see `copyPhoneToClipboard` + `tryCloudTalkDesktopDial`
 * for the two real ways to get a number into a call).
 */
export function cloudTalkPhoneUrl({ partner = CLOUDTALK_PARTNER } = {}) {
  const params = new URLSearchParams({ partner });
  return `${CLOUDTALK_ORIGIN}?${params.toString()}`;
}

/** Deep link for CloudTalk's Click to Call browser extension / Desktop app (ct+tel:). */
export function buildCloudTalkDeepLink(number, fromNumber) {
  const normalized = normalizePhoneForDial(number);
  if (!normalized) return '';
  const base = `ct+tel:${encodeURIComponent(normalized)}`;
  const from = normalizePhoneForDial(fromNumber);
  if (!from) return base;
  return `${base}?from=${encodeURIComponent(from)}`;
}

export function openCloudTalkWebPhone(number) {
  const normalized = normalizePhoneForDial(number);
  if (!normalized || typeof window === 'undefined') return;
  window.open(cloudTalkPhoneUrl(), '_blank', 'noopener,noreferrer');
}

/**
 * Fire CloudTalk's documented ct+tel: deep link. Only actually dials if the CloudTalk
 * Click to Call browser extension or Desktop app is installed and registered as the
 * handler for that protocol — there is no way to detect success from JS, so callers
 * should not assume this alone placed the call.
 */
export function tryCloudTalkDesktopDial(number, fromNumber) {
  const link = buildCloudTalkDeepLink(number, fromNumber);
  if (!link || typeof window === 'undefined') return false;
  const anchor = document.createElement('a');
  anchor.href = link;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return true;
}

/**
 * Visually identical to `normalized`, but with a zero-width space after the leading "+".
 * The CloudTalk Click to Call browser extension scans page text for E.164-looking numbers
 * and wraps every match in its own styled badge (not something this app's CSS can override).
 * Breaking up the digit run defeats that pattern match while leaving the number fully
 * readable — dialing/copying always use the real `normalized` value, never this string.
 */
export function displayPhoneWithoutAutoDetect(normalized) {
  if (!normalized) return normalized;
  return `${normalized[0]}​${normalized.slice(1)}`;
}

/**
 * Format a phone for display only — never invent a +1 country code.
 * Shows the stored value as-is; only inserts a zero-width space after an existing "+".
 */
export function formatPhoneForDisplay(raw) {
  if (raw == null || raw === '') return raw;
  const trimmed = String(raw).trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('+')) return displayPhoneWithoutAutoDetect(trimmed);
  return trimmed;
}

/** Copy a number to the clipboard so it can be pasted into the CloudTalk dialer. */
export async function copyPhoneToClipboard(number) {
  if (!number || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(number);
    return true;
  } catch {
    return false;
  }
}
