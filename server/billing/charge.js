import { logBillingEvent } from './audit.js';
import {
  BILLING_INTERVALS, currencyForCountry, PLANS, planPrice, SEAT_LADDER, seatPlanKey,
} from './plans.js';

/* What to actually charge a recruiter.
 *
 * Every payment in the app used to be created at a flat USD 20 — which was
 * correct while there was exactly one plan, and silently wrong the moment a
 * ladder existed. A recruiter on Agency would have been billed 20 and granted
 * 130-worth of product. This module is the one place that answers "how much,
 * in which currency", and every payment-creation path calls it.
 *
 * Currency follows the account's country, not the browser or a client-supplied
 * field: a Vietnam account is billed in dong at the stored VND price, everyone
 * else in USD. Neither is derived from the other. */

/** The plan a recruiter has chosen to pay for. Defaults to Solo — the entry
 *  paid tier — so an account that never picked one is never billed for more
 *  than the cheapest plan it could be on. */
export function selectedPlanKey(subscription) {
  const chosen = subscription?.selectedPlanKey;
  if (chosen && PLANS[chosen]) return chosen;
  // Fall back to whatever their current plan code maps to, then to Solo.
  const mapped = seatPlanKey(subscription?.planCode);
  return mapped === 'starter' ? 'solo' : mapped;
}

export function billingInterval(subscription) {
  const interval = subscription?.billingInterval;
  return BILLING_INTERVALS.includes(interval) ? interval : 'monthly';
}

/**
 * The charge for this recruiter's next payment: plan, interval, add-on seats,
 * currency and total. Returned as one object so a caller can never take the
 * amount from one plan and the currency from another.
 */
export function chargeFor(db, recruiter, subscription, overrides = {}) {
  const planKey = overrides.planKey && PLANS[overrides.planKey] ? overrides.planKey : selectedPlanKey(subscription);
  const interval = BILLING_INTERVALS.includes(overrides.interval) ? overrides.interval : billingInterval(subscription);
  const currency = overrides.currency || currencyForCountry(recruiter?.country);
  const plan = PLANS[planKey];
  const amount = planPrice(planKey, currency, interval) ?? 0;

  return {
    planKey,
    planDisplay: plan.display,
    interval,
    currency,
    amount,
    seats: plan.seats,
    liveJobSlots: plan.liveJobSlots,
    // Annual bills ANNUAL_MONTHS_CHARGED months, so two are free.
    monthsCovered: interval === 'annual' ? 12 : 1,
  };
}

/** Plans a recruiter may choose. Starter is free and is not something you buy. */
export const SELECTABLE_PLANS = SEAT_LADDER;

/**
 * Record the plan a recruiter intends to pay for. Changing this never changes
 * what they currently have — entitlements still follow the subscription's
 * actual state until a payment is confirmed — so selecting Agency does not
 * hand out Agency until Agency is paid for.
 */
export function selectPlan(db, subscription, planKey, interval, actorUserId, now = Date.now()) {
  if (!SELECTABLE_PLANS.includes(planKey)) return { outcome: 'invalid_plan', selectable: SELECTABLE_PLANS };
  if (interval && !BILLING_INTERVALS.includes(interval)) return { outcome: 'invalid_interval' };
  subscription.selectedPlanKey = planKey;
  if (interval) subscription.billingInterval = interval;
  subscription.updatedAt = now;
  logBillingEvent(db, actorUserId, 'plan_selected', 'subscription', subscription.id,
    { planKey, interval: subscription.billingInterval || 'monthly' });
  return { outcome: 'selected', planKey, interval: subscription.billingInterval || 'monthly' };
}

/** Monthly recurring revenue, summed per subscription rather than
 *  count × one flat price — which stopped being true when the ladder shipped. */
export function monthlyRecurringRevenue(db, subscriptions) {
  let total = 0;
  for (const subscription of subscriptions) {
    const recruiter = (db.users || []).find((user) => user.id === subscription.recruiterUserId);
    const charge = chargeFor(db, recruiter, subscription, { currency: 'USD', interval: 'monthly' });
    total += charge.amount;
  }
  return total;
}
