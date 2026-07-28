import { logBillingEvent } from './audit.js';

/* Deliberately imports nothing from subscriptions.js or entitlements.js: both
 * of those need the trial terms defined here, and a cycle between them would
 * make module evaluation order load-bearing. One trivial duplicated constant is
 * a much smaller price than that. */
const DAY_MS = 24 * 60 * 60 * 1000;

/* Trial terms.
 *
 * One trial, one length, the same for everybody: 60 days with 3 live jobs. Long
 * enough to run a real hiring round and see whether the matching actually works
 * — three concurrent roles is a genuine trial of the product rather than a
 * single-job demo, and sixty days covers posting, matching and first interviews.
 *
 * There is deliberately no cohort, no seat count and no second tier of trial.
 * Every branch of "which kind of trial is this" was a branch that could be got
 * wrong, and none of them were doing anything a single number doesn't do. */

const intFromEnv = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const TRIAL_DAYS = intFromEnv('RECRUITER_TRIAL_DAYS', 60);
/** Granted once, when a hire is still in flight as the trial runs out. */
export const HIRE_IN_FLIGHT_EXTENSION_DAYS = intFromEnv('HIRE_IN_FLIGHT_EXTENSION_DAYS', 30);

/* Holiday windows during which the trial clock stops.
 *
 * DELIBERATELY EMPTY. Tết moves every year against the Gregorian calendar and
 * getting it wrong by even a few days silently shortens or extends every trial
 * running at the time. Dates go in here only once confirmed — never derived,
 * never guessed. Format: { label, startsAt, endsAt } as epoch ms.
 *
 * Set TRIAL_PAUSE_WINDOWS to a JSON array to configure without a code change.
 */
export function pauseWindows() {
  const raw = process.env.TRIAL_PAUSE_WINDOWS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((w) => Number.isFinite(w.startsAt) && Number.isFinite(w.endsAt)) : [];
  } catch { return []; }
}

/** Milliseconds of pause overlapping [from, to). */
export function pausedMsBetween(from, to, windows = pauseWindows()) {
  let paused = 0;
  for (const window of windows) {
    const start = Math.max(from, window.startsAt);
    const end = Math.min(to, window.endsAt);
    if (end > start) paused += end - start;
  }
  return paused;
}

/**
 * When this trial actually ends: the start plus its day budget, pushed out by
 * any holiday pause it overlaps. Iterated twice because extending the end date
 * can pull a later pause window into range.
 */
export function trialEndsAt(startedAt, days, windows = pauseWindows()) {
  let end = startedAt + days * DAY_MS;
  for (let pass = 0; pass < 3; pass += 1) {
    const shifted = startedAt + days * DAY_MS + pausedMsBetween(startedAt, end, windows);
    if (shifted === end) break;
    end = shifted;
  }
  return end;
}

/* Check-ins during the trial. Day 1-3 is by far the highest-leverage: a
 * recruiter who has not posted a job in the first three days has not started
 * evaluating the product at all, and every later touch is wasted on someone who
 * never began. Each entry fires at most once — `sentCheckpoints` on the
 * subscription row makes cron re-runs no-ops. */
export const TRIAL_CHECKPOINTS = [
  { day: 2, key: 'day_2', kind: 'trial_checkpoint_start', text: 'Post your first job to start seeing matched candidates — it takes about three minutes.', onlyIfNoJobs: true },
  { day: 7, key: 'day_7', kind: 'trial_checkpoint_week', text: 'One week in. Have a look at who matched your roles this week.' },
  { day: 21, key: 'day_21', kind: 'trial_checkpoint_month', text: 'Three weeks in — you can run up to three roles at once during the trial.' },
  { day: 30, key: 'day_30', kind: 'trial_checkpoint_mid', text: 'Halfway through your trial. Anything not working the way you expected?' },
  { day: 45, key: 'day_45', kind: 'trial_checkpoint_late', text: 'Fifteen days of trial left. Subscribe any time to keep every job live.' },
  { day: 55, key: 'day_55', kind: 'trial_checkpoint_final', text: 'Your trial ends in five days. One job stays live free forever — subscribe to keep them all.' },
];

/** Checkpoints due now and not already sent. `hasJobs` suppresses the day-2
 *  nudge for recruiters who have already posted — it would read as noise. */
export function dueCheckpoints(subscription, { now = Date.now(), hasJobs = false } = {}) {
  if (!subscription?.trialStartedAt) return [];
  const sent = new Set(subscription.sentCheckpoints || []);
  const elapsedDays = (now - subscription.trialStartedAt) / DAY_MS;
  return TRIAL_CHECKPOINTS.filter((checkpoint) => {
    if (sent.has(checkpoint.key)) return false;
    if (elapsedDays < checkpoint.day) return false;
    if (checkpoint.onlyIfNoJobs && hasJobs) return false;
    // Never fire a checkpoint that falls after the trial has already ended.
    return !subscription.trialEndsAt || now <= subscription.trialEndsAt;
  });
}

export function markCheckpointSent(subscription, key) {
  if (!Array.isArray(subscription.sentCheckpoints)) subscription.sentCheckpoints = [];
  if (!subscription.sentCheckpoints.includes(key)) subscription.sentCheckpoints.push(key);
  subscription.updatedAt = Date.now();
}

/**
 * Extend a trial that is about to expire while a hire is still in progress.
 * Granted once only. Churning someone at the exact moment the product is
 * working for them is the most expensive possible time to lose them.
 */
export function extendForHireInFlight(db, subscription, now = Date.now()) {
  if (!subscription || subscription.hireExtensionGrantedAt) return { outcome: 'already_granted' };
  const endsAt = subscription.trialEndsAt;
  if (!endsAt) return { outcome: 'no_trial' };
  subscription.trialEndsAt = endsAt + HIRE_IN_FLIGHT_EXTENSION_DAYS * DAY_MS;
  subscription.hireExtensionGrantedAt = now;
  subscription.updatedAt = now;
  logBillingEvent(db, subscription.recruiterUserId, 'trial_extended_hire_in_flight', 'subscription', subscription.id,
    { days: HIRE_IN_FLIGHT_EXTENSION_DAYS, trialEndsAt: subscription.trialEndsAt });
  return { outcome: 'extended', trialEndsAt: subscription.trialEndsAt };
}

