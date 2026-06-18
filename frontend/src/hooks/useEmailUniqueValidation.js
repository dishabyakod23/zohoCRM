'use client';
import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue.js';
import { validateEmail } from '../lib/validators.js';
import { validateEmailUnique } from '../lib/emailHelpers.js';

/** Debounced async check — returns duplicate-email error as the user types. */
export function useEmailUniqueValidation(email, {
  excludeLeadId,
  excludeContactId,
  enabled = true,
  debounceMs = 350,
} = {}) {
  const debouncedEmail = useDebouncedValue(email, debounceMs);
  const [uniqueError, setUniqueError] = useState(null);
  const [checking, setChecking] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setUniqueError(null);
      setChecking(false);
      return;
    }

    const trimmed = String(debouncedEmail || '').trim();
    const formatError = trimmed ? validateEmail(trimmed) : null;
    if (!trimmed || formatError) {
      setUniqueError(null);
      setChecking(false);
      return;
    }

    const id = ++requestId.current;
    setChecking(true);
    validateEmailUnique(trimmed, { excludeLeadId, excludeContactId })
      .then((err) => {
        if (id !== requestId.current) return;
        setUniqueError(err);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setUniqueError(null);
      })
      .finally(() => {
        if (id === requestId.current) setChecking(false);
      });
  }, [debouncedEmail, excludeLeadId, excludeContactId, enabled]);

  return { uniqueError, checking };
}

/** Format + uniqueness errors for email fields (inline under the input). */
export function useEmailFieldError(email, options = {}) {
  const trimmed = String(email || '').trim();
  const formatError = trimmed ? validateEmail(trimmed) : null;
  const { uniqueError, checking } = useEmailUniqueValidation(email, {
    ...options,
    enabled: options.enabled !== false && !formatError,
  });

  return {
    emailError: formatError || uniqueError || null,
    checking: !formatError && checking,
  };
}
