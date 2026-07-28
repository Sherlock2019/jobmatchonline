import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync } from 'node:fs';

/* Route-level smoke tests.
 *
 * The other test files cover the billing modules in isolation, which means a
 * route handler can call an undefined helper and every one of them still
 * passes — the page just 500s in production. These drive real HTTP requests
 * through the real app so that class of mistake fails here instead of there.
 *
 * The app is imported dynamically, not with a static `import`: static imports
 * are hoisted above everything else in the module, so the env vars below would
 * be set too late and the app would bind its real port and open the real
 * database. */
const DB_PATH = `/tmp/jobmatch-routes-test-${process.pid}.json`;

let server;
let base;

async function listening() {
  if (base) return base;
  process.env.NODE_ENV = 'test'; // stops index.js from listening on the real port
  process.env.DB_PATH = DB_PATH; // scratch database, never the developer's own
  const { app } = await import('./index.js');
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  return base;
}

async function get(path) {
  const response = await fetch(`${await listening()}${path}`);
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

after(() => {
  server?.close();
  try { unlinkSync(DB_PATH); } catch { /* already gone */ }
});

test('health endpoint answers', async () => {
  const { status, body } = await get('/api/health');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

test('candidate bootstrap returns a deck with no card wrongly promoted', async () => {
  const { status, body } = await get('/api/bootstrap?userId=candidate-demo');
  assert.equal(status, 200);
  assert.ok(body.jobs.length > 0);
  assert.equal(body.jobs.filter((job) => job.promoted).length, 0, 'nothing is promoted without a boost');
  assert.ok(body.jobs.every((job) => typeof job.match?.score === 'number'), 'every card keeps its match score');
});

test('recruiter subscription payload carries plan, seats and entitlements', async () => {
  const { status, body } = await get('/api/billing/subscription?userId=employer-demo');
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(body)}`);
  assert.ok(body.plan, 'plan summary is present');
  assert.ok(body.plan.display && body.plan.currency, 'plan summary is populated');
  assert.ok(body.team, 'seat info is present');
  assert.equal(body.team.seatsUsed >= 1, true, 'the recruiter always holds at least their own seat');
  assert.ok(body.team.seatsAllowed >= body.team.seatsUsed, 'seats used never exceed seats allowed');
  assert.ok(body.entitlements, 'entitlements are still returned');
  assert.equal(body.founding, undefined, 'the founding cohort is gone, not half-removed');
  assert.equal(body.trial.days, 90, 'one trial length, the same for everybody');
});

test('a solo recruiter sees themselves as the only seat holder', async () => {
  const { body } = await get('/api/billing/team?userId=employer-demo');
  assert.equal(body.isOwner, true);
  assert.equal(body.members.length, 1);
  assert.equal(body.members[0].status, 'active');
});

test('admin billing surfaces refuse anonymous callers', async () => {
  for (const path of ['/api/admin/billing/plans', '/api/admin/billing/overview']) {
    const { status } = await get(path);
    assert.equal(status, 403, `${path} must not be readable without an admin session`);
  }
});

test('a candidate account has no recruiter subscription', async () => {
  const { status } = await get('/api/billing/subscription?userId=candidate-demo');
  assert.equal(status, 400, 'candidates are never billed, so this is a client error not a plan');
});
