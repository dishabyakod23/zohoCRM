export function validateEmail(email) {
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : 'Please enter a valid email address.';
}

export function validatePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 ? null : 'Please enter a valid phone number.';
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
