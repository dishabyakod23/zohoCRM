'use client';
import { PhoneIcon } from '@heroicons/react/24/outline';
import { useJustCall } from './JustCallProvider.js';
import { normalizePhoneForDial } from '../../lib/justCallHelpers.js';

export default function CallRecordButton({ phone, mobile, label = 'Call' }) {
  const { dialNumber } = useJustCall();
  const number = normalizePhoneForDial(phone) || normalizePhoneForDial(mobile);

  if (!number) return null;

  return (
    <button
      type="button"
      onClick={() => dialNumber(number)}
      className="btn-primary text-xs flex items-center gap-1.5"
    >
      <PhoneIcon className="w-4 h-4" />
      {label}
    </button>
  );
}
