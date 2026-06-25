/** Neutral black/gray styling for CRM list table cells */
export const tableLinkClass = 'font-medium text-zoho-text hover:text-black hover:underline';
export const tableEmailClass = 'text-zoho-muted';
export const tableActionClass = 'text-xs text-zoho-muted hover:text-zoho-text hover:underline';

const LETTER_AVATAR_BG = [
  'bg-gradient-to-br from-violet-500 to-violet-700',
  'bg-gradient-to-br from-blue-500 to-blue-700',
  'bg-gradient-to-br from-sky-500 to-sky-700',
  'bg-gradient-to-br from-cyan-500 to-cyan-700',
  'bg-gradient-to-br from-teal-500 to-teal-700',
  'bg-gradient-to-br from-emerald-500 to-emerald-700',
  'bg-gradient-to-br from-green-600 to-green-800',
  'bg-gradient-to-br from-lime-600 to-lime-800',
  'bg-gradient-to-br from-yellow-500 to-amber-600',
  'bg-gradient-to-br from-orange-500 to-orange-700',
  'bg-gradient-to-br from-amber-600 to-orange-700',
  'bg-gradient-to-br from-red-500 to-red-700',
  'bg-gradient-to-br from-rose-500 to-rose-700',
  'bg-gradient-to-br from-pink-500 to-pink-700',
  'bg-gradient-to-br from-fuchsia-500 to-fuchsia-700',
  'bg-gradient-to-br from-purple-500 to-purple-700',
  'bg-gradient-to-br from-indigo-500 to-indigo-700',
  'bg-gradient-to-br from-violet-600 to-indigo-800',
  'bg-gradient-to-br from-blue-600 to-indigo-700',
  'bg-gradient-to-br from-slate-500 to-slate-700',
  'bg-gradient-to-br from-stone-500 to-stone-700',
  'bg-gradient-to-br from-brand-500 to-brand-700',
  'bg-gradient-to-br from-accent-teal to-teal-700',
  'bg-gradient-to-br from-accent-blue to-blue-700',
  'bg-gradient-to-br from-accent-green to-green-700',
  'bg-gradient-to-br from-accent-pink to-pink-700',
];

function letterAvatarIndex(nameOrLetter) {
  const letter = (String(nameOrLetter || '?').match(/[a-zA-Z]/)?.[0] || 'A').toUpperCase();
  const code = letter.charCodeAt(0);
  if (code >= 65 && code <= 90) return code - 65;
  return 0;
}

/** Background colour class from the first letter of a name (A–Z). */
export function avatarInitialBgClass(nameOrLetter) {
  return `${LETTER_AVATAR_BG[letterAvatarIndex(nameOrLetter)]} text-white`;
}

/** Sized initial avatar with letter-based background colour. */
export function avatarInitialClass(nameOrLetter, size = 'sm') {
  const sizeClass = size === 'lg'
    ? 'w-12 h-12 rounded-xl text-base font-semibold'
    : size === 'md'
      ? 'w-8 h-8 rounded-lg text-xs font-semibold'
      : 'w-7 h-7 rounded-lg text-[11px] font-bold';
  return `${sizeClass} ${avatarInitialBgClass(nameOrLetter)} flex items-center justify-center shrink-0`;
}

export const tableAvatarClass = 'w-8 h-8 rounded-lg bg-neutral-100 text-zoho-muted flex items-center justify-center text-xs font-semibold shrink-0';
export const tableAvatarSmClass = 'w-7 h-7 rounded-lg bg-neutral-100 text-zoho-muted flex items-center justify-center text-xs font-semibold shrink-0';
