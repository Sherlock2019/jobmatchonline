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
