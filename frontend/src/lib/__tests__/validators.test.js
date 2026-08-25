import { validateEmail, validatePhone, validateRequired, validatePastDate } from '../validators.js';

describe('validateEmail', () => {
  it('returns null for empty input (field is optional at this layer)', () => {
    expect(validateEmail('')).toBeNull();
    expect(validateEmail(undefined)).toBeNull();
  });

  it('accepts well-formed addresses', () => {
    expect(validateEmail('a@b.com')).toBeNull();
    expect(validateEmail('first.last+tag@sub.example.co')).toBeNull();
  });

  it('rejects addresses missing @ or domain', () => {
    expect(validateEmail('not-an-email')).toMatch(/valid email/i);
    expect(validateEmail('a@b')).toMatch(/valid email/i);
    expect(validateEmail('a@')).toMatch(/valid email/i);
    expect(validateEmail('@b.com')).toMatch(/valid email/i);
  });

  it('rejects addresses with whitespace', () => {
    expect(validateEmail('a b@c.com')).toMatch(/valid email/i);
  });
});

describe('validatePhone', () => {
  it('returns null for empty input (field is optional at this layer)', () => {
    expect(validatePhone('')).toBeNull();
    expect(validatePhone(null)).toBeNull();
  });

  it('accepts numbers with at least 7 digits, ignoring formatting characters', () => {
    expect(validatePhone('123-456-7890')).toBeNull();
    expect(validatePhone('+1 (234) 567-8900')).toBeNull();
    expect(validatePhone('1234567')).toBeNull();
  });

  it('rejects numbers with fewer than 7 digits', () => {
    expect(validatePhone('12345')).toMatch(/valid phone/i);
    expect(validatePhone('abc-def')).toMatch(/valid phone/i);
  });

  it('rejects numbers with more than 15 digits (E.164 max)', () => {
    expect(validatePhone('1234567890123456')).toMatch(/15 digits/i);
    expect(validatePhone('+1 (234) 567-8901 23456')).toMatch(/15 digits/i);
  });

  it('accepts numbers with exactly 15 digits', () => {
    expect(validatePhone('123456789012345')).toBeNull();
  });
});

describe('validateRequired', () => {
  it('flags missing, null, undefined, and whitespace-only values', () => {
    const errs = validateRequired(
      { first_name: 'First Name', last_name: 'Last Name', email: 'Email', title: 'Title' },
      { first_name: '', last_name: null, email: undefined, title: '   ' },
    );
    expect(Object.keys(errs).sort()).toEqual(['email', 'first_name', 'last_name', 'title']);
    expect(errs.first_name).toBe('First Name is required.');
  });

  it('does not flag present values, including 0 and false', () => {
    const errs = validateRequired(
      { count: 'Count', active: 'Active' },
      { count: 0, active: false },
    );
    expect(errs).toEqual({});
  });

  it('returns an empty object when every field is populated', () => {
    const errs = validateRequired({ name: 'Name' }, { name: 'Ada' });
    expect(errs).toEqual({});
  });
});

function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

describe('validatePastDate', () => {
  it('returns null for empty input', () => {
    expect(validatePastDate('')).toBeNull();
  });

  it('rejects dates before today', () => {
    expect(validatePastDate('2000-01-01', 'Start Date')).toBe('Start Date cannot be in the past.');
  });

  it('accepts today and future dates, regardless of the machine timezone', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(validatePastDate(localDateString(future))).toBeNull();
    expect(validatePastDate(localDateString(new Date()))).toBeNull();
  });

  it('does not misclassify today as past due to UTC/local date-parsing drift', () => {
    // Regression test: date-only strings parse as UTC midnight per the ES spec; a naive
    // `new Date(dateStr) < todayAtLocalMidnight` comparison incorrectly rejects "today" in
    // any timezone behind UTC. Pin a date string and assert it round-trips as "not past"
    // when it represents the same local calendar day as `today`.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(validatePastDate(localDateString(today))).toBeNull();
  });
});
