import { canManageNote, noteOwnerId, resolveListNoteTarget, getNoteMeta } from '../noteHelpers.js';
import { parsePersonRowId, personRecordId } from '../services/people.js';

describe('canManageNote', () => {
  it('hides edit/delete when the current user does not own the note', () => {
    expect(canManageNote(
      { id: 'n1', owner_id: 'user-1' },
      { id: 'user-2' },
      { canEdit: true },
    )).toBe(false);
  });

  it('allows the owner to edit when they have module edit access', () => {
    expect(canManageNote(
      { id: 'n1', owner_id: 'user-1' },
      { id: 'user-1' },
      { canEdit: true },
    )).toBe(true);
  });

  it('allows admins to manage any note', () => {
    expect(canManageNote(
      { id: 'n1', owner_id: 'user-1' },
      { id: 'admin' },
      { canEdit: true, isAdmin: true },
    )).toBe(true);
  });

  it('hides edit/delete when the note has no owner (non-admin)', () => {
    expect(canManageNote(
      { id: 'n1', body: 'Hello' },
      { id: 'user-2' },
      { canEdit: true },
    )).toBe(false);
  });
});

describe('noteOwnerId', () => {
  it('reads owner_id or created_by', () => {
    expect(noteOwnerId({ owner_id: 'a' })).toBe('a');
    expect(noteOwnerId({ created_by: 'b' })).toBe('b');
  });
});

describe('resolveListNoteTarget', () => {
  it('strips composite contacts-directory ids for the notes API', () => {
    const target = resolveListNoteTarget({
      moduleKey: 'contacts',
      record: { entity_type: 'contact', record_id: 'abc-123', id: 'contact:abc-123' },
      rowId: 'contact:abc-123',
      noteMeta: getNoteMeta('contacts'),
      parseRowId: parsePersonRowId,
      getRecordId: personRecordId,
    });
    expect(target).toEqual({ relatedType: 'contact', recordId: 'abc-123' });
  });

  it('maps lead rows in the contacts directory to entity_type lead', () => {
    const target = resolveListNoteTarget({
      moduleKey: 'contacts',
      record: { entity_type: 'lead', record_id: 'lead-9', id: 'lead:lead-9' },
      rowId: 'lead:lead-9',
      noteMeta: getNoteMeta('contacts'),
      parseRowId: parsePersonRowId,
      getRecordId: personRecordId,
    });
    expect(target).toEqual({ relatedType: 'lead', recordId: 'lead-9' });
  });
});
