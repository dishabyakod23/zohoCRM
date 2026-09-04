'use client';
import { useMemo } from 'react';
import {
  listSequenceTimezones,
  normalizeSequenceTimezone,
  formatTimezoneLabel,
} from '../../lib/sequenceHelpers.js';

export default function TimezoneSelect({
  value,
  onChange,
  disabled = false,
  className = 'input',
  id,
  name,
}) {
  const selected = normalizeSequenceTimezone(value || 'UTC');
  const options = useMemo(() => listSequenceTimezones(selected), [selected]);

  return (
    <select
      id={id}
      name={name}
      className={className}
      value={selected}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {options.map((tz) => (
        <option key={tz} value={tz}>{formatTimezoneLabel(tz)}</option>
      ))}
    </select>
  );
}
