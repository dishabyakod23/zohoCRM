import { missingRequiredMessage } from '../formValidation.js';

describe('missingRequiredMessage', () => {
  it('returns null when every required field has a value', () => {
    expect(missingRequiredMessage([
      { label: 'Task Title', value: 'Follow up' },
      { label: 'Due Date', value: '2026-08-25' },
      { label: 'Assigned To', value: 'u1' },
    ])).toBeNull();
  });

  it('names only the field that is missing', () => {
    expect(missingRequiredMessage([
      { label: 'Task Title', value: 'Follow up' },
      { label: 'Due Date', value: '2026-08-25' },
      { label: 'Assigned To', value: '' },
    ])).toBe('Fill in Assigned To');
  });

  it('joins two missing fields with and', () => {
    expect(missingRequiredMessage([
      { label: 'Task Title', value: '' },
      { label: 'Due Date', value: '2026-08-25' },
      { label: 'Assigned To', value: '' },
    ])).toBe('Fill in Task Title and Assigned To');
  });
});
