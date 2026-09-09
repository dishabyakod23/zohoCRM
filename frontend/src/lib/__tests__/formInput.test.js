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

  it('sanitizePhoneDigits keeps + and separators, strips letters', () => {
    expect(sanitizePhoneDigits('uydfutdutdyutd')).toBe('');
    expect(sanitizePhoneDigits('+91-98765 43210')).toBe('+91-98765 43210');
    expect(sanitizePhoneDigits('123abc456')).toBe('123456');
    expect(sanitizePhoneDigits('++91')).toBe('+91');
  });

  it('makeFieldSetter allows + in phone fields and strips letters', () => {
    let form = { phone: '', mobile: '' };
    const setForm = (updater) => { form = updater(form); };
    const set = makeFieldSetter(setForm);
    set('phone')({ target: { value: 'uydfutdutdyutd' } });
    set('mobile')({ target: { value: '+91 98ab#76' } });
    expect(form.phone).toBe('');
    expect(form.mobile).toBe('+91 9876');
  });

  it('makeFieldSetter sets an inline phone error while typing short numbers', () => {
    let form = { phone: '' };
    let errors = {};
    const setForm = (updater) => { form = updater(form); };
    const setErrors = (updater) => { errors = updater(errors); };
    const set = makeFieldSetter(setForm, setErrors);
    set('phone')({ target: { value: '12345' } });
    expect(form.phone).toBe('12345');
    expect(errors.phone).toBe('Phone is invalid.');
    set('phone')({ target: { value: '+91 1234567890' } });
    expect(errors.phone).toBeNull();
  });
});
