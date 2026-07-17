'use client';
import ClickToCallButton from './ClickToCallButton.js';
import { normalizePhoneForDial } from '../../lib/cloudTalkHelpers.js';

export default function PhoneCell({ value, label = 'Call lead' }) {
  if (!value) return '—';
  const normalized = normalizePhoneForDial(value);
  if (!normalized) return value;

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
      <span className="truncate">{value}</span>
      <ClickToCallButton number={value} label={label} size="xs" />
    </span>
  );
}
