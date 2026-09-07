import { makeFieldSetter, trimStartValue, trimStringFields, sanitizePhoneDigits } from '../formInput.js';

describe('formInput helpers', () => {
  it('trimStartValue removes leading whitespace only', () => {
    expect(trimStartValue('  hello  ')).toBe('hello  ');
    expect(trimStartValue('hello')).toBe('hello');
    expect(trimStartValue(12)).toBe(12);
  });

  it('trimStringFields trims all string properties', () => {
    expect(trimStringFields({
      first_name: '  Ada ',
      age: 1,
      note: '  x',
    })).toEqual({
      first_name: 'Ada',
      age: 1,
      note: 'x',
    });
  });

  it('makeFieldSetter updates form with trimStart', () => {
    let form = { first_name: '' };
    let errors = { first_name: 'Required' };
    const setForm = (updater) => { form = updater(form); };
    const setErrors = (updater) => { errors = updater(errors); };
    const set = makeFieldSetter(setForm, setErrors);
    set('first_name')({ target: { value: '  Jane' } });
    expect(form.first_name).toBe('Jane');
    expect(errors.first_name).toBeNull();
  });

  it('sanitizePhoneDigits strips letters and special characters', () => {
    expect(sanitizePhoneDigits('uydfutdutdyutd')).toBe('');
    expect(sanitizePhoneDigits('+91-98765 43210')).toBe('919876543210');
    expect(sanitizePhoneDigits('123abc456')).toBe('123456');
  });

  it('makeFieldSetter keeps only digits for phone and mobile', () => {
    let form = { phone: '', mobile: '' };
    const setForm = (updater) => { form = updater(form); };
    const set = makeFieldSetter(setForm);
    set('phone')({ target: { value: 'uydfutdutdyutd' } });
    set('mobile')({ target: { value: '98ab#76' } });
    expect(form.phone).toBe('');
    expect(form.mobile).toBe('9876');
  });
});
