'use client';
import ClickToCallButton from './ClickToCallButton.js';
import { useCloudTalk } from './CloudTalkProvider.js';
import { normalizePhoneForDial } from '../../lib/cloudTalkHelpers.js';

export default function PhoneCell({ value, label = 'Call lead' }) {
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
        title={`Dial ${normalized}`}
      >
        {/* Visible text must be full E.164 (+countrycode…) — the CloudTalk Click to Call
            browser extension pattern-matches page text for numbers in that exact format
            and won't recognize locally-formatted numbers without a leading "+". */}
        {normalized}
      </button>
      <ClickToCallButton number={value} label={label} size="xs" />
    </span>
  );
}
