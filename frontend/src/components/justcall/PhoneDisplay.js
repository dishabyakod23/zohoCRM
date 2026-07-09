'use client';
import ClickToCallButton from './ClickToCallButton.js';
import { normalizePhoneForDial } from '../../lib/justCallHelpers.js';

export default function PhoneDisplay({ value, label = 'Call' }) {
  if (!value) return null;
  const normalized = normalizePhoneForDial(value);
  if (!normalized) return value;

  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <span>{value}</span>
      <ClickToCallButton number={value} label={label} size="xs" />
    </span>
  );
}
