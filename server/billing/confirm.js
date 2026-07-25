import { logBillingEvent } from './audit.js';
import { extendFromPayment, findSubscription } from './subscriptions.js';
import { qualifyReferralIfEligible } from './referrals.js';

/** Shared by the admin manual-confirm route and the VNPay IPN webhook so the
 * money-critical extend-subscription + qualify-referral + audit logic exists
 * in exactly one place. Idempotent: confirming an already-confirmed payment
 * is a no-op (returns alreadyConfirmed: true) rather than double-extending
 * the subscription or double-granting a referral credit. */
export function confirmPayment(db, payment, { now = Date.now(), adminId = null, source = 'admin' } = {}) {
  if (payment.status === 'confirmed') return { payment, alreadyConfirmed: true };
  if (!['submitted', 'pending'].includes(payment.status)) {
    const error = new Error(`Cannot confirm a payment in status "${payment.status}"`);
    error.status = 409;
    throw error;
  }
  payment.status = 'confirmed';
  payment.confirmedAt = now;
  payment.confirmedByAdminId = adminId;
  payment.confirmedBySource = source;
  payment.updatedAt = now;
  const subscription = db.subscriptions.find((entry) => entry.id === payment.subscriptionId) || findSubscription(db, payment.recruiterUserId);
  extendFromPayment(subscription, payment, now);
  logBillingEvent(db, adminId || payment.recruiterUserId, 'payment_confirmed', 'payment', payment.id, { recruiterUserId: payment.recruiterUserId, newExpiry: subscription.currentPeriodEndsAt, source });
  const qualification = qualifyReferralIfEligible(db, payment);
  const recruiter = db.users.find((entry) => entry.id === payment.recruiterUserId);
  const referrer = qualification ? db.users.find((entry) => entry.id === qualification.referral.referrerUserId) : null;
  return { payment, subscription, qualification, recruiterEmail: recruiter?.email, recruiterName: recruiter?.name, referrerEmail: referrer?.email };
}
