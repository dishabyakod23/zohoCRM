export function validateEmail(email) {
  if (!email) return null;
  const value = String(email).trim();
  // Reject clearly invalid characters (e.g. `;`) that a naïve @/. check still allows.
  const looksValid =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
      value,
    );
  return looksValid ? null : 'The entered email is not in the correct format.';
}

/** Prefer specific field errors (format, uniqueness) over a generic required-fields toast. */
export function validationToastMessage(
  errs,
  fallback = 'Please fill in all required fields before saving.',
) {
  if (!errs || typeof errs !== 'object') return fallback;
  const preferredKeys = [
    'email',
    'secondary_email',
    'phone',
    'mobile',
    'other_phone',
    'home_phone',
    'asst_phone',
    'fax',
    'lost_reason',
  ];
  for (const key of preferredKeys) {
    const msg = errs[key];
    if (msg && !/is required\.?$/i.test(String(msg))) return msg;
  }
  const first = Object.values(errs).find(Boolean);
  return first ? String(first) : fallback;
}

export const PHONE_FIELD_LABELS = {
  phone: 'Phone',
  mobile: 'Mobile',
  other_phone: 'Other Phone',
  home_phone: 'Home Phone',
  asst_phone: 'Asst Phone',
  fax: 'Fax',
};

export function validatePhone(phone, label = 'Phone') {
  if (!phone) return null;
  const value = String(phone).trim();
  if (/\D/.test(value)) {
    return `${label} is invalid. Only digits are allowed.`;
  }
  if (value.length < 7 || value.length > 15) {
    return `${label} is invalid.`;
  }
  return null;
}

/** Validate every phone-like field present on a form/draft object. */
export function collectPhoneFieldErrors(values = {}, fieldNames = Object.keys(PHONE_FIELD_LABELS)) {
  const errs = {};
  for (const name of fieldNames) {
    const raw = values?.[name];
    if (raw == null || String(raw).trim() === '') continue;
    const label = PHONE_FIELD_LABELS[name] || 'Phone';
    const phoneErr = validatePhone(raw, label);
    if (phoneErr) errs[name] = phoneErr;
  }
  return errs;
}

export function validateRequired(fields, values) {
  const errors = {};
  for (const [key, label] of Object.entries(fields)) {
    const v = values[key];
    if (v === undefined || v === null || String(v).trim() === '') {
      errors[key] = `${label} is required.`;
    }
  }
  return errors;
}

export function validatePastDate(dateStr, label = 'Date') {
  if (!dateStr) return null;
  // Date-only strings ("YYYY-MM-DD") parse as UTC midnight per the ES spec, while `today`
  // below is local midnight — comparing them directly flags "today" as past in any
  // timezone behind UTC. Force local-midnight parsing so both sides use the same clock.
  const datePart = String(dateStr).slice(0, 10);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? new Date(`${datePart}T00:00:00`) : new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today ? `${label} cannot be in the past.` : null;
}
