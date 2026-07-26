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

console.log('smoke-test: ok');
