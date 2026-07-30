'use client';
import { PhoneIcon } from '@heroicons/react/24/outline';
import { useCloudTalk } from './CloudTalkProvider.js';
import { normalizePhoneForDial } from '../../lib/cloudTalkHelpers.js';

export default function CallRecordButton({ phone, mobile, label = 'Call' }) {
  const { dialNumber } = useCloudTalk();
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
