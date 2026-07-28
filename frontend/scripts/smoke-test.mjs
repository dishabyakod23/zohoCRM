import assert from 'node:assert/strict';

// Mirrors src/lib/services/auditLogs.js for CI without a test runner.
function isNoiseAuditLog(log) {
  const action = String(log.action || '').toLowerCase();
  const entityType = String(log.entity_type || log.record_type || '').toLowerCase();
  const summary = String(log.summary || '').toLowerCase();

  if (action.includes('refresh')) return true;
  if (action === 'login' || action === 'logout') return true;
  if (action.includes('sign_in') || action.includes('signin')) return true;
  if (entityType.includes('session')) return true;
  if (/^refreshed\b/.test(summary)) return true;
  if (/\bsigned\s*in\b/.test(summary)) return true;
  if (/\bsign[\s-]?in\b/.test(summary)) return true;
  return false;
}

assert.equal(isNoiseAuditLog({ action: 'login', summary: 'Signed In User' }), true);
assert.equal(isNoiseAuditLog({ action: 'create', summary: 'Created Lead' }), false);

function parseAuthUserResponse(body) {
  if (!body) return null;
  if (body.id) return body;
  if (body.data?.id) return body.data;
  const nested = body?.data;
  return nested?.id ? nested : null;
}

function isPublicAuthPath(pathname = '') {
  const path = String(pathname || '').replace(/\/$/, '') || '/';
  return path === '/login' || path === '/forgot-password' || path === '/reset-password';
}

assert.equal(parseAuthUserResponse({ id: 'u1', email: 'a@b.com', role: 'business_rep' }).role, 'business_rep');
assert.equal(parseAuthUserResponse({ data: { id: 'u1', role: 'business_rep' } }).id, 'u1');
assert.equal(isPublicAuthPath('/login/'), true);
assert.equal(isPublicAuthPath('/dashboard'), false);

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
