import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from './seed.js';
import { isStrongRoleMatch, scoreCandidateForJob } from './matching.js';

test('flagship demo profiles and reference dashboard records are seeded', () => {
  const seed = createSeed();
  assert.equal(seed.users[0].id, 'candidate-demo');
  assert.equal(seed.users[0].name, 'Sofia Okafor');
  assert.equal(seed.users[1].id, 'employer-demo');
  assert.equal(seed.users[1].name, 'Sarah Thompson');

  const expectedJobs = [
    ['j-1', 'AWS', 'Lead AI Engineer'],
    ['j-2', 'Microsoft', 'Senior AI Platform Engineer'],
    ['j-6', 'Rackspace Technology', 'Cloud Solutions Architect'],
  ];
  for (const [id, company, title] of expectedJobs) {
    const job = seed.jobs.find((item) => item.id === id);
    assert.equal(job?.company, company);
    assert.equal(job?.title, title);
  }

  assert.deepEqual(
    seed.users.filter((user) => ['c-1', 'c-2', 'c-3', 'c-4'].includes(user.id)).map((user) => user.name),
    ['David Nguyen', 'Maria Garcia', 'John Smith', 'Linh Tran'],
  );
});

test('Sofia and Sarah dashboard relationships are real and score at 90%+', () => {
  const seed = createSeed();
  const sofia = seed.users.find((user) => user.id === 'candidate-demo');
  const sarahCandidates = seed.users.filter((user) => ['c-1', 'c-2', 'c-3', 'c-4'].includes(user.id));
  const featuredJobs = ['j-1', 'j-2', 'j-6'].map((id) => seed.jobs.find((job) => job.id === id));
  const leadJob = featuredJobs[0];

  for (const job of featuredJobs) {
    const match = scoreCandidateForJob(sofia, job);
    assert.ok(match.score >= 90, `${job.title} should score 90%+ for Sofia`);
    assert.ok(seed.swipes.some((swipe) => swipe.targetId === sofia.id && swipe.jobId === job.id && swipe.direction === 'like'));
  }

  for (const candidate of sarahCandidates) {
    const match = scoreCandidateForJob(candidate, { ...leadJob, distanceKm: candidate.distanceKm });
    assert.ok(isStrongRoleMatch(match), `${candidate.name} should be a strong Lead AI Engineer match`);
    assert.ok(seed.swipes.some((swipe) => swipe.actorId === candidate.id && swipe.targetId === leadJob.id && swipe.direction === 'like'));
  }
});
