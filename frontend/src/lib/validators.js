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
  // Date-only strings ("YYYY-MM-DD") parse as UTC midnight per the ES spec, while `today`
  // below is local midnight — comparing them directly flags "today" as past in any
  // timezone behind UTC. Force local-midnight parsing so both sides use the same clock.
  const datePart = String(dateStr).slice(0, 10);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? new Date(`${datePart}T00:00:00`) : new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today ? `${label} cannot be in the past.` : null;
}
