import crypto from 'node:crypto';
import { logBillingEvent } from './audit.js';
import { computeEffectiveStatus, DAY_MS, isBillingExempt } from './subscriptions.js';

/* Recruiter entitlements: the single server-side authority for "may this
 * recruiter publish / edit this job right now". Every decision is derived live
 * from subscription timestamps and the job-credit ledger — never from a
 * client-supplied field, and never from a mutable counter that could drift.
 *
 * Every mutating function here assumes it is called INSIDE a
 * `store.transaction()` callback, mutating the `db` document in place. That is
 * what makes credit consumption atomic: the store
 * serialises all writes through a single queue, so a read-then-write inside one
 * transaction cannot interleave with another. Calling these outside a
 * transaction would silently lose the guarantee.
 *
 * `entitlementsEnforced()` is the kill switch. While false (the default) every
 * check still runs and returns its verdict, but callers let the action through.
 * That lets the service ship and be observed against real traffic before it
 * denies anything, and lets enforcement be turned off again if it misfires.
 * Read live from the environment (not captured at import) so tests can flip it. */

export function entitlementsEnforced() {
  return process.env.ENTITLEMENTS_ENFORCED === 'true';
}

const intFromEnv = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const TRIAL_ACTIVE_JOB_LIMIT = intFromEnv('TRIAL_ACTIVE_JOB_LIMIT', 10);
export const FREE_ACTIVE_JOB_LIMIT = intFromEnv('RECRUITER_FREE_JOB_LIMIT', 1);
export const FREE_JOB_PERIOD_DAYS = intFromEnv('RECRUITER_FREE_JOB_DAYS', 30);
export const REFERRAL_JOB_CREDIT_MAX = intFromEnv('REFERRAL_JOB_CREDIT_MAX', 10);


/* Job statuses that occupy an "active posting" slot. Deliberately narrower than
 * the fair-use counter in server/index.js, which also counts drafts — the two
 * answer different questions ("unusual posting volume?" vs "how many roles are
 * live right now?"). Drafts are excluded here so saving a draft never consumes
 * an allowance. */
const OCCUPIES_SLOT = new Set(['active', 'paused', 'filled']);

/* The fields `scoreCandidateForJob` reads. Freezing exactly these after a
 * free-tier publish stops one free slot being rewritten into a different role,
 * while leaving title/description/typo fixes editable. */
export const MATCH_RELEVANT_FIELDS = Object.freeze([
  'salaryRange', 'requiredSkillsDetail', 'requiredSkills', 'niceToHaves',
  'location', 'country', 'geo', 'hiringRadiusKm', 'workMode', 'remoteScope',
  'seniority', 'experienceLevel', 'requiredLanguages', 'type',
]);

const MATCH_RELEVANT_SET = new Set(MATCH_RELEVANT_FIELDS);

export function countActiveJobs(db, employerId) {
  let count = 0;
  for (const job of db.jobs || []) {
    if (job.employerId === employerId && OCCUPIES_SLOT.has(String(job.status).toLowerCase())) count += 1;
  }
  return count;
}

/** Available credits, oldest first — consumption is deterministic FIFO so a
 * recruiter always spends the credit they earned longest ago. */
export function availableJobCredits(db, recruiterUserId) {
  return (db.jobPostCredits || [])
    .filter((credit) => credit.recruiterUserId === recruiterUserId && credit.status === 'available')
    .sort((a, b) => (a.grantedAt || 0) - (b.grantedAt || 0));
}

export function jobCreditBalance(db, recruiterUserId) {
  let count = 0;
  for (const credit of db.jobPostCredits || []) {
    if (credit.recruiterUserId === recruiterUserId && credit.status === 'available') count += 1;
  }
  return count;
}

/**
 * Per-recruiter counts in ONE pass over each array, for bulk callers (the daily
 * cron, admin dashboards) that would otherwise re-scan every job for every
 * recruiter — O(jobs × recruiters) turns into O(jobs + recruiters).
 * Pass the result as the `index` argument to getRecruiterEntitlements.
 */
export function buildEntitlementIndex(db) {
  const activeJobsByRecruiter = new Map();
  for (const job of db.jobs || []) {
    if (!OCCUPIES_SLOT.has(String(job.status).toLowerCase())) continue;
    activeJobsByRecruiter.set(job.employerId, (activeJobsByRecruiter.get(job.employerId) || 0) + 1);
  }
  const creditsByRecruiter = new Map();
  for (const credit of db.jobPostCredits || []) {
    if (credit.status !== 'available') continue;
    creditsByRecruiter.set(credit.recruiterUserId, (creditsByRecruiter.get(credit.recruiterUserId) || 0) + 1);
  }
  return { activeJobsByRecruiter, creditsByRecruiter };
}

/** Which plan the recruiter is on right now, derived from subscription state.
 * Legacy rows (created before this feature, with no planCode of their own)
 * resolve from their effective status, so nothing needs backfilling. */
export function resolvePlanCode(subscription, now = Date.now()) {
  if (!subscription) return 'free';
  const status = computeEffectiveStatus(subscription, now);
  if (status === 'trialing') return 'trial';
  if (status === 'active') return 'pro';
  // grace_period keeps paid-tier limits (they still have data to manage) but
  // canPublishJob in subscriptions.js already blocks publishing during grace,
  // so this never grants a publish the subscription state would refuse.
  if (status === 'grace_period') return 'pro';
  return 'free';
}

export function activeJobLimitFor(planCode) {
  return planCode === 'free' ? FREE_ACTIVE_JOB_LIMIT : TRIAL_ACTIVE_JOB_LIMIT;
}

/** Read model powering the Subscription page and every check below. */
export function getRecruiterEntitlements(db, recruiter, subscription, now = Date.now(), index = null) {
  const planCode = resolvePlanCode(subscription, now);
  const activeJobCount = index
    ? (index.activeJobsByRecruiter.get(recruiter.id) || 0)
    : countActiveJobs(db, recruiter.id);
  const creditBalance = index
    ? (index.creditsByRecruiter.get(recruiter.id) || 0)
    : jobCreditBalance(db, recruiter.id);
  const nextFreeJobAvailableAt = subscription?.nextFreeJobAvailableAt ?? null;
  return {
    planCode,
    activeJobLimit: activeJobLimitFor(planCode),
    activeJobCount,
    jobCreditBalance: creditBalance,
    nextFreeJobAvailableAt,
    freeJobAvailable: planCode === 'free' && (nextFreeJobAvailableAt === null || now >= nextFreeJobAvailableAt),
    jobEditingAllowed: planCode !== 'free',
    enforced: entitlementsEnforced(),
  };
}

const deny = (code, message, extra = {}) => ({ allowed: false, code, message, ...extra });
const allow = (postingSource, extra = {}) => ({ allowed: true, postingSource, ...extra });

/**
 * May this recruiter publish a job right now, and against which allowance?
 * Returns the resolved `postingSource` on success so the caller records it on
 * the job and consumes the matching allowance in the SAME transaction.
 * Pure — never mutates; consumption is a separate explicit step.
 */
export function checkPublishAllowed(db, recruiter, subscription, now = Date.now()) {
  if (isBillingExempt(recruiter)) return allow('admin');

  const entitlements = getRecruiterEntitlements(db, recruiter, subscription, now);
  const { planCode, activeJobCount, activeJobLimit } = entitlements;

  if (activeJobCount >= activeJobLimit) {
    return deny(
      'ACTIVE_JOB_LIMIT_REACHED',
      `You have ${activeJobCount} active job ${activeJobCount === 1 ? 'post' : 'posts'}, the maximum for your plan. Close one or upgrade to publish another.`,
      { activeJobCount, activeJobLimit, planCode },
    );
  }

  if (planCode === 'trial') return allow('trial', { entitlements });
  if (planCode === 'pro') return allow('paid', { entitlements });

  // Free plan: rolling base allowance first, then referral credits.
  if (entitlements.freeJobAvailable) return allow('free_base', { entitlements });
  if (entitlements.jobCreditBalance > 0) return allow('referral_credit', { entitlements });

  return deny(
    'FREE_JOB_ALREADY_USED',
    'Your free job post for this period is already used. Use a referral credit or upgrade to publish another.',
    { nextFreeJobAvailableAt: entitlements.nextFreeJobAvailableAt, planCode },
  );
}

/** Rejects a PATCH that touches a field frozen at publish time. */
export function checkEditAllowed(job, body) {
  const locked = Array.isArray(job?.lockedFields) ? job.lockedFields : [];
  if (locked.length === 0 || !body) return { allowed: true };
  const lockedSet = new Set(locked);
  const blocked = Object.keys(body).filter((key) => lockedSet.has(key));
  if (blocked.length === 0) return { allowed: true };
  return deny(
    'FREE_JOB_EDITING_NOT_ALLOWED',
    `Free-plan job posts can't change ${blocked.join(', ')} after publication. Upgrade to edit these, or close this post and publish a new one.`,
    { blockedFields: blocked },
  );
}

/** Called once, at publish, for postings that must stay match-stable. */
export function lockMatchFieldsOnPublish(job) {
  job.lockedFields = [...MATCH_RELEVANT_FIELDS];
  return job;
}

export function isMatchRelevantField(field) {
  return MATCH_RELEVANT_SET.has(field);
}

/** Free-tier publish consumes the rolling allowance: the next base job only
 * becomes available FREE_JOB_PERIOD_DAYS after this publish, whether or not
 * this one is closed early. */
export function consumeFreeJobAllowance(db, recruiter, subscription, job, now = Date.now()) {
  if (!subscription) return null;
  subscription.freeJobPeriodStartedAt = now;
  subscription.nextFreeJobAvailableAt = now + FREE_JOB_PERIOD_DAYS * DAY_MS;
  subscription.updatedAt = now;
  logBillingEvent(db, recruiter.id, 'free_job_published', 'job', job.id, { nextFreeJobAvailableAt: subscription.nextFreeJobAvailableAt });
  return subscription;
}

/** Consumes exactly one available credit (oldest first). Call only AFTER the
 * job is successfully created in the same transaction, so a failed publish can
 * never consume one. Returns null when there was nothing to consume. */
export function consumeReferralJobCredit(db, recruiter, job, now = Date.now()) {
  const [credit] = availableJobCredits(db, recruiter.id);
  if (!credit) return null;
  credit.status = 'consumed';
  credit.consumedAt = now;
  credit.consumedByJobId = job.id;
  credit.updatedAt = now;
  job.consumedCreditId = credit.id;
  logBillingEvent(db, recruiter.id, 'referral_job_credit_consumed', 'jobPostCredit', credit.id, { jobId: job.id });
  return credit;
}

/**
 * Grants one job-post credit to a referrer.
 * Idempotent on `idempotencyKey`, so a replayed referral qualification never
 * double-awards. Always returns a discriminated result so the caller can tell
 * the three outcomes apart and message the user correctly:
 *   { outcome: 'granted', credit }   — new credit created
 *   { outcome: 'duplicate', credit } — this referral already awarded one
 *   { outcome: 'capped', max }       — referrer is at the unused-credit ceiling
 */
export function grantReferralJobCredit(db, referrerUserId, referralId, now = Date.now()) {
  if (!Array.isArray(db.jobPostCredits)) db.jobPostCredits = [];
  const idempotencyKey = `referral-job:${referralId}`;
  const existing = db.jobPostCredits.find((credit) => credit.idempotencyKey === idempotencyKey);
  if (existing) return { outcome: 'duplicate', credit: existing };

  if (jobCreditBalance(db, referrerUserId) >= REFERRAL_JOB_CREDIT_MAX) {
    logBillingEvent(db, referrerUserId, 'referral_job_credit_capped', 'referral', referralId, { max: REFERRAL_JOB_CREDIT_MAX });
    return { outcome: 'capped', max: REFERRAL_JOB_CREDIT_MAX };
  }

  const credit = {
    id: crypto.randomUUID(),
    recruiterUserId: referrerUserId,
    sourceType: 'referral_job',
    sourceReferenceId: referralId,
    idempotencyKey,
    status: 'available',
    grantedAt: now,
    consumedAt: null,
    revokedAt: null,
    consumedByJobId: null,
    createdAt: now,
    updatedAt: now,
  };
  db.jobPostCredits.push(credit);
  logBillingEvent(db, referrerUserId, 'referral_job_credit_awarded', 'jobPostCredit', credit.id, { referralId });
  return { outcome: 'granted', credit };
}

/** Admin/fraud path: claw back a credit that hasn't been spent yet. An already
 * consumed credit is never revoked — the job it paid for is already live. */
export function revokeJobCredit(db, credit, actorUserId, reason, now = Date.now()) {
  if (!credit || credit.status !== 'available') return null;
  credit.status = 'revoked';
  credit.revokedAt = now;
  credit.updatedAt = now;
  logBillingEvent(db, actorUserId, 'referral_job_credit_revoked', 'jobPostCredit', credit.id, { reason: reason || null, recruiterUserId: credit.recruiterUserId });
  return credit;
}

