import { canManageNote, noteOwnerId } from '../noteHelpers.js';

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

  it('reads nested created_by.id', () => {
    expect(noteOwnerId({ created_by: { id: 'nested' } })).toBe('nested');
  });
});
