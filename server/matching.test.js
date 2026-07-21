import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMutualMatch, likesRemainingToday, salaryCompatibility, scoreCandidateForJob } from './matching.js';

test('scores a candidate fit with a six-factor breakdown', () => {
  const result = scoreCandidateForJob(
    { skills: ['Figma', 'Research'], languages: ['English'], experienceLevel: 'senior' },
    { requiredSkills: ['Figma', 'Research', 'Leadership'], requiredLanguages: ['English'], experienceLevel: 'senior' }
  );
  // skills 2/3 * .4 + seniority 1 * .15 + neutral salary/.15, distance/.1, mode/.1, type/.1
  assert.equal(result.score, 70);
  assert.deepEqual(result.matchedSkills, ['Figma', 'Research']);
  assert.equal(result.experienceFit, true);
  assert.equal(result.breakdown.length, 6);
});

test('weighted skills move the score toward priority skills', () => {
  const job = {
    requiredSkills: ['React', 'TypeScript', 'GraphQL'],
    requiredSkillsDetail: [{ name: 'React', weight: 3 }, { name: 'TypeScript', weight: 3 }, { name: 'GraphQL', weight: 1 }],
    experienceLevel: 'mid',
  };
  const priorityMatch = scoreCandidateForJob({ skills: ['React', 'TypeScript'], languages: [], experienceLevel: 'mid' }, job);
  const minorMatch = scoreCandidateForJob({ skills: ['GraphQL'], languages: [], experienceLevel: 'mid' }, job);
  assert.ok(priorityMatch.score > minorMatch.score);
});

test('full-fit candidate scores 100 and salary status is tracked', () => {
  const result = scoreCandidateForJob(
    {
      skills: ['React'], languages: [], experienceLevel: 'senior', distanceRangeKm: 30,
      preferences: { salary: { min: 80000, max: 110000, currency: 'USD' }, workMode: { mode: 'hybrid' }, employmentTypes: ['Full-time'] },
    },
    {
      requiredSkills: ['React'], experienceLevel: 'senior', distanceKm: 10, hiringRadiusKm: 40,
      salaryRange: { min: 80000, max: 110000, currency: 'USD' }, workMode: 'Hybrid', type: 'Full-time',
    }
  );
  assert.equal(result.score, 100);
  assert.equal(result.salaryStatus, 'within');
});

test('salary compatibility statuses', () => {
  assert.equal(salaryCompatibility({ min: 100000, max: 130000, currency: 'USD' }, { min: 60000, max: 80000, currency: 'USD' }).status, 'below');
  assert.equal(salaryCompatibility({ min: 50000, max: 70000, currency: 'USD' }, { min: 90000, max: 120000, currency: 'USD' }).status, 'above');
  assert.equal(salaryCompatibility({ min: 50000, max: 70000, currency: 'EUR' }, { min: 60000, max: 80000, currency: 'USD' }).status, 'unknown');
  assert.equal(salaryCompatibility(undefined, { min: 1, max: 2, currency: 'USD' }).status, 'unknown');
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
