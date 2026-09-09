import { getApiError, getApiFieldErrors, formatApiFieldError } from '../api.js';

describe('API validation error parsing', () => {
  it('formats invalid format as Field is invalid', () => {
    expect(formatApiFieldError('phone', 'invalid format')).toBe('Phone is invalid.');
  });

  it('maps errors[] onto field messages and prefers them over generic detail', () => {
    const err = {
      response: {
        data: {
          detail: 'Please correct the invalid fields.',
          code: 'VALIDATION_ERROR',
          errors: [{ field: 'phone', message: 'invalid format' }],
        },
      },
    };
    expect(getApiFieldErrors(err)).toEqual({ phone: 'Phone is invalid.' });
    expect(getApiError(err)).toBe('Phone is invalid.');
  });
});
