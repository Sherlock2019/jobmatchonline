import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, validPassword, rateLimit } from './auth.js';

test('password hashing round-trips and rejects wrong passwords', () => {
  const stored = hashPassword('correct horse battery');
  assert.ok(stored.startsWith('scrypt:'));
  assert.equal(verifyPassword('correct horse battery', stored), true);
  assert.equal(verifyPassword('wrong password', stored), false);
  assert.equal(verifyPassword('correct horse battery', 'garbage'), false);
  assert.equal(verifyPassword('correct horse battery', undefined), false);
});

test('password policy enforces minimum length', () => {
  assert.equal(validPassword('short'), false);
  assert.equal(validPassword('long enough pw'), true);
  assert.equal(validPassword(12345678), false);
});

test('rate limiter blocks after the window fills and sets Retry-After', () => {
  const limiter = rateLimit({ windowMs: 60000, max: 2, bucket: 'test' });
  const req = { ip: '1.2.3.4' };
  const makeRes = () => { const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; return res; };
  let passed = 0;
  limiter(req, makeRes(), () => { passed += 1; });
  limiter(req, makeRes(), () => { passed += 1; });
  const blocked = makeRes();
  limiter(req, blocked, () => { passed += 1; });
  assert.equal(passed, 2);
  assert.equal(blocked.statusCode, 429);
  assert.ok(blocked.headers['Retry-After']);
  // a different IP is unaffected
  let otherPassed = 0;
  limiter({ ip: '5.6.7.8' }, makeRes(), () => { otherPassed += 1; });
  assert.equal(otherPassed, 1);
});
