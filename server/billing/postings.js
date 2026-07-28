import { logBillingEvent } from './audit.js';
import { DAY_MS } from './subscriptions.js';

/* Job posting lifecycle.
 *
 * A posting runs for POSTING_TERM_DAYS and then PAUSES — it does not expire and
 * it is never deleted. The difference matters: an expired job is gone and the
 * recruiter has to rebuild it, whereas a paused job is one click from live
 * again. Renewal is free and unlimited on purpose. Jobs are the scarce resource
 * on a young marketplace; charging for the renewal risks losing the listing,
 * which costs far more than the renewal fee could ever earn.
 *
 * The paywall is deliberately on job COUNT, not on time. Needing a second live
 * role at the same time is what signals budget and urgency; simply having had a
 * role open for a while signals neither. */

const intFromEnv = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const POSTING_TERM_DAYS = intFromEnv('POSTING_TERM_DAYS', 60);
/** How long a slot stays occupied after a hire made through the platform. */
export const HIRE_SLOT_LOCK_DAYS = intFromEnv('HIRE_SLOT_LOCK_DAYS', 30);

export function postingExpiryFrom(startedAt) {
  return startedAt + POSTING_TERM_DAYS * DAY_MS;
}

/** Set at publish and at every renewal. */
export function startPostingTerm(job, now = Date.now()) {
  job.postedAt = now;
  job.expiresAt = postingExpiryFrom(now);
  job.updatedAt = now;
  return job;
}

/**
 * Pause postings whose term has run out. Replaces the old expire-and-forget
 * sweep: the recruiter keeps the posting and gets it back with one click.
 */
export function pauseElapsedPostings(db, now = Date.now()) {
  let pausedCount = 0;
  for (const job of db.jobs || []) {
    if (String(job.status).toLowerCase() !== 'active') continue;
    if (!job.expiresAt || job.expiresAt > now) continue;
    job.status = 'paused';
    job.pausedReason = 'term_elapsed';
    job.updatedAt = now;
    pausedCount += 1;
    logBillingEvent(db, job.employerId, 'posting_term_elapsed', 'job', job.id, { postedAt: job.postedAt || null });
  }
  return pausedCount;
}

/** Free, one click, unlimited. Starts a fresh term from now. */
export function renewPosting(db, job, actorUserId, now = Date.now()) {
  if (!job) return { outcome: 'not_found' };
  startPostingTerm(job, now);
  if (String(job.status).toLowerCase() === 'paused' && job.pausedReason === 'term_elapsed') {
    job.status = 'active';
    job.pausedReason = null;
  }
  logBillingEvent(db, actorUserId, 'posting_renewed', 'job', job.id, { expiresAt: job.expiresAt });
  return { outcome: 'renewed', expiresAt: job.expiresAt, status: job.status };
}

/* ── Hire slot locks ──────────────────────────────────────────────────────────
 *
 * When a role is filled through the platform, its slot stays occupied for
 * HIRE_SLOT_LOCK_DAYS. Without this, a recruiter on the free tier hires
 * one-at-a-time forever and never has a reason to pay.
 *
 * Two deliberate escape hatches, because the lock must only ever apply when the
 * product actually worked:
 *   - filled elsewhere, or cancelled → the slot opens immediately. Never
 *     penalise someone for the product not working for them.
 *   - upgrading → clears the lock instantly. The paywall exists to sell the
 *     upgrade, so it has to disappear the moment they buy.
 *
 * Leakage is assumed, not fought. A recruiter who hires through the platform and
 * reports it as "filled elsewhere" pays nothing, and there is no detection and
 * no enforcement here on purpose — an accusation engine would cost far more
 * goodwill than the lock recovers. Verified hires are the carrot instead. */

export const HIRE_OUTCOMES = ['platform', 'elsewhere', 'cancelled'];

/** Locks only apply to hires the platform actually produced. */
export function shouldLockSlot(outcome) {
  return outcome === 'platform';
}

export function recordHire(db, job, { outcome, candidateId = null, confirmedByCandidate = false }, now = Date.now()) {
  if (!HIRE_OUTCOMES.includes(outcome)) return { outcome: 'invalid_outcome' };

  job.status = 'filled';
  job.filledAt = now;
  job.hireOutcome = outcome;
  job.hiredCandidateId = candidateId;
  // A hire is only "verified" once the candidate confirms it themselves. The
  // recruiter's word alone earns the badge for nobody.
  job.hireConfirmedByCandidate = Boolean(confirmedByCandidate);
  job.slotLockedUntil = shouldLockSlot(outcome) ? now + HIRE_SLOT_LOCK_DAYS * DAY_MS : null;
  job.updatedAt = now;

  logBillingEvent(db, job.employerId, 'hire_recorded', 'job', job.id,
    { outcome, candidateId, confirmedByCandidate: job.hireConfirmedByCandidate, slotLockedUntil: job.slotLockedUntil });
  return { outcome: 'recorded', slotLockedUntil: job.slotLockedUntil };
}

/** The candidate's own confirmation — the only thing that earns the badge. */
export function confirmHire(db, job, candidateId, now = Date.now()) {
  if (!job || job.hiredCandidateId !== candidateId) return { outcome: 'not_the_hired_candidate' };
  if (job.hireConfirmedByCandidate) return { outcome: 'already_confirmed' };
  job.hireConfirmedByCandidate = true;
  job.hireConfirmedAt = now;
  job.updatedAt = now;
  logBillingEvent(db, candidateId, 'hire_confirmed_by_candidate', 'job', job.id, { employerId: job.employerId });
  return { outcome: 'confirmed' };
}

/** A recruiter earns the badge once any of their hires is candidate-confirmed. */
export function hasVerifiedHire(db, employerId) {
  return (db.jobs || []).some((job) => job.employerId === employerId && job.hireConfirmedByCandidate === true);
}

export function lockedSlotCount(db, employerId, now = Date.now()) {
  let count = 0;
  for (const job of db.jobs || []) {
    if (job.employerId === employerId && job.slotLockedUntil && job.slotLockedUntil > now) count += 1;
  }
  return count;
}

/** Called on upgrade, and when a hire turns out not to have been a hire. */
export function clearSlotLocks(db, employerId, reason, now = Date.now()) {
  let cleared = 0;
  for (const job of db.jobs || []) {
    if (job.employerId !== employerId || !job.slotLockedUntil) continue;
    job.slotLockedUntil = null;
    job.updatedAt = now;
    cleared += 1;
  }
  if (cleared) logBillingEvent(db, employerId, 'slot_locks_cleared', 'user', employerId, { cleared, reason });
  return cleared;
}

/** Sweep locks that have simply run their course. */
export function releaseElapsedSlotLocks(db, now = Date.now()) {
  let released = 0;
  for (const job of db.jobs || []) {
    if (job.slotLockedUntil && job.slotLockedUntil <= now) {
      job.slotLockedUntil = null;
      job.updatedAt = now;
      released += 1;
    }
  }
  return released;
}
