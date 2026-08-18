import {
  formatFileSize,
  matchesRelatedRecord,
  DOCUMENT_FILE_ACCEPT,
  resolveDocumentOwnerName,
  normalizeDocument,
  documentPreviewMode,
  canPreviewDocument,
  documentFileName,
  documentMimeType,
} from '../documents.js';

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

describe('resolveDocumentOwnerName', () => {
  const userMap = {
    u1: { id: 'u1', first_name: 'Raksha', last_name: 'Chaturvedi', email: 'raksha@example.com' },
  };

  it('uses nested owner object from the API', () => {
    expect(resolveDocumentOwnerName({
      owner: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
    })).toBe('Ada Lovelace');
  });

  it('resolves owner_id through the users lookup map', () => {
    expect(resolveDocumentOwnerName({ owner_id: 'u1' }, userMap)).toBe('Raksha Chaturvedi');
  });

  it('falls back to created_by when owner fields are missing', () => {
    expect(resolveDocumentOwnerName({
      created_by: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
    })).toBe('Jane Doe');
  });

  it('returns null when no owner data is available', () => {
    expect(resolveDocumentOwnerName({})).toBeNull();
    expect(normalizeDocument({ name: 'file.pdf' }).owner_name).toBeNull();
  });
});

describe('document preview helpers', () => {
  it('detects previewable PDF and image files', () => {
    expect(documentPreviewMode({ name: 'deck.pdf' })).toBe('pdf');
    expect(documentPreviewMode({ name: 'photo.png' })).toBe('image');
    expect(canPreviewDocument({ name: 'notes.txt' })).toBe(true);
  });

  it('marks office files as non-previewable in the browser', () => {
    expect(documentPreviewMode({ name: 'proposal.pptx' })).toBe('none');
    expect(documentPreviewMode({ name: 'scope.docx' })).toBe('none');
    expect(canPreviewDocument({ name: 'sheet.xlsx' })).toBe(false);
  });

  it('resolves file names and mime types from document metadata', () => {
    expect(documentFileName({ document_name: 'TVS Proposal.pptx' })).toBe('TVS Proposal.pptx');
    expect(documentMimeType({ name: 'report.pdf' })).toContain('pdf');
  });
});
