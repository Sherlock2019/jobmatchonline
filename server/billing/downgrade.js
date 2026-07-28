import { logBillingEvent } from './audit.js';

/* What happens when a trial or subscription runs out.
 *
 * The one rule that outranks everything else here: a recruiter account must
 * NEVER end up with zero jobs visible to candidates. Not after a trial expires,
 * not after a downgrade, not after a failed payment. Two reasons, and the second
 * is the one that actually bites:
 *
 *   1. It is what the page promises — "one job stays live free forever".
 *   2. Fifty trials expiring in the same week would darken the deck for every
 *      candidate at once. The candidate side has no idea a billing event
 *      happened; they just see a marketplace that emptied overnight.
 *
 * So a downgrade PAUSES surplus jobs. It never closes, expires, or deletes one,
 * and it always leaves exactly one live. `assertNeverZeroLiveJobs` re-checks the
 * result and is called by the daily cron across every recruiter, because an
 * invariant nobody verifies is a comment, not an invariant. */

const LIVE = 'active';
const PAUSED = 'paused';

/** Jobs that can hold the one free live slot: real postings, not drafts or
 *  admin-suspended ones, and not something the recruiter already closed. */
function eligibleForLiveSlot(job) {
  const status = String(job.status).toLowerCase();
  return status === LIVE || status === PAUSED;
}

export function liveJobsFor(db, employerId) {
  return (db.jobs || []).filter((job) => job.employerId === employerId && String(job.status).toLowerCase() === LIVE);
}

/**
 * Fit a recruiter's jobs to `liveSlots`, keeping the best candidates for the
 * slots. "Best" is simply the most recently created — the roles they are most
 * likely still hiring for. Surplus jobs are paused, never removed, so raising
 * the limit again restores them with `applyLiveJobLimit` and nothing was lost.
 */
export function applyLiveJobLimit(db, employerId, liveSlots, { reason = 'plan_limit', now = Date.now() } = {}) {
  const jobs = (db.jobs || []).filter((job) => job.employerId === employerId && eligibleForLiveSlot(job));
  if (jobs.length === 0) return { live: 0, paused: 0, resumed: 0 };

  // Newest first — the roles most likely still open.
  const ordered = [...jobs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  // Never leave zero live. Even a plan with no slots keeps one visible.
  const keepLive = Math.max(1, liveSlots);

  let paused = 0;
  let resumed = 0;
  ordered.forEach((job, index) => {
    const status = String(job.status).toLowerCase();
    if (index < keepLive) {
      if (status === PAUSED) { job.status = LIVE; job.updatedAt = now; resumed += 1; }
    } else if (status === LIVE) {
      job.status = PAUSED;
      job.pausedReason = reason;
      job.updatedAt = now;
      paused += 1;
    }
  });

  const live = Math.min(keepLive, ordered.length);
  if (paused || resumed) {
    logBillingEvent(db, employerId, 'live_jobs_reconciled', 'user', employerId, { liveSlots, live, paused, resumed, reason });
  }
  return { live, paused, resumed };
}

/**
 * Downgrade to the free tier. Everything is kept: jobs pause, seats go
 * read-only, conversations stay open. The only thing that changes is how much
 * is visible at once.
 */
export function downgradeToFree(db, subscription, freeLiveSlots = 1, now = Date.now()) {
  if (!subscription) return null;
  const employerId = subscription.recruiterUserId;
  subscription.planCode = 'free';
  subscription.downgradedAt = now;
  subscription.updatedAt = now;
  const result = applyLiveJobLimit(db, employerId, freeLiveSlots, { reason: 'trial_ended', now });
  logBillingEvent(db, employerId, 'downgraded_to_free', 'subscription', subscription.id, result);
  return result;
}

/**
 * The invariant, checked rather than assumed. Returns the recruiters who have
 * postings but nothing visible — which should always be empty. The daily cron
 * repairs and reports them; a non-empty list is a bug worth waking up for.
 */
export function assertNeverZeroLiveJobs(db, { repair = true, now = Date.now() } = {}) {
  const offenders = [];
  const employerIds = new Set((db.jobs || []).map((job) => job.employerId));

  for (const employerId of employerIds) {
    const owned = (db.jobs || []).filter((job) => job.employerId === employerId && eligibleForLiveSlot(job));
    if (owned.length === 0) continue; // nothing posted — nothing to keep visible
    if (owned.some((job) => String(job.status).toLowerCase() === LIVE)) continue;

    offenders.push(employerId);
    if (repair) {
      // Newest posting comes back up. Repair is silent to the recruiter but
      // loud in the audit log, because reaching here means something upstream
      // was wrong.
      const [newest] = [...owned].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      newest.status = LIVE;
      newest.updatedAt = now;
      logBillingEvent(db, employerId, 'zero_live_jobs_repaired', 'job', newest.id, { restoredJobId: newest.id });
    }
  }
  return offenders;
}
