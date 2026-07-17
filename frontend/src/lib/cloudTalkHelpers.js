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

export function cloudTalkPhoneUrl({ partner = CLOUDTALK_PARTNER } = {}) {
  const params = new URLSearchParams({ partner });
  return `${CLOUDTALK_ORIGIN}?${params.toString()}`;
}

/** Deep link for CloudTalk Desktop app (ct+tel:). */
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
