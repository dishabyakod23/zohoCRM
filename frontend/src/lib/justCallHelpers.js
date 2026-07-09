/** Normalize a phone string for JustCall dialer (E.164-ish). */
export function normalizePhoneForDial(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 11) return `+${digits}`;
  return `+${digits}`;
}

export function openJustCallWebDialer(number) {
  const normalized = normalizePhoneForDial(number);
  if (!normalized || typeof window === 'undefined') return;
  window.open(
    `https://app.justcall.io/dialer?numbers=${encodeURIComponent(normalized)}`,
    '_blank',
    'noopener,noreferrer',
  );
}

export const JUSTCALL_ENABLED = process.env.NEXT_PUBLIC_JUSTCALL_ENABLED !== 'false';
