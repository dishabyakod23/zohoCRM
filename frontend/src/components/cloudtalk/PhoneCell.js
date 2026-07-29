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
    dialNumber(value, { autoCall: true });
  };

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
      <button
        type="button"
        onClick={handleDial}
        className="truncate text-left text-brand-600 hover:text-brand-700 hover:underline"
        title={`Dial ${normalized}`}
      >
        {value}
      </button>
      <ClickToCallButton number={value} label={label} size="xs" />
    </span>
  );
}
