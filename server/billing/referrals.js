import crypto from 'node:crypto';
import { logBillingEvent } from './audit.js';
import { REFERRAL_CREDIT_DAYS } from './subscriptions.js';

/* Recruiter-only referral program. Candidates never get a code, never create
 * a Referral row, and never receive a credit — every entry point below
 * checks role === 'employer' before doing anything. */

function normalizeEmailSignal(email) {
  if (!email) return '';
  const [local, domain] = String(email).toLowerCase().split('@');
  if (!domain) return String(email).toLowerCase();
  // Gmail-style dot/plus tricks are the most common duplicate-account signal.
  const stripped = domain.includes('gmail.com') ? local.replace(/\./g, '').split('+')[0] : local.split('+')[0];
  return `${stripped}@${domain}`;
}

/** Lazily generated, non-sequential, stored directly on the recruiter's own
 * user record. Never issued to candidates. */
export function getOrCreateReferralCode(db, user) {
  if (user.role !== 'employer') return null;
  if (user.referralCode) return user.referralCode;
  let code;
  do {
    code = crypto.randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
  } while (db.users.some((entry) => entry.referralCode === code));
  user.referralCode = code;
  return code;
}

export function findReferrerByCode(db, code) {
  if (!code) return undefined;
  return db.users.find((entry) => entry.referralCode === code && entry.role === 'employer');
}

/** Called only from the recruiter registration path (never on candidate
 * signup, never retroactively on a later role change) — the one place
 * referral attribution is allowed to happen, per spec. */
export function attachReferralOnRegister(db, newUser, referralCode) {
  if (!referralCode || newUser.role !== 'employer') return null;
  const referrer = findReferrerByCode(db, referralCode);
  if (!referrer || referrer.id === newUser.id || referrer.demo === true || newUser.demo === true) return null;
  if (!Array.isArray(db.referrals)) db.referrals = [];
  if (db.referrals.some((entry) => entry.referredUserId === newUser.id)) return null; // one referrer per referred, ever
  const suspicious = normalizeEmailSignal(referrer.email) === normalizeEmailSignal(newUser.email) && Boolean(newUser.email);
  const referral = {
    id: crypto.randomUUID(),
    referrerUserId: referrer.id,
    referredUserId: newUser.id,
    referralCode,
    status: 'registered',
    suspicious,
    qualifiedPaymentId: null,
    qualifiedAt: null,
    rejectionReason: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  db.referrals.push(referral);
  logBillingEvent(db, newUser.id, 'referral_registered', 'referral', referral.id, { referrerUserId: referrer.id, suspicious });
  return referral;
}

/** Called from inside the payment-confirmation transaction. Grants exactly
 * one 30-day credit to the referrer the FIRST time the referred recruiter's
 * payment is confirmed. Idempotent: a re-confirm of the same payment, or a
 * later month's payment, never grants a second reward. */
export function qualifyReferralIfEligible(db, payment) {
  const referral = (db.referrals || []).find((entry) => entry.referredUserId === payment.recruiterUserId);
  if (!referral || referral.status === 'qualified' || referral.status === 'rejected') return null;
  const earlierConfirmed = (db.payments || []).some((entry) =>
    entry.recruiterUserId === payment.recruiterUserId && entry.status === 'confirmed' && entry.id !== payment.id && entry.confirmedAt < payment.confirmedAt);
  if (earlierConfirmed) return null; // this is not the referred recruiter's first confirmed month
  referral.status = 'qualified';
  referral.qualifiedPaymentId = payment.id;
  referral.qualifiedAt = Date.now();
  referral.updatedAt = Date.now();
  if (!Array.isArray(db.subscriptionCredits)) db.subscriptionCredits = [];
  const credit = {
    id: crypto.randomUUID(),
    recruiterUserId: referral.referrerUserId,
    sourceType: 'referral',
    sourceReferenceId: referral.id,
    durationDays: REFERRAL_CREDIT_DAYS,
    status: 'available',
    grantedAt: Date.now(),
    consumedAt: null,
    revokedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  db.subscriptionCredits.push(credit);
  logBillingEvent(db, referral.referrerUserId, 'referral_reward_earned', 'referral', referral.id, { referredUserId: referral.referredUserId, creditId: credit.id });
  return { referral, credit };
}

/** A refunded/reversed/disputed qualifying payment revokes the credit it
 * granted, but only while it's still unused — a credit already consumed
 * (already extended someone's access) cannot be clawed back. */
export function revokeReferralCreditForPayment(db, payment) {
  const referral = (db.referrals || []).find((entry) => entry.qualifiedPaymentId === payment.id);
  if (!referral) return null;
  const credit = (db.subscriptionCredits || []).find((entry) => entry.sourceReferenceId === referral.id && entry.sourceType === 'referral');
  if (!credit || credit.status !== 'available') return null;
  credit.status = 'revoked';
  credit.revokedAt = Date.now();
  credit.updatedAt = Date.now();
  logBillingEvent(db, referral.referrerUserId, 'referral_credit_revoked', 'subscriptionCredit', credit.id, { paymentId: payment.id });
  return credit;
}
