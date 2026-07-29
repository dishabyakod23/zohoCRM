'use client';
import ClickToCallButton from './ClickToCallButton.js';
import { useCloudTalk } from './CloudTalkProvider.js';
import { normalizePhoneForDial } from '../../lib/cloudTalkHelpers.js';

export default function PhoneDisplay({ value, label = 'Call' }) {
  const { dialNumber } = useCloudTalk();

  if (!value) return null;
  const normalized = normalizePhoneForDial(value);
  if (!normalized) return value;

  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <button
        type="button"
        onClick={() => dialNumber(value)}
        className="text-brand-600 hover:text-brand-700 hover:underline"
        title={`Dial ${normalized}`}
      >
        {value}
      </button>
      <ClickToCallButton number={value} label={label} size="xs" />
    </span>
  );
}
