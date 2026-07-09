'use client';
import { PhoneIcon } from '@heroicons/react/24/outline';
import { useJustCall } from './JustCallProvider.js';
import { normalizePhoneForDial } from '../../lib/justCallHelpers.js';

export default function ClickToCallButton({
  number,
  label = 'Call',
  className = '',
  size = 'sm',
  openPanel = true,
}) {
  const { dialNumber } = useJustCall();
  const normalized = normalizePhoneForDial(number);

  if (!normalized) return null;

  const sizeClass = size === 'xs'
    ? 'w-6 h-6'
    : size === 'md'
      ? 'w-9 h-9'
      : 'w-7 h-7';

  return (
    <button
      type="button"
      title={`${label} ${normalized}`}
      aria-label={`${label} ${normalized}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dialNumber(normalized, { openPanel });
      }}
      className={`inline-flex items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50 hover:text-brand-700 transition-colors shrink-0 ${sizeClass} ${className}`}
    >
      <PhoneIcon className={size === 'xs' ? 'w-3.5 h-3.5' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4'} />
    </button>
  );
}
