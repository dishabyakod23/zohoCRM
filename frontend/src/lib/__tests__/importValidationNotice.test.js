import { importValidationNotice } from '../importHelpers.js';

describe('importValidationNotice', () => {
  it('prefers a clear duplicate-email message when errors mention duplicates', () => {
    expect(importValidationNotice({
      errorRecords: [
        { row: 2, message: 'Email already exists' },
        { row: 5, message: 'Duplicate email for contact' },
      ],
    })).toMatch(/already exist \(duplicate email\)/i);
  });

  it('falls back to the single unique error message otherwise', () => {
    expect(importValidationNotice({
      errorRecords: [{ row: 1, message: 'Missing last name' }],
    })).toBe('Missing last name');
  });

  it('returns null when there are no issues', () => {
    expect(importValidationNotice({})).toBeNull();
  });
});
