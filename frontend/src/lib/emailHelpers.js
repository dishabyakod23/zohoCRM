/** Keep in sync with sales-crm app/core/email_address.py */
export const PLACEHOLDER_EMAIL_DOMAIN = 'leads.noreply.invalid';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  if (email === undefined || email === null) return '';
  return String(email).trim().toLowerCase();
}

export function isValidEmailFormat(email) {
  const normalized = normalizeEmail(email);
  return normalized ? EMAIL_RE.test(normalized) : false;
}

export function isPlaceholderEmail(email) {
  const normalized = normalizeEmail(email);
  return normalized.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

export function isMailableEmail(email) {
  const normalized = normalizeEmail(email);
  return normalized && isValidEmailFormat(normalized) && !isPlaceholderEmail(normalized);
}

export function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export function hasValidPhone(phone) {
  return phoneDigits(phone).length >= 7;
}

export function generatePlaceholderEmail({ company = '', lastName = '', suffix = '' } = {}) {
  const slug = `${company}-${lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'lead';
  const token = suffix || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `noemail+${slug}-${token}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function resolveLeadEmail({ email, phone, company = '', lastName = '', suffix = '' } = {}) {
  const normalized = normalizeEmail(email);
  if (normalized) {
    if (!isValidEmailFormat(normalized)) {
      throw new Error('Please enter a valid email address.');
    }
    return normalized;
  }
  if (hasValidPhone(phone)) {
    return generatePlaceholderEmail({ company, lastName, suffix });
  }
  return null;
}

export function validateEmail(email, { required = false, label = 'Email' } = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return required ? `${label} is required.` : null;
  }
  return isValidEmailFormat(normalized) ? null : 'Please enter a valid email address.';
}

export function validateEmailOrPhone({ email, phone, emailLabel = 'Email', phoneLabel = 'Phone' } = {}) {
  const hasEmail = Boolean(normalizeEmail(email));
  const hasPhone = hasValidPhone(phone);
  if (!hasEmail && !hasPhone) {
    return {
      email: `Enter ${emailLabel.toLowerCase()} or ${phoneLabel.toLowerCase()}.`,
      phone: `Enter ${phoneLabel.toLowerCase()} or ${emailLabel.toLowerCase()}.`,
    };
  }
  if (hasEmail) {
    const emailErr = validateEmail(email);
    if (emailErr) return { email: emailErr };
  }
  if (hasPhone) {
    const digits = phoneDigits(phone);
    if (digits.length < 7) return { phone: 'Please enter a valid phone number.' };
  }
  return {};
}
