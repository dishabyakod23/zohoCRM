import { makeFieldSetter, trimStartValue, trimStringFields } from '../formInput.js';

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
});
