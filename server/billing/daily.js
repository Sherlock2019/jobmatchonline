import crypto from 'node:crypto';
import { logBillingEvent } from './audit.js';
import { applyCredit, DAY_MS, GRACE_DAYS } from './subscriptions.js';
import { expireBoosts } from './boosts.js';
import { assertNeverZeroLiveJobs, downgradeToFree } from './downgrade.js';
import { pauseElapsedPostings, releaseElapsedSlotLocks } from './postings.js';
import { dueCheckpoints, markCheckpointSent } from './trial.js';
import { FREE_ACTIVE_JOB_LIMIT } from './entitlements.js';

function pushNotification(db, userId, kind, text) {
  if (!Array.isArray(db.billingNotifications)) db.billingNotifications = [];
  db.billingNotifications.push({ id: crypto.randomUUID(), userId, kind, text, createdAt: Date.now(), read: false });
}

/** The one place all daily subscription-lifecycle transitions happen. Every
 * mutation is guarded by a "have I already done this?" check on the record
 * itself, so calling this twice in the same day (a retried cron hit, or a
 * test calling it repeatedly) is always safe — a no-op the second time. */
export function runDailyBilling(db, now = Date.now()) {
  const summary = {
    creditsApplied: 0, enteredGrace: 0, expired: 0, remindersSent: 0, boostsExpired: 0,
    downgraded: 0, checkpointsSent: 0, postingsPaused: 0, slotLocksReleased: 0, zeroLiveJobsRepaired: 0,
  };
  if (!Array.isArray(db.subscriptions)) db.subscriptions = [];
  for (const subscription of db.subscriptions) {
    if (subscription.status === 'cancelled' || subscription.suspendedAt) continue;
    const recruiter = db.users.find((user) => user.id === subscription.recruiterUserId);
    if (!recruiter || recruiter.demo === true) continue;
    const accessEndsAt = subscription.currentPeriodEndsAt || subscription.trialEndsAt;

    // 7-day / 3-day trial-ending reminders (pre-expiry only, each fires once).
    if (!subscription.currentPeriodEndsAt && subscription.trialEndsAt) {
      const daysLeft = Math.ceil((subscription.trialEndsAt - now) / DAY_MS);
      if (daysLeft === 7 && !subscription.reminder7Sent) {
        pushNotification(db, recruiter.id, 'trial_ending_7', 'Your free trial ends in 7 days.');
        subscription.reminder7Sent = true; summary.remindersSent += 1;
      }
      if (daysLeft === 3 && !subscription.reminder3Sent) {
        pushNotification(db, recruiter.id, 'trial_ending_3', 'Your free trial ends in 3 days.');
        subscription.reminder3Sent = true; summary.remindersSent += 1;
      }
    }

    if (!accessEndsAt || now <= accessEndsAt) continue; // still trialing/active — nothing to do

    if (!subscription.gracePeriodEndsAt) {
      // Access just lapsed. Apply an available referral credit BEFORE
      // requiring payment or starting the grace clock, per spec.
      const credit = (db.subscriptionCredits || []).find((entry) => entry.recruiterUserId === recruiter.id && entry.status === 'available');
      if (credit) {
        applyCredit(subscription, credit, now);
        logBillingEvent(db, recruiter.id, 'credit_applied', 'subscriptionCredit', credit.id, {});
        pushNotification(db, recruiter.id, 'credit_applied', 'A referral credit was applied — your access is extended 30 days.');
        summary.creditsApplied += 1;
        continue;
      }
      subscription.status = 'grace_period';
      subscription.gracePeriodEndsAt = accessEndsAt + GRACE_DAYS * DAY_MS;
      subscription.updatedAt = now;
      logBillingEvent(db, recruiter.id, 'grace_period_started', 'subscription', subscription.id, {});
      pushNotification(db, recruiter.id, 'grace_period_started', 'Your trial/subscription ended. You have 7 days to submit payment before recruiter access pauses.');
      summary.enteredGrace += 1;
      continue;
    }

    const graceDaysLeft = Math.ceil((subscription.gracePeriodEndsAt - now) / DAY_MS);
    if (graceDaysLeft === 3 && !subscription.graceReminderSent) {
      pushNotification(db, recruiter.id, 'grace_ending_3', 'Your grace period ends in 3 days.');
      subscription.graceReminderSent = true;
      summary.remindersSent += 1;
    }
    if (now > subscription.gracePeriodEndsAt && subscription.status !== 'expired') {
      subscription.status = 'expired';
      subscription.updatedAt = now;
      logBillingEvent(db, recruiter.id, 'subscription_expired', 'subscription', subscription.id, {});
      // Downgrade rather than cut off: one job stays live free forever, the
      // rest pause. Nothing is closed and nothing is deleted.
      const result = downgradeToFree(db, subscription, FREE_ACTIVE_JOB_LIMIT, now);
      pushNotification(db, recruiter.id, 'downgraded_to_free',
        `Your subscription ended. One job stays live free forever${result?.paused ? ` — your other ${result.paused} ${result.paused === 1 ? 'posting is' : 'postings are'} paused and one click from live again` : ''}.`);
      summary.expired += 1;
      summary.downgraded += 1;
    }
  }

  // Trial check-ins. Day 2 fires only for recruiters who have not posted
  // anything yet — the group most likely to churn without ever evaluating.
  for (const subscription of db.subscriptions) {
    const recruiter = db.users.find((user) => user.id === subscription.recruiterUserId);
    if (!recruiter || recruiter.demo === true) continue;
    if (subscription.currentPeriodEndsAt) continue; // paid, not trialing
    const hasJobs = (db.jobs || []).some((job) => job.employerId === recruiter.id);
    for (const checkpoint of dueCheckpoints(subscription, { now, hasJobs })) {
      pushNotification(db, recruiter.id, checkpoint.kind, checkpoint.text);
      markCheckpointSent(subscription, checkpoint.key);
      summary.checkpointsSent += 1;
    }
  }

  // Postings pause at the end of their term instead of expiring: the recruiter
  // keeps the posting and renewal is one free click.
  summary.postingsPaused = pauseElapsedPostings(db, now);
  summary.slotLocksReleased = releaseElapsedSlotLocks(db, now);

  /* The invariant, verified rather than assumed. Every path above is supposed
   * to leave at least one job visible; this proves it did, repairs it if not,
   * and surfaces the count so a silent regression can't hide. */
  summary.zeroLiveJobsRepaired = assertNeverZeroLiveJobs(db, { now }).length;

  // Boosts fall off on their own schedule. Ranking already ignores an expired
  // boost, so this sweep only keeps the ledger honest for the admin view.
  summary.boostsExpired = expireBoosts(db, now);

  return summary;
}
