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
 * Score a candidate against a job. Returns { score: 0-100, matchedSkills, matchedLanguages, experienceFit }.
 * Weights: skills 60%, experience 20%, languages 20%.
 */
export function scoreCandidateForJob(candidate, job) {
  const matchedSkills = overlap(candidate.skills, job.requiredSkills);
  const skillRatio = job.requiredSkills?.length
    ? matchedSkills.length / job.requiredSkills.length
    : 0;

  const ci = EXPERIENCE_ORDER.indexOf(candidate.experienceLevel);
  const ji = EXPERIENCE_ORDER.indexOf(job.experienceLevel);
  let expScore = 0.5; // unknown levels -> neutral
  if (ci >= 0 && ji >= 0) {
    const dist = Math.abs(ci - ji);
    expScore = dist === 0 ? 1 : dist === 1 ? 0.6 : dist === 2 ? 0.25 : 0;
  }
  const experienceFit = ci >= 0 && ji >= 0 && Math.abs(ci - ji) <= 1;

  const matchedLanguages = overlap(candidate.languages, job.requiredLanguages);
  const langRatio = job.requiredLanguages?.length
    ? matchedLanguages.length / job.requiredLanguages.length
    : 1;

  const score = Math.round(100 * (0.6 * skillRatio + 0.2 * expScore + 0.2 * langRatio));
  return { score, matchedSkills, matchedLanguages, experienceFit };
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
