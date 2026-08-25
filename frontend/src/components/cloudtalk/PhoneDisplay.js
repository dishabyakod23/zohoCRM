'use client';
import { useCloudTalk } from './CloudTalkProvider.js';
import { formatPhoneForDisplay, normalizePhoneForDial } from '../../lib/cloudTalkHelpers.js';

export default function PhoneDisplay({ value }) {
  const { dialNumber } = useCloudTalk();

  if (!value) return null;
  const dialable = normalizePhoneForDial(value);
  const display = formatPhoneForDisplay(String(value));

  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <button
        type="button"
        onClick={() => dialNumber(value)}
        className="text-brand-600 hover:text-brand-700 hover:underline"
        title={dialable ? `Dial ${dialable}` : `Dial ${value}`}
      >
        {display}
      </button>
    </span>
  );
}
