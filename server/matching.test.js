import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMutualMatch, likesRemainingToday, scoreCandidateForJob } from './matching.js';

test('scores a strong candidate fit with explainable evidence', () => {
  const result = scoreCandidateForJob(
    { skills: ['Figma', 'Research'], languages: ['English'], experienceLevel: 'senior' },
    { requiredSkills: ['Figma', 'Research', 'Leadership'], requiredLanguages: ['English'], experienceLevel: 'senior' }
  );
  assert.equal(result.score, 80);
  assert.deepEqual(result.matchedSkills, ['Figma', 'Research']);
  assert.equal(result.experienceFit, true);
});

test('creates a match only for reciprocal intent', () => {
  const db = { jobs: [{ id: 'job', employerId: 'employer' }], swipes: [{ actorId: 'employer', targetType: 'candidate', targetId: 'candidate', direction: 'like' }] };
  const result = detectMutualMatch({ actorId: 'candidate', targetType: 'job', targetId: 'job', direction: 'like' }, db);
  assert.deepEqual(result, { candidateId: 'candidate', jobId: 'job', employerId: 'employer' });
  assert.equal(detectMutualMatch({ actorId: 'candidate', targetType: 'job', targetId: 'job', direction: 'pass' }, db), null);
});

test('enforces the daily like allowance', () => {
  const now = Date.UTC(2026, 6, 19, 12);
  const swipes = Array.from({ length: 7 }, (_, index) => ({ actorId: 'u', direction: 'like', createdAt: now - index * 1000 }));
  assert.equal(likesRemainingToday(swipes, 'u', now), 43);
});
