/**
 * Pure matching + validation logic. No I/O — fully unit-testable.
 */

export const DAILY_LIKE_LIMIT = 50;

const EXPERIENCE_ORDER = ['junior', 'mid', 'senior', 'lead', 'exec'];

function overlap(a = [], b = []) {
  const setB = new Set(b.map((s) => s.toLowerCase()));
  return a.filter((s) => setB.has(s.toLowerCase()));
}

/**
 * Salary compatibility between a candidate's expectation and a job's range.
 * Returns { score: 0-1, status: 'within'|'below'|'above'|'unknown', evidence }.
 */
export function salaryCompatibility(candidateSalary, jobSalary) {
  if (!candidateSalary || !jobSalary || candidateSalary.min === undefined || jobSalary.min === undefined) {
    return { score: 0.5, status: 'unknown', evidence: 'Salary expectation not compared yet.' };
  }
  if (candidateSalary.currency !== jobSalary.currency) {
    return { score: 0.5, status: 'unknown', evidence: `Different currencies (${candidateSalary.currency} vs ${jobSalary.currency}).` };
  }
  if (jobSalary.max < candidateSalary.min) return { score: 0, status: 'below', evidence: 'The role tops out below the expected minimum.' };
  if (jobSalary.min > candidateSalary.max) return { score: 0.8, status: 'above', evidence: 'The role pays above the expected range.' };
  const overlapAmount = Math.min(jobSalary.max, candidateSalary.max) - Math.max(jobSalary.min, candidateSalary.min);
  const span = Math.max(1, Math.min(jobSalary.max - jobSalary.min, candidateSalary.max - candidateSalary.min));
  return { score: Math.max(0.6, Math.min(1, overlapAmount / span)), status: 'within', evidence: 'Expected and offered ranges overlap.' };
}

const WORK_MODE_SCORES = {
  remote: { Remote: 1, Hybrid: 0.5, 'On-site': 0.1, Flexible: 1 },
  hybrid: { Remote: 0.8, Hybrid: 1, 'On-site': 0.5, Flexible: 1 },
  onsite: { Remote: 0.4, Hybrid: 0.8, 'On-site': 1, Flexible: 1 },
};

/**
 * Fit score 0–100 with a per-factor breakdown.
 * Factors: weighted skill overlap 40%, seniority 15%, salary overlap 15%,
 * distance vs both radii 10%, work-mode compatibility 10%, employment type 10%.
 */
export function scoreCandidateForJob(candidate, job) {
  // Skills: weighted by the job's per-skill weight (1-3; default 2).
  const weights = new Map((job.requiredSkillsDetail || (job.requiredSkills || []).map((name) => ({ name, weight: 2 })))
    .map((skill) => [skill.name.toLowerCase(), skill.weight || 2]));
  const matchedSkills = overlap(candidate.skills, job.requiredSkills);
  const totalWeight = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
  const matchedWeight = matchedSkills.reduce((sum, name) => sum + (weights.get(name.toLowerCase()) || 2), 0);
  const skillScore = totalWeight ? matchedWeight / totalWeight : 0;

  // Seniority
  const ci = EXPERIENCE_ORDER.indexOf(candidate.seniority || candidate.experienceLevel);
  const ji = EXPERIENCE_ORDER.indexOf(job.seniority || job.experienceLevel);
  let seniorityScore = 0.5;
  if (ci >= 0 && ji >= 0) {
    const dist = Math.abs(ci - ji);
    seniorityScore = dist === 0 ? 1 : dist === 1 ? 0.6 : dist === 2 ? 0.25 : 0;
  }
  const experienceFit = ci >= 0 && ji >= 0 && Math.abs(ci - ji) <= 1;

  // Salary
  const salary = salaryCompatibility(candidate.preferences?.salary, job.salaryRange);

  // Distance vs both radii
  const distanceKm = job.distanceKm ?? candidate.distanceKm;
  let distanceScore = 0.7;
  let distanceEvidence = 'Distance not compared yet.';
  if (distanceKm !== undefined) {
    const withinCandidate = candidate.distanceRangeKm !== undefined ? distanceKm <= candidate.distanceRangeKm : undefined;
    const withinJob = job.hiringRadiusKm !== undefined ? distanceKm <= job.hiringRadiusKm : undefined;
    const known = [withinCandidate, withinJob].filter((value) => value !== undefined);
    if (known.length === 0) { distanceScore = 0.7; }
    else if (known.every(Boolean)) { distanceScore = 1; distanceEvidence = `${distanceKm} km apart — inside both distance preferences.`; }
    else if (known.some(Boolean)) { distanceScore = 0.4; distanceEvidence = `${distanceKm} km apart — inside one side's preferred range.`; }
    else { distanceScore = 0; distanceEvidence = `${distanceKm} km apart — outside both preferred ranges.`; }
  }

  // Work mode
  const preferredMode = candidate.preferences?.workMode?.mode;
  const workModeScore = preferredMode ? (WORK_MODE_SCORES[preferredMode]?.[job.workMode] ?? 0.7) : 0.7;
  const workModeEvidence = preferredMode
    ? (workModeScore >= 1 ? `${job.workMode} matches the preferred way of working.` : workModeScore >= 0.5 ? `${job.workMode} partially fits a ${preferredMode} preference.` : `${job.workMode} conflicts with a ${preferredMode} preference.`)
    : 'Work-mode preference not set yet.';

  // Employment type
  const types = candidate.preferences?.employmentTypes;
  const typeScore = types?.length ? (types.includes(job.type) ? 1 : 0.2) : 0.7;

  const breakdown = [
    { factor: 'skills', label: 'Skill overlap', weight: 0.4, score: skillScore, evidence: matchedSkills.length ? `${matchedSkills.length} of ${weights.size} required skills matched${matchedWeight ? ', weighted toward the priority skills' : ''}.` : 'No required skills matched yet.' },
    { factor: 'seniority', label: 'Seniority', weight: 0.15, score: seniorityScore, evidence: seniorityScore === 1 ? 'Seniority level matches exactly.' : seniorityScore >= 0.6 ? 'One level apart — close fit.' : 'Seniority levels are far apart.' },
    { factor: 'salary', label: 'Salary overlap', weight: 0.15, score: salary.score, evidence: salary.evidence },
    { factor: 'distance', label: 'Distance', weight: 0.1, score: distanceScore, evidence: distanceEvidence },
    { factor: 'workMode', label: 'Work mode', weight: 0.1, score: workModeScore, evidence: workModeEvidence },
    { factor: 'employmentType', label: 'Employment type', weight: 0.1, score: typeScore, evidence: types?.length ? (typeScore === 1 ? `${job.type} is one of the preferred employment types.` : `${job.type} is not among the preferred types.`) : 'Employment-type preference not set yet.' },
  ];

  const score = Math.round(100 * breakdown.reduce((sum, factor) => sum + factor.weight * factor.score, 0));
  const matchedLanguages = overlap(candidate.languages, job.requiredLanguages);
  return { score, matchedSkills, matchedLanguages, experienceFit, breakdown, salaryStatus: salary.status };
}

/** Start of the current UTC day, as a timestamp. */
export function startOfToday(now = Date.now()) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/** How many likes a user has left today. */
export function likesRemainingToday(swipes, userId, now = Date.now()) {
  const since = startOfToday(now);
  const used = swipes.filter(
    (s) => s.actorId === userId && s.direction === 'like' && s.createdAt >= since
  ).length;
  return Math.max(0, DAILY_LIKE_LIMIT - used);
}

/**
 * Given a new LIKE swipe, decide whether it completes a mutual match.
 * Returns { candidateId, jobId, employerId } or null.
 *
 * Rules (fixes the one-directional bug in the previous version):
 *  - Candidate likes job J  -> match if J's employer already liked the candidate.
 *  - Employer likes candidate C -> match if C already liked any of this employer's jobs
 *    (most recently liked job wins).
 */
export function detectMutualMatch(swipe, { swipes, jobs }) {
  if (swipe.direction !== 'like') return null;

  if (swipe.targetType === 'job') {
    const job = jobs.find((j) => j.id === swipe.targetId);
    if (!job) return null;
    const reciprocal = swipes.find(
      (s) =>
        s.actorId === job.employerId &&
        s.targetType === 'candidate' &&
        s.targetId === swipe.actorId &&
        s.direction === 'like'
    );
    if (!reciprocal) return null;
    return { candidateId: swipe.actorId, jobId: job.id, employerId: job.employerId };
  }

  if (swipe.targetType === 'candidate') {
    const employerJobs = new Set(jobs.filter((j) => j.employerId === swipe.actorId).map((j) => j.id));
    const liked = swipes
      .filter(
        (s) =>
          s.actorId === swipe.targetId &&
          s.targetType === 'job' &&
          s.direction === 'like' &&
          employerJobs.has(s.targetId)
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!liked) return null;
    return { candidateId: swipe.targetId, jobId: liked.targetId, employerId: swipe.actorId };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
    this.status = 400;
  }
}

export function reqString(obj, field, { min = 1, max = 500 } = {}) {
  const v = obj[field];
  if (typeof v !== 'string' || v.trim().length < min || v.length > max) {
    throw new ValidationError(field, `"${field}" must be a string of ${min}-${max} characters`);
  }
  return v.trim();
}

export function optString(obj, field, { max = 500 } = {}) {
  const v = obj[field];
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || v.length > max) {
    throw new ValidationError(field, `"${field}" must be a string of at most ${max} characters`);
  }
  return v.trim();
}

export function optStringArray(obj, field, { maxItems = 30, maxLen = 60 } = {}) {
  const v = obj[field];
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || v.length > maxItems || v.some((s) => typeof s !== 'string' || !s.trim() || s.length > maxLen)) {
    throw new ValidationError(field, `"${field}" must be an array of up to ${maxItems} short strings`);
  }
  return [...new Set(v.map((s) => s.trim()))];
}

export function oneOf(obj, field, values, { optional = false } = {}) {
  const v = obj[field];
  if (v === undefined && optional) return undefined;
  if (!values.includes(v)) {
    throw new ValidationError(field, `"${field}" must be one of: ${values.join(', ')}`);
  }
  return v;
}

export const EXPERIENCE_LEVELS = EXPERIENCE_ORDER;
