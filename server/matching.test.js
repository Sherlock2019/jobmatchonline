import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMutualMatch, isStrongRoleMatch, likesRemainingToday, salaryCompatibility, scoreCandidateForJob } from './matching.js';

test('scores a candidate fit with a six-factor breakdown and no seniority factor', () => {
  const result = scoreCandidateForJob(
    { skills: ['Figma', 'Research'], languages: ['English'], experienceLevel: 'senior' },
    { requiredSkills: ['Figma', 'Research', 'Leadership'], requiredLanguages: ['English'], experienceLevel: 'senior' }
  );
  // skills 2/3 * .42 + languages 1 * .08 + neutral salary/distance/mode/type
  assert.equal(result.score, 68);
  assert.deepEqual(result.matchedSkills, ['Figma', 'Research']);
  assert.equal(result.experienceFit, true);
  assert.equal(result.breakdown.length, 6);
  assert.ok(!result.breakdown.some((f) => f.factor === 'seniority'));
});

test('seniority no longer moves the score', () => {
  const job = { requiredSkills: ['React'], experienceLevel: 'mid' };
  const senior = scoreCandidateForJob({ skills: ['React'], languages: [], experienceLevel: 'senior' }, job);
  const junior = scoreCandidateForJob({ skills: ['React'], languages: [], experienceLevel: 'junior' }, job);
  assert.equal(senior.score, junior.score);
});

test('on-site distance is gated by the candidate max commute', () => {
  const job = { requiredSkills: ['React'], workMode: 'On-site', distanceKm: 40, hiringRadiusKm: 100 };
  const willing = scoreCandidateForJob({ skills: ['React'], languages: [], distanceRangeKm: 50 }, job);
  const unwilling = scoreCandidateForJob({ skills: ['React'], languages: [], distanceRangeKm: 20 }, job);
  const distOf = (r) => r.breakdown.find((f) => f.factor === 'distance').score;
  assert.equal(distOf(willing), 1); // 40 km within a 50 km commute
  assert.ok(distOf(unwilling) <= 0.1); // 40 km beyond a 20 km commute
  assert.ok(willing.score > unwilling.score);
});

test('skill synonyms and spelling variants still match', () => {
  const result = scoreCandidateForJob(
    { skills: ['React.js', 'Node', 'JS'], languages: [], experienceLevel: 'mid' },
    { requiredSkills: ['React', 'Node.js', 'JavaScript'], experienceLevel: 'mid' }
  );
  assert.equal(result.breakdown[0].score, 1); // all three treated as matches
});

test('nice-to-haves add a capped bonus', () => {
  const job = { requiredSkills: ['React'], niceToHaves: ['GraphQL', 'Docker'], experienceLevel: 'mid' };
  const withNice = scoreCandidateForJob({ skills: ['React', 'GraphQL'], languages: [], experienceLevel: 'mid' }, job);
  const without = scoreCandidateForJob({ skills: ['React'], languages: [], experienceLevel: 'mid' }, job);
  assert.ok(withNice.breakdown[0].score >= without.breakdown[0].score);
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
      skills: ['React'], languages: ['English'], experienceLevel: 'senior', distanceRangeKm: 30,
      preferences: { salary: { min: 80000, max: 110000, currency: 'USD' }, workMode: { mode: 'hybrid' }, employmentTypes: ['Full-time'] },
    },
    {
      requiredSkills: ['React'], requiredLanguages: ['English'], experienceLevel: 'senior', distanceKm: 10, hiringRadiusKm: 40,
      salaryRange: { min: 80000, max: 110000, currency: 'USD' }, workMode: 'Hybrid', type: 'Full-time',
    }
  );
  assert.equal(result.score, 100);
  assert.equal(result.salaryStatus, 'within');
  assert.equal(isStrongRoleMatch(result), true);
});

test('strong role match requires a 90% overall score plus skills, salary, and location or work-mode fit', () => {
  const base = { score: 92, breakdown: [
    { factor: 'skills', score: 0.9 }, { factor: 'salary', score: 0.8 },
    { factor: 'distance', score: 0.85 }, { factor: 'workMode', score: 0.5 },
  ] };
  assert.equal(isStrongRoleMatch(base), true);
  assert.equal(isStrongRoleMatch({ ...base, score: 89 }), false);
  assert.equal(isStrongRoleMatch({ ...base, breakdown: base.breakdown.map((factor) => factor.factor === 'skills' ? { ...factor, score: 0.89 } : factor) }), false);
  assert.equal(isStrongRoleMatch({ ...base, breakdown: base.breakdown.map((factor) => factor.factor === 'salary' ? { ...factor, score: 0.5 } : factor) }), false);
  assert.equal(isStrongRoleMatch({ ...base, breakdown: base.breakdown.map((factor) => factor.factor === 'distance' ? { ...factor, score: 0.4 } : factor) }), false);
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
