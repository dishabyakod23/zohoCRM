import { validatePhone, PHONE_FIELD_LABELS } from './validators.js';

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

/** Keep digits plus common phone formatting (+, spaces, dashes, parentheses, dots). Caps digit count at E.164 max. */
export function sanitizePhoneDigits(value, { maxDigits = 15 } = {}) {
  if (value == null) return value;
  let raw = String(value).replace(/[^\d+\s()./-]/g, '');
  const leadingPlus = raw.startsWith('+');
  raw = (leadingPlus ? '+' : '') + raw.replace(/\+/g, '');

  let digits = 0;
  let out = '';
  for (const ch of raw) {
    if (/\d/.test(ch)) {
      if (digits >= maxDigits) continue;
      digits += 1;
    }
    out += ch;
  }
  return out;
}

/**
 * Standard create-form field setter: trims leading spaces as the user types.
 * Phone/mobile-like fields accept digits and common phone characters (+, spaces, dashes)
 * and show inline errors immediately.
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
      setErrors((er) => {
        const next = { ...(er || {}) };
        if (typeof value === 'string' && isPhoneDigitField(field)) {
          const label = PHONE_FIELD_LABELS[field] || 'Phone';
          next[field] = validatePhone(value, label);
        } else if (next[field] != null) {
          next[field] = null;
        }
        return next;
      });
    }
  };
}
