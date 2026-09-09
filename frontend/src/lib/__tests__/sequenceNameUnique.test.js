import { isSequenceNameTaken, normalizeSequenceNameKey } from '../sequenceHelpers.js';

describe('sequence name uniqueness helpers', () => {
  it('normalizes names for comparison', () => {
    expect(normalizeSequenceNameKey('  Sequence Mail  ')).toBe('sequence mail');
  });

  it('detects duplicate names case-insensitively', () => {
    const rows = [
      { id: '1', name: 'Sequence Mail' },
      { id: '2', name: 'Other' },
    ];
    expect(isSequenceNameTaken('sequence mail', rows)).toBe(true);
    expect(isSequenceNameTaken('SEQUENCE MAIL', rows)).toBe(true);
    expect(isSequenceNameTaken('Unique Name', rows)).toBe(false);
  });

  it('ignores the sequence being edited', () => {
    const rows = [{ id: '1', name: 'Sequence Mail' }];
    expect(isSequenceNameTaken('Sequence Mail', rows, { excludeId: '1' })).toBe(false);
    expect(isSequenceNameTaken('Sequence Mail', rows, { excludeId: '2' })).toBe(true);
  });
});
