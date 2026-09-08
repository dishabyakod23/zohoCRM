import {
  documentToHistoryEntry,
  mergeEntityHistoryWithRelated,
  normalizeAuditLog,
  noteToHistoryEntry,
} from '../auditLogs.js';

describe('normalizeAuditLog — actor name resolution ("Super Admin" regression)', () => {
  it('prefers the actor email over a role-label user_name when a nested user object is present', () => {
    const log = {
      id: '1',
      action: 'update',
      user_name: 'Super Admin',
      user: { first_name: 'Super', last_name: 'Admin', email: 'admin@sterlite.com' },
    };
    expect(normalizeAuditLog(log).user_name).toBe('admin@sterlite.com');
  });

  it('keeps a real user_name unchanged even if a nested user object also exists', () => {
    const log = {
      id: '2',
      action: 'create',
      user_name: 'Raksha Chaturvedi',
      user: { first_name: 'Raksha', last_name: 'Chaturvedi', email: 'raksha@sterlite.com' },
    };
    expect(normalizeAuditLog(log).user_name).toBe('Raksha Chaturvedi');
  });

  it('falls back to the role-label name when no nested user/email is available at all', () => {
    const log = { id: '3', action: 'update', user_name: 'Super Admin' };
    expect(normalizeAuditLog(log).user_name).toBe('Super Admin');
  });

  it('resolves from the nested user object when user_name is entirely absent', () => {
    const log = { id: '4', action: 'update', user: { first_name: 'Raksha', last_name: 'Chaturvedi' } };
    expect(normalizeAuditLog(log).user_name).toBe('Raksha Chaturvedi');
  });

  it('falls back to "—" when there is no name information anywhere', () => {
    const log = { id: '5', action: 'update' };
    expect(normalizeAuditLog(log).user_name).toBe('—');
  });
});

describe('mergeEntityHistoryWithRelated — notes and files on History tab', () => {
  it('appends note and file entries sorted by newest first', () => {
    const audit = [
      {
        id: 'a1',
        action: 'create',
        entity_type: 'lead',
        entity_id: 'lead-1',
        summary: 'Created Lead',
        created_at: '2026-09-01T10:00:00.000Z',
      },
    ].map(normalizeAuditLog);

    const merged = mergeEntityHistoryWithRelated(audit, {
      notes: [
        {
          id: 'n1',
          body: 'Follow up tomorrow',
          owner_name: 'Alex',
          created_at: '2026-09-08T12:00:00.000Z',
        },
      ],
      documents: [
        {
          id: 'd1',
          name: 'quote.pdf',
          owner_name: 'Alex',
          created_at: '2026-09-08T11:00:00.000Z',
        },
      ],
    });

    expect(merged.map((e) => e.id)).toEqual([
      'related-note-n1',
      'related-document-d1',
      'a1',
    ]);
    expect(merged[0].summary).toContain('Added note');
    expect(merged[1].summary).toContain('Uploaded file — quote.pdf');
  });

  it('skips related rows already present in audit history', () => {
    const audit = [
      normalizeAuditLog({
        id: 'a-note',
        action: 'create',
        entity_type: 'note',
        entity_id: 'n1',
        summary: 'Created Note',
        created_at: '2026-09-08T12:00:00.000Z',
      }),
    ];
    const merged = mergeEntityHistoryWithRelated(audit, {
      notes: [{ id: 'n1', body: 'dup', created_at: '2026-09-08T12:00:00.000Z' }],
    });
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('a-note');
  });

  it('marks edited notes as updates', () => {
    const entry = noteToHistoryEntry({
      id: 'n2',
      body: 'Revised',
      created_at: '2026-09-08T10:00:00.000Z',
      updated_at: '2026-09-08T12:00:00.000Z',
      owner_name: 'Alex',
    });
    expect(entry.action).toBe('update');
    expect(entry.summary).toContain('Updated note');
  });

  it('builds a file history entry from a document', () => {
    const entry = documentToHistoryEntry({
      id: 'd2',
      document_name: 'deck.pptx',
      created_at: '2026-09-08T09:00:00.000Z',
    });
    expect(entry.action_label).toBe('File');
    expect(entry.summary).toBe('Uploaded file — deck.pptx');
  });
});
