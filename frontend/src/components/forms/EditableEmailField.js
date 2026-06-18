'use client';
import { useEmailFieldError } from '../../hooks/useEmailUniqueValidation.js';
import { inputClass } from './FormField.js';

export default function EditableEmailField({
  value,
  onChange,
  excludeLeadId,
  excludeContactId,
  enabled = true,
}) {
  const { emailError, checking } = useEmailFieldError(value, {
    excludeLeadId,
    excludeContactId,
    enabled,
  });

  return (
    <div>
      <input
        className={inputClass(emailError)}
        type="email"
        value={value ?? ''}
        onChange={onChange}
        autoComplete="email"
      />
      {checking && !emailError && (
        <p className="text-xs text-zoho-muted mt-1">Checking availability…</p>
      )}
      {emailError && (
        <p className="text-xs text-red-600 mt-1" role="alert">{emailError}</p>
      )}
    </div>
  );
}
