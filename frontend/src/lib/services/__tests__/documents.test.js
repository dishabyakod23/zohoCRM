import { formatFileSize, matchesRelatedRecord, DOCUMENT_FILE_ACCEPT } from '../documents.js';

describe('formatFileSize', () => {
  it('formats bytes, KB, and MB', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });

  it('returns a dash for missing sizes', () => {
    expect(formatFileSize(null)).toBe('—');
    expect(formatFileSize(0)).toBe('—');
  });
});

describe('matchesRelatedRecord', () => {
  it('matches related_type and related_id', () => {
    expect(matchesRelatedRecord(
      { related_type: 'contact', related_id: 'c1' },
      'contact',
      'c1',
    )).toBe(true);
  });

  it('accepts related_entity_* aliases', () => {
    expect(matchesRelatedRecord(
      { related_entity_type: 'Lead', related_entity_id: 'l1' },
      'lead',
      'l1',
    )).toBe(true);
  });

  it('rejects a different record', () => {
    expect(matchesRelatedRecord(
      { related_type: 'contact', related_id: 'c1' },
      'contact',
      'c2',
    )).toBe(false);
  });
});

describe('DOCUMENT_FILE_ACCEPT', () => {
  it('includes common office, csv, and image extensions', () => {
    expect(DOCUMENT_FILE_ACCEPT).toContain('.pdf');
    expect(DOCUMENT_FILE_ACCEPT).toContain('.csv');
    expect(DOCUMENT_FILE_ACCEPT).toContain('.ppt');
    expect(DOCUMENT_FILE_ACCEPT).toContain('.doc');
    expect(DOCUMENT_FILE_ACCEPT).toContain('.jpg');
    expect(DOCUMENT_FILE_ACCEPT).toContain('.png');
  });
});
