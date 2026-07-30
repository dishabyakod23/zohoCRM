import {
  recordOwnerId,
  isRecordOwner,
  canEditRecord,
  canDeleteRecord,
  isBusinessRep,
} from '../recordPermissions.js';
import { getRolePermissions } from '../roles.js';

const repPermissions = getRolePermissions('sales_rep');
const adminPermissions = getRolePermissions('super_admin');
const viewerPermissions = getRolePermissions('viewer');

describe('recordOwnerId', () => {
  it('reads owner_id first', () => {
    expect(recordOwnerId({ owner_id: 'u1', assigned_to: 'u2' })).toBe('u1');
  });

  it('falls back through owner.id, assigned_to, assigned_to_id', () => {
    expect(recordOwnerId({ owner: { id: 'u1' } })).toBe('u1');
    expect(recordOwnerId({ assigned_to: 'u1' })).toBe('u1');
    expect(recordOwnerId({ assigned_to_id: 'u1' })).toBe('u1');
  });

  it('returns null for a record with no owner info, or no record at all', () => {
    expect(recordOwnerId({})).toBeNull();
    expect(recordOwnerId(null)).toBeNull();
  });
});

describe('isRecordOwner', () => {
  it('is true when the user id matches the record owner (as strings)', () => {
    expect(isRecordOwner({ id: 'u1' }, { owner_id: 'u1' })).toBe(true);
    expect(isRecordOwner({ id: 1 }, { owner_id: '1' })).toBe(true);
  });

  it('is false for a different owner, missing user, missing record, or ownerless record', () => {
    expect(isRecordOwner({ id: 'u1' }, { owner_id: 'u2' })).toBe(false);
    expect(isRecordOwner(null, { owner_id: 'u1' })).toBe(false);
    expect(isRecordOwner({ id: 'u1' }, null)).toBe(false);
    expect(isRecordOwner({ id: 'u1' }, {})).toBe(false);
  });
});

describe('canEditRecord', () => {
  it('lets an admin edit any record regardless of ownership', () => {
    expect(canEditRecord({ id: 'admin1', role: 'super_admin' }, { owner_id: 'someone-else' }, adminPermissions)).toBe(true);
  });

  it('lets a sales rep edit only their own record', () => {
    const rep = { id: 'rep1', role: 'sales_rep' };
    expect(canEditRecord(rep, { owner_id: 'rep1' }, repPermissions)).toBe(true);
    expect(canEditRecord(rep, { owner_id: 'rep2' }, repPermissions)).toBe(false);
  });

  it('never lets a viewer edit, even their own record', () => {
    const viewer = { id: 'v1', role: 'viewer' };
    expect(canEditRecord(viewer, { owner_id: 'v1' }, viewerPermissions)).toBe(false);
  });

  it('returns false when there is no record', () => {
    expect(canEditRecord({ id: 'admin1', role: 'super_admin' }, null, adminPermissions)).toBe(false);
  });

  it('denies an unowned record for a non-admin (fail-closed, not fail-open)', () => {
    const rep = { id: 'rep1', role: 'sales_rep' };
    expect(canEditRecord(rep, { owner_id: null }, repPermissions)).toBe(false);
  });
});

describe('canDeleteRecord', () => {
  it('mirrors canEditRecord semantics for delete', () => {
    const rep = { id: 'rep1', role: 'sales_rep' };
    expect(canDeleteRecord(rep, { owner_id: 'rep1' }, repPermissions)).toBe(true);
    expect(canDeleteRecord(rep, { owner_id: 'rep2' }, repPermissions)).toBe(false);
    expect(canDeleteRecord({ id: 'v1', role: 'viewer' }, { owner_id: 'v1' }, viewerPermissions)).toBe(false);
  });
});

describe('isBusinessRep', () => {
  it('is true only for the sales_rep role, including legacy aliases', () => {
    expect(isBusinessRep('sales_rep')).toBe(true);
    expect(isBusinessRep('business_rep')).toBe(true);
    expect(isBusinessRep('rep')).toBe(true);
  });

  it('is false for admin-tier and viewer roles', () => {
    expect(isBusinessRep('super_admin')).toBe(false);
    expect(isBusinessRep('sales_manager')).toBe(false);
    expect(isBusinessRep('viewer')).toBe(false);
    expect(isBusinessRep(undefined)).toBe(false);
  });
});
