import assert from 'node:assert/strict';
import test from 'node:test';
import { matchingPool, targetIsInMatchingPool } from './matching-pool.js';

const db = {
  users: [
    { id: 'real-candidate', role: 'candidate' },
    { id: 'real-employer', role: 'employer' },
    { id: 'demo-candidate', role: 'candidate', demo: true },
    { id: 'demo-employer', role: 'employer', demo: true },
  ],
  jobs: [
    { id: 'real-job', employerId: 'real-employer' },
    { id: 'demo-job', employerId: 'demo-employer', demo: true },
  ],
  swipes: [
    { id: 'real-swipe', actorId: 'real-candidate', targetType: 'job', targetId: 'real-job' },
    { id: 'demo-swipe', actorId: 'demo-candidate', targetType: 'job', targetId: 'demo-job' },
    { id: 'cross-pool-swipe', actorId: 'real-candidate', targetType: 'job', targetId: 'demo-job' },
  ],
  matches: [
    { id: 'real-match', candidateId: 'real-candidate', employerId: 'real-employer', jobId: 'real-job' },
    { id: 'demo-match', candidateId: 'demo-candidate', employerId: 'demo-employer', jobId: 'demo-job' },
  ],
};

test('real matching excludes every demo account, job, swipe, and match', () => {
  const pool = matchingPool(db, db.users[0]);
  assert.deepEqual(pool.users.map((item) => item.id), ['real-candidate', 'real-employer']);
  assert.deepEqual(pool.jobs.map((item) => item.id), ['real-job']);
  assert.deepEqual(pool.swipes.map((item) => item.id), ['real-swipe']);
  assert.deepEqual(pool.matches.map((item) => item.id), ['real-match']);
});

test('demo matching is isolated and cross-pool swipe targets are rejected', () => {
  const pool = matchingPool(db, db.users[2]);
  assert.deepEqual(pool.users.map((item) => item.id), ['demo-candidate', 'demo-employer']);
  assert.deepEqual(pool.jobs.map((item) => item.id), ['demo-job']);
  assert.deepEqual(pool.swipes.map((item) => item.id), ['demo-swipe']);
  assert.deepEqual(pool.matches.map((item) => item.id), ['demo-match']);
  assert.equal(targetIsInMatchingPool(db, db.users[0], 'job', 'demo-job'), false);
  assert.equal(targetIsInMatchingPool(db, db.users[2], 'candidate', 'real-candidate'), false);
});

test('sample candidates/jobs bridge into a real viewer pool, ordinary demo data still does not', () => {
  const sampleDb = {
    users: [...db.users, { id: 'sample-candidate', role: 'candidate', sample: true }],
    jobs: [...db.jobs, { id: 'sample-job', employerId: 'demo-employer', sample: true }],
    swipes: [
      ...db.swipes,
      { id: 'sample-like-swipe', actorId: 'sample-candidate', targetType: 'job', targetId: 'real-job' },
      { id: 'sample-employer-like', actorId: 'demo-employer', targetType: 'candidate', targetId: 'real-candidate' },
    ],
    matches: db.matches,
  };
  const realPool = matchingPool(sampleDb, sampleDb.users[0]);
  assert.ok(realPool.userIds.has('sample-candidate'), 'sample candidate is visible to a real viewer');
  assert.ok(realPool.jobIds.has('sample-job'), 'sample job is visible to a real viewer');
  assert.ok(realPool.userIds.has('demo-employer'), 'a sample job\'s employer is reachable in a real viewer pool');
  assert.ok(realPool.swipes.some((s) => s.id === 'sample-like-swipe'), 'the sample candidate\'s swipe on a real job is visible');
  assert.ok(realPool.swipes.some((s) => s.id === 'sample-employer-like'), 'the sample job\'s employer swipe on a real candidate is visible');
  assert.ok(!realPool.jobIds.has('demo-job'), 'an ordinary (non-sample) demo job still does not leak into the real pool');
});
