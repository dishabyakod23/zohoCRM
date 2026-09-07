/** Strip leading whitespace from typed form values. */
export function trimStartValue(value) {
  return typeof value === 'string' ? value.trimStart() : value;
}

/** Full trim for string fields right before API payloads / validation. */
export function trimStringFields(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const next = { ...obj };
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === 'string') next[key] = value.trim();
  }
  return next;
}

const PHONE_DIGIT_FIELDS = new Set([
  'phone',
  'mobile',
  'other_phone',
  'home_phone',
  'asst_phone',
  'fax',
]);

export function isPhoneDigitField(name) {
  return PHONE_DIGIT_FIELDS.has(name);
}

/** Keep digits only (no letters or special characters). Caps at E.164 length. */
export function sanitizePhoneDigits(value, { maxDigits = 15 } = {}) {
  if (value == null) return value;
  return String(value).replace(/\D/g, '').slice(0, maxDigits);
}

/**
 * Standard create-form field setter: trims leading spaces as the user types.
 * Phone/mobile-like fields accept digits only.
 * Checkbox values are left as booleans.
 * Usage: const set = makeFieldSetter(setForm, setErrors);
 */
export function makeFieldSetter(setForm, setErrors) {
  return (field) => (e) => {
    let value;
    if (e?.target != null) {
      value = e.target.type === 'checkbox' ? e.target.checked : trimStartValue(e.target.value);
    } else {
      value = trimStartValue(e);
    }
    if (typeof value === 'string' && isPhoneDigitField(field)) {
      value = sanitizePhoneDigits(value);
    }
    setForm((f) => ({ ...f, [field]: value }));
    if (setErrors) {
      setErrors((er) => (er?.[field] == null ? er : { ...er, [field]: null }));
    }
  };
}
