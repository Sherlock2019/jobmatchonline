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

test('sample candidates/jobs bridge into their OWN real viewer pool only, ordinary demo data still does not', () => {
  const sampleDb = {
    users: [
      ...db.users,
      { id: 'real-candidate-2', role: 'candidate' },
      { id: 'sample-candidate', role: 'candidate', sample: true, sampleFor: 'real-employer' },
    ],
    jobs: [
      { id: 'real-job', employerId: 'real-employer' },
      { id: 'demo-job', employerId: 'demo-employer', demo: true },
      { id: 'sample-job', employerId: 'demo-employer', sample: true, sampleFor: 'real-candidate' },
    ],
    swipes: [
      ...db.swipes,
      { id: 'sample-like-swipe', actorId: 'sample-candidate', targetType: 'job', targetId: 'real-job' },
      { id: 'sample-employer-like', actorId: 'demo-employer', targetType: 'candidate', targetId: 'real-candidate' },
    ],
    matches: db.matches,
  };
  // The candidate this sample job was generated FOR sees it, and Sarah (its
  // employer) is reachable so her "liked you" swipe on this candidate shows up.
  const realPool = matchingPool(sampleDb, sampleDb.users.find((u) => u.id === 'real-candidate'));
  assert.ok(realPool.jobIds.has('sample-job'), 'sample job is visible to the candidate it was generated for');
  assert.ok(realPool.userIds.has('demo-employer'), 'that sample job\'s employer is reachable in this viewer\'s pool');
  assert.ok(realPool.swipes.some((s) => s.id === 'sample-employer-like'), 'the sample job\'s employer swipe on this candidate is visible');
  assert.ok(!realPool.jobIds.has('demo-job'), 'an ordinary (non-sample) demo job still does not leak into the real pool');

  // A DIFFERENT real candidate must not see someone else's starter content,
  // and Sarah's own demo dashboard must not get cluttered by it either.
  const otherRealPool = matchingPool(sampleDb, sampleDb.users.find((u) => u.id === 'real-candidate-2'));
  assert.ok(!otherRealPool.jobIds.has('sample-job'), 'a different real candidate does not see another account\'s sample job');
  const sarahPool = matchingPool(sampleDb, sampleDb.users.find((u) => u.id === 'demo-employer'));
  assert.ok(!sarahPool.jobIds.has('sample-job'), 'Sarah\'s own demo dashboard is not cluttered by jobs generated in her name');

  // The recruiter whose job the sample candidate liked sees that candidate.
  const employerPool = matchingPool(sampleDb, sampleDb.users.find((u) => u.id === 'real-employer'));
  assert.ok(employerPool.userIds.has('sample-candidate'), 'sample candidate is visible to the recruiter she was generated for');
  assert.ok(employerPool.swipes.some((s) => s.id === 'sample-like-swipe'), 'the sample candidate\'s swipe on this recruiter\'s job is visible');
});
