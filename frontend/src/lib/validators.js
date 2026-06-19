import {
  hasValidPhone,
  normalizeEmail,
  validateEmail as validateEmailAddress,
  validateEmailOrPhone,
} from './emailHelpers.js';

export function validateEmail(email, options = {}) {
  return validateEmailAddress(email, options);
}

export { validateEmailOrPhone, normalizeEmail, hasValidPhone };

export function validatePhone(phone) {
  if (!phone) return null;
  return hasValidPhone(phone) ? null : 'Please enter a valid phone number.';
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
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today ? `${label} cannot be in the past.` : null;
}
