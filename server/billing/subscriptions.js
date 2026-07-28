import crypto from 'node:crypto';
import { FOUNDING_RECRUITER_LIMIT, trialDaysFor, trialEndsAt } from './trial.js';
import { logBillingEvent } from './audit.js';

/* Recruiter subscription state machine. All entitlement decisions are derived
 * live from stored timestamps (computeEffectiveStatus/canUseRecruiterFeatures)
 * rather than trusting the persisted `status` string, which is only updated
 * in batches by the daily cron (server/jobs/billing-daily.js) — so access
 * control never has a window where a stale field grants or denies wrongly,
 * even on a day the cron hasn't run yet. */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const TRIAL_DAYS = Number(process.env.RECRUITER_TRIAL_DAYS || 30);
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
 * `kind` picks the trial length. Founding seats get 90 days (a full VN hire
 * cycle including a 30-45 day notice period — anything shorter expires before
 * the hire it produced can land); public signups get 14. Existing rows are
 * never rewritten, so live trials keep whatever end date they already have.
 */
export function getOrCreateTrialSubscription(db, recruiterUserId, kind = null) {
  if (!Array.isArray(db.subscriptions)) db.subscriptions = [];
  const existing = findSubscription(db, recruiterUserId);
  if (existing) return existing;
  const now = Date.now();

  // Founding seats are allocated here, inside the caller's transaction, so the
  // cohort cap is enforced by the same serialised write that creates the row.
  const foundingSold = db.subscriptions.filter((entry) => entry.planCode === 'founding' && entry.status === 'active' && !entry.cancelledAt).length;
  const foundingOpen = foundingSold < FOUNDING_RECRUITER_LIMIT;
  const trialKind = kind || (foundingOpen ? 'founding' : 'public');
  const days = trialDaysFor(trialKind);

  const subscription = {
    id: crypto.randomUUID(),
    recruiterUserId,
    planCode: 'recruiter-monthly',
    status: 'trialing',
    priceAmount: PRICE_AMOUNT,
    priceCurrency: PRICE_CURRENCY,
    trialKind,
    // Founding pricing is captured at signup, not looked up later, so a future
    // catalogue reprice cannot migrate someone who was promised this for life.
    foundingPriceUsd: trialKind === 'founding' ? PRICE_AMOUNT : null,
    trialStartedAt: now,
    trialEndsAt: trialEndsAt(now, days),
    trialDays: days,
    sentCheckpoints: [],
    completedObligations: [],
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
    { trialEndsAt: subscription.trialEndsAt, trialKind, days });
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
