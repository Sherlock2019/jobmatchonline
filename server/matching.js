/**
 * Pure matching + validation logic. No I/O — fully unit-testable.
 */

export const DAILY_LIKE_LIMIT = 50;

const EXPERIENCE_ORDER = ['junior', 'mid', 'senior', 'lead', 'exec'];

function overlap(a = [], b = []) {
  const setB = new Set(b.map((s) => s.toLowerCase()));
  return a.filter((s) => setB.has(s.toLowerCase()));
}

// Common skill spellings that mean the same thing, so real matches aren't missed.
const SKILL_ALIASES = {
  'react.js': 'react', reactjs: 'react', 'node.js': 'node', nodejs: 'node',
  js: 'javascript', ts: 'typescript', postgres: 'postgresql', psql: 'postgresql',
  k8s: 'kubernetes', ml: 'machine learning', 'a/b testing': 'ab testing',
  'ci/cd': 'cicd', 'design system': 'design systems', 'ux research': 'user research',
  'gcp': 'google cloud', 'google cloud platform': 'google cloud', golang: 'go',
};
/** Normalize a skill for comparison: lowercase, alias, strip .js/punctuation. */
function normalizeSkill(value) {
  let s = String(value || '').trim().toLowerCase();
  if (SKILL_ALIASES[s]) return SKILL_ALIASES[s];
  s = s.replace(/\.js$/, '').replace(/[^a-z0-9+#. ]/g, ' ').replace(/\s+/g, ' ').trim();
  return SKILL_ALIASES[s] || s;
}
function normalizedHas(candidateSkills = []) {
  const set = new Set(candidateSkills.map(normalizeSkill));
  return (skill) => set.has(normalizeSkill(skill));
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
 * Fit score 0–100 with a per-factor breakdown. Seniority is deliberately not scored.
 * Factors: weighted skill overlap 42% (synonym-aware, + nice-to-have bonus),
 * distance-to-work 15% (candidate max commute is the dominant constraint for
 * on-site/hybrid), salary overlap 15%, work-mode compatibility 12%,
 * languages 8%, employment type 8%.
 */
export function scoreCandidateForJob(candidate, job) {
  const candidateHas = normalizedHas(candidate.skills || []);

  // Skills: weighted by the job's per-skill weight (1-3; default 2), synonym-aware.
  const requiredDetail = job.requiredSkillsDetail || (job.requiredSkills || []).map((name) => ({ name, weight: 2 }));
  const totalWeight = requiredDetail.reduce((sum, skill) => sum + (skill.weight || 2), 0);
  const matchedRequired = requiredDetail.filter((skill) => candidateHas(skill.name));
  const matchedSkills = matchedRequired.map((skill) => skill.name);
  const matchedWeight = matchedRequired.reduce((sum, skill) => sum + (skill.weight || 2), 0);
  // Skills the job requires that the candidate is missing, for the profile split.
  const missingSkills = requiredDetail.filter((skill) => !candidateHas(skill.name)).map((skill) => skill.name);
  // Bonus: candidate also has some of the job's nice-to-haves (capped).
  const matchedNice = (job.niceToHaves || []).filter((skill) => candidateHas(skill));
  // Extra skills the candidate brings beyond what this job asked for.
  const jobSkillSet = new Set([...requiredDetail.map((s) => normalizeSkill(s.name)), ...(job.niceToHaves || []).map(normalizeSkill)]);
  const extraSkills = (candidate.skills || []).filter((skill) => !jobSkillSet.has(normalizeSkill(skill)));
  const niceBonus = Math.min(0.12, matchedNice.length * 0.04);
  const skillScore = Math.min(1, (totalWeight ? matchedWeight / totalWeight : 0) + niceBonus);

  // Seniority is intentionally excluded from the fit score. We still surface
  // whether experience is in the same ballpark, for the profile badge only.
  const ci = EXPERIENCE_ORDER.indexOf(candidate.seniority || candidate.experienceLevel);
  const ji = EXPERIENCE_ORDER.indexOf(job.seniority || job.experienceLevel);
  const experienceFit = ci >= 0 && ji >= 0 && Math.abs(ci - ji) <= 1;

  // Languages: coverage of the job's required languages.
  const requiredLanguages = job.requiredLanguages || [];
  const matchedLanguages = overlap(candidate.languages, requiredLanguages);
  const languageScore = requiredLanguages.length ? matchedLanguages.length / requiredLanguages.length : 0.85;
  const languageEvidence = !requiredLanguages.length ? 'No specific language requirement.'
    : languageScore >= 1 ? `Speaks all ${requiredLanguages.length} required language${requiredLanguages.length > 1 ? 's' : ''}.`
      : `Speaks ${matchedLanguages.length} of ${requiredLanguages.length} required languages.`;

  // Salary
  const salary = salaryCompatibility(candidate.preferences?.salary, job.salaryRange);

  // Distance / location — work-mode aware. Remote-worldwide ignores distance;
  // remote-within-country checks the country; on-site/hybrid use the radii.
  let distanceScore = 0.7;
  let distanceEvidence = 'Distance not compared yet.';
  if (job.workMode === 'Remote') {
    if (job.remoteScope === 'country') {
      const jobCountry = job.country;
      if (candidate.country && jobCountry) {
        const same = candidate.country.trim().toLowerCase() === jobCountry.trim().toLowerCase();
        distanceScore = same ? 1 : 0.2;
        distanceEvidence = same ? `Remote within ${jobCountry} — you're eligible.` : `Remote, but restricted to ${jobCountry}.`;
      } else {
        distanceScore = 0.85; distanceEvidence = jobCountry ? `Remote within ${jobCountry}.` : 'Remote within the hiring country.';
      }
    } else {
      distanceScore = 1; distanceEvidence = 'Fully remote — work from anywhere.';
    }
  } else {
    // On-site / hybrid / flexible: the candidate's max commute distance is the
    // dominant constraint — someone who won't travel that far won't take the job.
    const distanceKm = job.distanceKm ?? candidate.distanceKm;
    if (distanceKm !== undefined) {
      const maxCommute = candidate.distanceRangeKm; // candidate's max distance to work
      const jobRadius = job.hiringRadiusKm;
      const withinCommute = maxCommute !== undefined ? distanceKm <= maxCommute : undefined;
      const withinRadius = jobRadius !== undefined ? distanceKm <= jobRadius : undefined;
      if (withinCommute === false) {
        distanceScore = 0.1; distanceEvidence = `${distanceKm} km — beyond your ${maxCommute} km max commute.`;
      } else if (withinCommute === true) {
        distanceScore = withinRadius === false ? 0.6 : 1;
        distanceEvidence = withinRadius === false
          ? `${distanceKm} km — within your ${maxCommute} km commute, but outside the employer's radius.`
          : `${distanceKm} km — within your ${maxCommute} km max commute.`;
      } else if (withinRadius === true) {
        distanceScore = 0.85; distanceEvidence = `${distanceKm} km — inside the hiring radius (set your max commute to refine).`;
      } else if (withinRadius === false) {
        distanceScore = 0.2; distanceEvidence = `${distanceKm} km — outside the employer's hiring radius.`;
      } else {
        distanceScore = 0.7; distanceEvidence = `${distanceKm} km apart — set a max commute distance to score this.`;
      }
    }
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
    { factor: 'skills', label: 'Skill overlap', weight: 0.42, score: skillScore, evidence: matchedSkills.length ? `${matchedSkills.length} of ${requiredDetail.length} required skills matched${matchedNice.length ? `, plus ${matchedNice.length} nice-to-have${matchedNice.length > 1 ? 's' : ''}` : ''}.` : 'No required skills matched yet.' },
    { factor: 'distance', label: 'Distance to work', weight: 0.15, score: distanceScore, evidence: distanceEvidence },
    { factor: 'salary', label: 'Salary overlap', weight: 0.15, score: salary.score, evidence: salary.evidence },
    { factor: 'workMode', label: 'Work mode', weight: 0.12, score: workModeScore, evidence: workModeEvidence },
    { factor: 'languages', label: 'Languages', weight: 0.08, score: languageScore, evidence: languageEvidence },
    { factor: 'employmentType', label: 'Employment type', weight: 0.08, score: typeScore, evidence: types?.length ? (typeScore === 1 ? `${job.type} is one of the preferred employment types.` : `${job.type} is not among the preferred types.`) : 'Employment-type preference not set yet.' },
  ];

  const score = Math.round(100 * breakdown.reduce((sum, factor) => sum + factor.weight * factor.score, 0));
  return { score, matchedSkills, missingSkills, extraSkills, matchedLanguages, experienceFit, breakdown, salaryStatus: salary.status };
}

/** Strict home-page recommendation: 90% overall plus skills, salary and place/mode compatibility. */
export function isStrongRoleMatch(match) {
  const factors = Object.fromEntries((match?.breakdown || []).map((factor) => [factor.factor, factor.score]));
  return (match?.score || 0) >= 90
    && (factors.skills || 0) >= 0.9
    && (factors.salary || 0) >= 0.6
    && ((factors.distance || 0) >= 0.85 || (factors.workMode || 0) >= 0.8);
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
