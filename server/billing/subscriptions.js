import crypto from 'node:crypto';
import { TRIAL_DAYS, trialEndsAt } from './trial.js';
import { logBillingEvent } from './audit.js';

/* Recruiter subscription state machine. All entitlement decisions are derived
 * live from stored timestamps (computeEffectiveStatus/canUseRecruiterFeatures)
 * rather than trusting the persisted `status` string, which is only updated
 * in batches by the daily cron (server/jobs/billing-daily.js) — so access
 * control never has a window where a stale field grants or denies wrongly,
 * even on a day the cron hasn't run yet. */

export const DAY_MS = 24 * 60 * 60 * 1000;
// Defined in trial.js and re-exported so the many existing importers of
// `TRIAL_DAYS` from here keep working. One definition, one place to change it.
export { TRIAL_DAYS };
export const GRACE_DAYS = Number(process.env.RECRUITER_GRACE_DAYS || 7);
export const PRICE_AMOUNT = Number(process.env.RECRUITER_MONTHLY_PRICE || 20);
export const PRICE_CURRENCY = process.env.RECRUITER_PRICE_CURRENCY || 'USD';
export const REFERRAL_CREDIT_DAYS = Number(process.env.REFERRAL_CREDIT_DAYS || 30);
const PERIOD_DAYS = 30;

/** Demo showcase accounts and candidates are never subject to billing. */
export function isBillingExempt(user) {
  return !user || user.role !== 'employer' || user.demo === true;
}

export function findSubscription(db, recruiterUserId) {
  return (db.subscriptions || []).find((entry) => entry.recruiterUserId === recruiterUserId && entry.status !== 'cancelled');
}

/**
 * Idempotent: trialStartedAt is set only once per recruiter, ever. Safe to
 * call on every bootstrap load — a no-op after the first time.
 *
 * Every recruiter gets the same 60-day trial. Existing rows are never
 * rewritten, so trials already running keep whatever end date they have.
 */
export function getOrCreateTrialSubscription(db, recruiterUserId) {
  if (!Array.isArray(db.subscriptions)) db.subscriptions = [];
  const existing = findSubscription(db, recruiterUserId);
  if (existing) return existing;
  const now = Date.now();

  const subscription = {
    id: crypto.randomUUID(),
    recruiterUserId,
    planCode: 'recruiter-monthly',
    status: 'trialing',
    priceAmount: PRICE_AMOUNT,
    priceCurrency: PRICE_CURRENCY,
    trialStartedAt: now,
    trialEndsAt: trialEndsAt(now, TRIAL_DAYS),
    trialDays: TRIAL_DAYS,
    sentCheckpoints: [],
    currentPeriodStartedAt: null,
    currentPeriodEndsAt: null,
    gracePeriodEndsAt: null,
    cancelledAt: null,
    suspendedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  db.subscriptions.push(subscription);
  logBillingEvent(db, recruiterUserId, 'trial_started', 'subscription', subscription.id,
    { trialEndsAt: subscription.trialEndsAt, days: TRIAL_DAYS });
  return subscription;
}

/** The single source of truth for "what state is this subscription in right
 * now" — a pure function of its stored timestamps, never the client. */
export function computeEffectiveStatus(subscription, now = Date.now()) {
  if (!subscription) return 'expired';
  if (subscription.suspendedAt) return 'suspended';
  if (subscription.cancelledAt) return 'cancelled';
  const accessEndsAt = subscription.currentPeriodEndsAt || subscription.trialEndsAt;
  if (accessEndsAt && now <= accessEndsAt) return subscription.currentPeriodEndsAt ? 'active' : 'trialing';
  const graceEndsAt = subscription.gracePeriodEndsAt || (accessEndsAt ? accessEndsAt + GRACE_DAYS * DAY_MS : null);
  if (graceEndsAt && now <= graceEndsAt) return 'grace_period';
  return 'expired';
}

export function canUseRecruiterFeatures(user, subscription, now = Date.now()) {
  if (isBillingExempt(user)) return true;
  const status = computeEffectiveStatus(subscription, now);
  return status === 'trialing' || status === 'active' || status === 'grace_period';
}

/** Grace period allows reading existing data but blocks these three actions. */
export function canPublishJob(user, subscription, now = Date.now()) {
  if (isBillingExempt(user)) return true;
  const status = computeEffectiveStatus(subscription, now);
  return status === 'trialing' || status === 'active';
}
export const canContactCandidate = canPublishJob;
export const canAddSeat = canPublishJob;

/** 30 days from the LATER of the existing expiry or the payment's
 * confirmation date — an early payment extends from the existing expiry
 * (never shortened), a late payment extends from today. */
export function extendFromPayment(subscription, payment, now = Date.now()) {
  const currentExpiry = subscription.currentPeriodEndsAt || subscription.trialEndsAt || now;
  const base = Math.max(currentExpiry, payment.confirmedAt || now);
  if (!subscription.currentPeriodStartedAt) subscription.currentPeriodStartedAt = now;
  subscription.currentPeriodEndsAt = base + PERIOD_DAYS * DAY_MS;
  subscription.status = 'active';
  subscription.gracePeriodEndsAt = null;
  subscription.suspendedAt = null;
  subscription.updatedAt = now;
  return subscription;
}

/** One available credit extends access by its duration (30 days), from the
 * later of the existing expiry or now — consumed on use, never reusable. */
export function applyCredit(subscription, credit, now = Date.now()) {
  const currentExpiry = subscription.currentPeriodEndsAt || subscription.trialEndsAt || now;
  const base = Math.max(currentExpiry, now);
  subscription.currentPeriodEndsAt = base + (credit.durationDays || REFERRAL_CREDIT_DAYS) * DAY_MS;
  if (!subscription.currentPeriodStartedAt) subscription.currentPeriodStartedAt = now;
  subscription.status = 'active';
  subscription.gracePeriodEndsAt = null;
  subscription.updatedAt = now;
  credit.status = 'consumed';
  credit.consumedAt = now;
  credit.updatedAt = now;
  return subscription;
}

export function availableCredits(db, recruiterUserId) {
  return (db.subscriptionCredits || []).filter((credit) => credit.recruiterUserId === recruiterUserId && credit.status === 'available');
}
