import { logBillingEvent } from './audit.js';

/* Deliberately imports nothing from subscriptions.js or entitlements.js: both
 * of those need the trial terms defined here, and a cycle between them would
 * make module evaluation order load-bearing. One trivial duplicated constant is
 * a much smaller price than that. */
const DAY_MS = 24 * 60 * 60 * 1000;

/* Trial terms.
 *
 * Two lengths, because they are sold to two different people:
 *   founding (90 days) — hand-picked cohort, long enough to cover a real VN
 *     hire cycle including a 30-45 day notice period. A shorter trial expires
 *     before the hire it produced can possibly land, which converts nobody and
 *     teaches you nothing.
 *   public (14 days) — self-serve signups on the larger tiers. Long enough to
 *     evaluate, short enough to keep the funnel measurable.
 *
 * The clock is stored as a REMAINING-DAYS budget plus a start date rather than
 * a fixed end timestamp, so a pause (see PAUSE_WINDOWS) can move the end date
 * without losing track of how much trial the recruiter has actually consumed. */

const intFromEnv = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/* Founding cohort size. 100, not 1000: the page shows how many seats are LEFT,
 * and "1,000 of 1,000 left" tells every visitor that nobody has signed up. A
 * number small enough to visibly move is the whole point of showing one. */
export const FOUNDING_RECRUITER_LIMIT = intFromEnv('FOUNDING_RECRUITER_LIMIT', 100);

export const FOUNDING_TRIAL_DAYS = intFromEnv('FOUNDING_TRIAL_DAYS', 90);
export const PUBLIC_TRIAL_DAYS = intFromEnv('PUBLIC_TRIAL_DAYS', 14);
/** Granted once, when a hire is still in flight as the trial runs out. */
export const HIRE_IN_FLIGHT_EXTENSION_DAYS = intFromEnv('HIRE_IN_FLIGHT_EXTENSION_DAYS', 30);

/** Founding seats get the long trial; everyone else the short one. */
export function trialDaysFor(kind) {
  return kind === 'founding' ? FOUNDING_TRIAL_DAYS : PUBLIC_TRIAL_DAYS;
}

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
  { day: 30, key: 'day_30', kind: 'trial_checkpoint_month', text: 'A month into your trial — a good moment to add your remaining open roles.' },
  { day: 45, key: 'day_45', kind: 'trial_checkpoint_mid', text: 'Halfway through your trial. Anything not working the way you expected?' },
  { day: 70, key: 'day_70', kind: 'trial_checkpoint_late', text: 'Twenty days of trial left. Subscribe any time to keep every job live.' },
  { day: 85, key: 'day_85', kind: 'trial_checkpoint_final', text: 'Your trial ends in five days. One job stays live free forever — subscribe to keep them all.' },
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

/* What a founding recruiter agrees to in exchange for 90 free days. Tracked so
 * the cohort can be managed as a cohort; nothing here gates access to the
 * product, and failing to do them never removes anyone's data. */
export const FOUNDING_OBLIGATIONS = ['intro_call', 'feedback_call', 'testimonial', 'referral'];

export function obligationStatus(subscription) {
  const done = new Set(subscription?.completedObligations || []);
  return FOUNDING_OBLIGATIONS.map((key) => ({ key, done: done.has(key) }));
}

export function completeObligation(db, subscription, key, actorUserId, now = Date.now()) {
  if (!FOUNDING_OBLIGATIONS.includes(key)) return { outcome: 'unknown_obligation' };
  if (!Array.isArray(subscription.completedObligations)) subscription.completedObligations = [];
  if (subscription.completedObligations.includes(key)) return { outcome: 'already_done' };
  subscription.completedObligations.push(key);
  subscription.updatedAt = now;
  logBillingEvent(db, actorUserId, 'founding_obligation_completed', 'subscription', subscription.id, { obligation: key });
  return { outcome: 'completed', key };
}
