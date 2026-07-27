import assert from 'node:assert/strict';

// Mirrors src/lib/safeRedirect.js for CI without a test runner.
function safeNextPath(next, fallback = '/dashboard') {
  if (!next || typeof next !== 'string') return fallback;
  const path = next.trim();
  if (!path.startsWith('/') || path.includes('//') || path.includes('://')) return fallback;
  return path;
}

assert.equal(safeNextPath('/contacts/abc'), '/contacts/abc');
assert.equal(safeNextPath('//evil.com'), '/dashboard');
assert.equal(safeNextPath('/dashboard//evil'), '/dashboard');
assert.equal(safeNextPath('https://evil.com'), '/dashboard');
assert.equal(safeNextPath(null), '/dashboard');

function recordOwnerId(record) {
  if (!record) return null;
  return record.owner_id ?? record.owner?.id ?? record.assigned_to ?? null;
}

function isRecordOwner(user, record) {
  if (!user?.id || !record) return false;
  const ownerId = recordOwnerId(record);
  if (!ownerId) return false;
  return String(ownerId) === String(user.id);
}

function canEditRecord(user, record, isAdmin) {
  if (!record) return false;
  if (isAdmin) return true;
  return isRecordOwner(user, record);
}

assert.equal(canEditRecord({ id: 'u1' }, { owner_id: 'u1' }, false), true);
assert.equal(canEditRecord({ id: 'u1' }, { owner_id: 'u2' }, false), false);
assert.equal(canEditRecord({ id: 'u1' }, { owner_id: 'u2' }, true), true);

console.log('smoke-test: ok');
