'use client';
import { useCloudTalk } from './CloudTalkProvider.js';
import { displayPhoneWithoutAutoDetect, normalizePhoneForDial } from '../../lib/cloudTalkHelpers.js';

export default function PhoneCell({ value }) {
  const { dialNumber } = useCloudTalk();

  if (!value) return '—';
  const normalized = normalizePhoneForDial(value);
  if (!normalized) return value;

  const handleDial = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dialNumber(value);
  };

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
      <button
        type="button"
        onClick={handleDial}
        className="truncate text-left text-brand-600 hover:text-brand-700 hover:underline"
        title={`Dial ${displayPhoneWithoutAutoDetect(normalized)}`}
      >
        {displayPhoneWithoutAutoDetect(normalized)}
      </button>
    </span>
  );
}
