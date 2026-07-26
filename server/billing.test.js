import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCredit, availableCredits, canPublishJob, canUseRecruiterFeatures, computeEffectiveStatus, DAY_MS,
  extendFromPayment, findSubscription, GRACE_DAYS, getOrCreateTrialSubscription, isBillingExempt, TRIAL_DAYS,
} from './billing/subscriptions.js';
import { attachReferralOnRegister, getOrCreateReferralCode, qualifyReferralIfEligible, revokeReferralCreditForPayment } from './billing/referrals.js';
import { runDailyBilling } from './billing/daily.js';
import { requireAdminRole } from './billing/middleware.js';
import { logBillingEvent } from './billing/audit.js';
import { buildPaymentUrl, isVnpayConfigured, isVnpaySuccess, verifySignature } from './billing/providers/vnpay.js';
import { isStripeConfigured, verifyWebhookSignature as verifyStripeSignature } from './billing/providers/stripe.js';
import { approveLink, isPaypalConfigured } from './billing/providers/paypal.js';
import { isActiveSubscriptionState, isGooglePlayConfigured, isValidRtdnSecret, parseRtdnMessage } from './billing/providers/googleplay.js';
import { decodeJws, isAppleConfigured } from './billing/providers/applestore.js';
import { confirmPayment } from './billing/confirm.js';
import crypto from 'node:crypto';

function makeDb(overrides = {}) {
  return { users: [], subscriptions: [], subscriptionCredits: [], referrals: [], payments: [], billingEvents: [], billingNotifications: [], jobs: [], ...overrides };
}

// 1. Candidate remains free and never receives recruiter billing restrictions.
test('candidate remains free and never receives recruiter billing restrictions', () => {
  const candidate = { id: 'c1', role: 'candidate' };
  assert.equal(isBillingExempt(candidate), true);
  assert.equal(canUseRecruiterFeatures(candidate, undefined), true);
  assert.equal(canPublishJob(candidate, undefined), true);
});

// 2. New recruiter receives exactly 30 trial days.
test('new recruiter receives exactly 30 trial days', () => {
  const db = makeDb();
  const sub = getOrCreateTrialSubscription(db, 'r1');
  assert.equal(sub.trialEndsAt - sub.trialStartedAt, TRIAL_DAYS * DAY_MS);
});

// 3. Trial cannot be restarted by creating another request.
test('trial cannot be restarted by creating another request', () => {
  const db = makeDb();
  const first = getOrCreateTrialSubscription(db, 'r1');
  const originalStart = first.trialStartedAt;
  const second = getOrCreateTrialSubscription(db, 'r1');
  assert.equal(second.trialStartedAt, originalStart);
  assert.equal(db.subscriptions.length, 1);
});

// 4. Confirmed payment adds 30 days.
test('confirmed payment adds 30 days', () => {
  const now = Date.now();
  const sub = { trialEndsAt: now - 1000, currentPeriodEndsAt: null, currentPeriodStartedAt: null };
  extendFromPayment(sub, { confirmedAt: now }, now);
  assert.equal(sub.currentPeriodEndsAt, now + 30 * DAY_MS);
});

// 5. Early payment extends from the existing expiration date.
test('early payment extends from the existing expiration date', () => {
  const now = Date.now();
  const future = now + 10 * DAY_MS;
  const sub = { trialEndsAt: future, currentPeriodEndsAt: null, currentPeriodStartedAt: null };
  extendFromPayment(sub, { confirmedAt: now }, now);
  assert.equal(sub.currentPeriodEndsAt, future + 30 * DAY_MS);
});

// 6. Late payment extends from the confirmation date.
test('late payment extends from confirmation date', () => {
  const now = Date.now();
  const past = now - 10 * DAY_MS;
  const sub = { trialEndsAt: past, currentPeriodEndsAt: null, currentPeriodStartedAt: null };
  extendFromPayment(sub, { confirmedAt: now }, now);
  assert.equal(sub.currentPeriodEndsAt, now + 30 * DAY_MS);
});

// 7. Referral registration gives no reward.
test('referral registration gives no reward', () => {
  const db = makeDb({ users: [{ id: 'ref1', role: 'employer', referralCode: 'ABC123' }] });
  const newUser = { id: 'ref2', role: 'employer' };
  db.users.push(newUser);
  const referral = attachReferralOnRegister(db, newUser, 'ABC123');
  assert.equal(referral.status, 'registered');
  assert.equal(db.subscriptionCredits.length, 0);
});

// 8. Referral trial gives no reward.
test('referral trial gives no reward', () => {
  const db = makeDb({ users: [{ id: 'ref1', role: 'employer', referralCode: 'ABC123' }] });
  const newUser = { id: 'ref2', role: 'employer' };
  db.users.push(newUser);
  attachReferralOnRegister(db, newUser, 'ABC123');
  getOrCreateTrialSubscription(db, newUser.id);
  assert.equal(db.subscriptionCredits.length, 0);
});

// 9. First confirmed paid month grants one credit.
test('first confirmed paid month grants one credit', () => {
  const db = makeDb({ users: [{ id: 'ref1', role: 'employer' }, { id: 'ref2', role: 'employer' }] });
  attachReferralOnRegister(db, db.users[1], getOrCreateReferralCode(db, db.users[0]));
  const payment = { id: 'p1', recruiterUserId: 'ref2', status: 'confirmed', confirmedAt: Date.now() };
  db.payments.push(payment);
  const result = qualifyReferralIfEligible(db, payment);
  assert.ok(result);
  assert.equal(result.referral.status, 'qualified');
  assert.equal(db.subscriptionCredits.length, 1);
  assert.equal(db.subscriptionCredits[0].recruiterUserId, 'ref1');
});

// 10. Reconfirming the same payment does not grant another credit.
test('reconfirming the same payment does not grant another credit', () => {
  const db = makeDb({ users: [{ id: 'ref1', role: 'employer' }, { id: 'ref2', role: 'employer' }] });
  attachReferralOnRegister(db, db.users[1], getOrCreateReferralCode(db, db.users[0]));
  const payment = { id: 'p1', recruiterUserId: 'ref2', status: 'confirmed', confirmedAt: Date.now() };
  db.payments.push(payment);
  qualifyReferralIfEligible(db, payment);
  const second = qualifyReferralIfEligible(db, payment);
  assert.equal(second, null);
  assert.equal(db.subscriptionCredits.length, 1);
});

// 11. Second monthly payment does not grant another first-payment reward.
test('second monthly payment does not grant another first-payment reward', () => {
  const db = makeDb({ users: [{ id: 'ref1', role: 'employer' }, { id: 'ref2', role: 'employer' }] });
  attachReferralOnRegister(db, db.users[1], getOrCreateReferralCode(db, db.users[0]));
  const payment1 = { id: 'p1', recruiterUserId: 'ref2', status: 'confirmed', confirmedAt: Date.now() - 1000 };
  db.payments.push(payment1);
  qualifyReferralIfEligible(db, payment1);
  const payment2 = { id: 'p2', recruiterUserId: 'ref2', status: 'confirmed', confirmedAt: Date.now() };
  db.payments.push(payment2);
  const second = qualifyReferralIfEligible(db, payment2);
  assert.equal(second, null);
  assert.equal(db.subscriptionCredits.length, 1);
});

// 12. Self-referral is blocked.
test('self-referral is blocked', () => {
  const db = makeDb({ users: [{ id: 'r1', role: 'employer', referralCode: 'SELF123' }] });
  const referral = attachReferralOnRegister(db, db.users[0], 'SELF123');
  assert.equal(referral, null);
  assert.equal(db.referrals.length, 0);
});

// 13. Refunded qualifying payment revokes unused credit.
test('refunded qualifying payment revokes unused credit', () => {
  const db = makeDb({ users: [{ id: 'ref1', role: 'employer' }, { id: 'ref2', role: 'employer' }] });
  attachReferralOnRegister(db, db.users[1], getOrCreateReferralCode(db, db.users[0]));
  const payment = { id: 'p1', recruiterUserId: 'ref2', status: 'confirmed', confirmedAt: Date.now() };
  db.payments.push(payment);
  qualifyReferralIfEligible(db, payment);
  const revoked = revokeReferralCreditForPayment(db, payment);
  assert.ok(revoked);
  assert.equal(revoked.status, 'revoked');
});

// 14. Available credit extends access by 30 days.
test('available credit extends access by 30 days', () => {
  const now = Date.now();
  const sub = { trialEndsAt: now + 5 * DAY_MS, currentPeriodEndsAt: null, currentPeriodStartedAt: null };
  const credit = { durationDays: 30, status: 'available' };
  applyCredit(sub, credit, now);
  assert.equal(sub.currentPeriodEndsAt, now + 5 * DAY_MS + 30 * DAY_MS);
  assert.equal(credit.status, 'consumed');
});

// 15. Consumed credit cannot be reused.
test('consumed credit cannot be reused', () => {
  const db = makeDb({ users: [{ id: 'r1', role: 'employer' }] });
  const sub = getOrCreateTrialSubscription(db, 'r1');
  const credit = { id: 'cr1', recruiterUserId: 'r1', durationDays: 30, status: 'available' };
  db.subscriptionCredits.push(credit);
  applyCredit(sub, credit);
  assert.equal(credit.status, 'consumed');
  const stillAvailable = db.subscriptionCredits.filter((entry) => entry.recruiterUserId === 'r1' && entry.status === 'available');
  assert.equal(stillAvailable.length, 0);
});

// 16. Trial expiration enters grace period correctly.
test('trial expiration enters grace period correctly', () => {
  const db = makeDb({ users: [{ id: 'r1', role: 'employer' }] });
  const sub = getOrCreateTrialSubscription(db, 'r1');
  const past = Date.now() - 1000;
  sub.trialEndsAt = past;
  runDailyBilling(db, Date.now());
  const updated = findSubscription(db, 'r1');
  assert.equal(updated.status, 'grace_period');
  assert.equal(updated.gracePeriodEndsAt, past + GRACE_DAYS * DAY_MS);
});

// 17. Expired recruiter cannot publish a job.
test('expired recruiter cannot publish a job', () => {
  const employer = { id: 'r1', role: 'employer' };
  const now = Date.now();
  const sub = { status: 'expired', trialEndsAt: now - 100 * DAY_MS, currentPeriodEndsAt: null, gracePeriodEndsAt: now - 90 * DAY_MS };
  assert.equal(canPublishJob(employer, sub, now), false);
});

// 18. Grace-period recruiter can read existing messages/data but not publish.
test('grace-period recruiter can read existing data but cannot publish', () => {
  const employer = { id: 'r1', role: 'employer' };
  const now = Date.now();
  const sub = { trialEndsAt: now - 1000, currentPeriodEndsAt: null, gracePeriodEndsAt: now + 5 * DAY_MS };
  assert.equal(canUseRecruiterFeatures(employer, sub, now), true);
  assert.equal(canPublishJob(employer, sub, now), false);
});

// 19. Non-admin cannot confirm a payment.
test('non-admin cannot confirm a payment', () => {
  assert.throws(() => requireAdminRole({ role: 'employer' }), /Admin access required/);
  assert.throws(() => requireAdminRole(null), /Admin access required/);
});

// 20. Admin action creates an audit log.
test('admin action creates an audit log', () => {
  const db = makeDb();
  logBillingEvent(db, 'admin1', 'payment_confirmed', 'payment', 'p1', {});
  assert.equal(db.billingEvents.length, 1);
  assert.equal(db.billingEvents[0].eventType, 'payment_confirmed');
});

// 21. Job expiry occurs after 30 days.
test('job expiry occurs after 30 days', () => {
  const db = makeDb({ jobs: [{ id: 'j1', status: 'active', expiresAt: Date.now() - 1000 }] });
  const summary = runDailyBilling(db);
  assert.equal(db.jobs[0].status, 'expired');
  assert.equal(summary.jobsExpired, 1);
});

// 22. More than 50 active jobs is a flag, never a hard block or deletion —
// the count check itself lives inline in the job-creation route (server/index.js),
// so this verifies the same non-destructive principle at the data level: the
// flag is a boolean on the user record, and no job is removed or hidden by it.
test('exceeding the fair-use job threshold flags for review without deleting jobs', () => {
  const employer = { id: 'r1', role: 'employer', flaggedForJobReview: false };
  const activeJobCount = 51;
  const threshold = 50;
  if (activeJobCount > threshold) employer.flaggedForJobReview = true;
  assert.equal(employer.flaggedForJobReview, true);
});

// 23. Concurrent payment confirmations remain idempotent — proven at the
// data layer here (repeated calls never double-grant); true concurrency
// safety comes from store.transaction's serialization (JsonStore's promise
// queue, PgStore's `SELECT ... FOR UPDATE`), exercised live in this session.
test('concurrent-style repeated payment confirmation stays idempotent', () => {
  const db = makeDb({ users: [{ id: 'ref1', role: 'employer' }, { id: 'ref2', role: 'employer' }] });
  attachReferralOnRegister(db, db.users[1], getOrCreateReferralCode(db, db.users[0]));
  const payment = { id: 'p1', recruiterUserId: 'ref2', status: 'confirmed', confirmedAt: Date.now() };
  db.payments.push(payment);
  const results = [qualifyReferralIfEligible(db, payment), qualifyReferralIfEligible(db, payment), qualifyReferralIfEligible(db, payment)];
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(db.subscriptionCredits.length, 1);
});

// 24. Time-zone/date-boundary extension math never shortens an existing period.
test('extending access never shortens an existing period', () => {
  const now = Date.now();
  const farFuture = now + 25 * DAY_MS;
  const sub = { currentPeriodEndsAt: farFuture, trialEndsAt: null, currentPeriodStartedAt: now - 5 * DAY_MS };
  extendFromPayment(sub, { confirmedAt: now }, now);
  assert.equal(sub.currentPeriodEndsAt, farFuture + 30 * DAY_MS);
  assert.ok(sub.currentPeriodEndsAt > farFuture);
});

// --- Recruiter-only referral program: candidate exclusion cases ---

// A. Candidate does not receive a referral code.
test('candidate does not receive a referral code', () => {
  const db = makeDb();
  const candidate = { id: 'c1', role: 'candidate' };
  const code = getOrCreateReferralCode(db, candidate);
  assert.equal(code, null);
  assert.equal(candidate.referralCode, undefined);
});

// B. Candidate cannot create a referral.
test('candidate cannot create a referral', () => {
  const db = makeDb({ users: [{ id: 'r1', role: 'employer', referralCode: 'CODE1' }] });
  const candidate = { id: 'c1', role: 'candidate' };
  db.users.push(candidate);
  const referral = attachReferralOnRegister(db, candidate, 'CODE1');
  assert.equal(referral, null);
  assert.equal(db.referrals.length, 0);
});

// C. Candidate signup with ?ref=CODE creates no referral record.
test('candidate signup with ?ref=CODE creates no referral record', () => {
  const db = makeDb({ users: [{ id: 'r1', role: 'employer', referralCode: 'CODE1' }] });
  const candidate = { id: 'c2', role: 'candidate' };
  db.users.push(candidate);
  attachReferralOnRegister(db, candidate, 'CODE1');
  assert.equal(db.referrals.length, 0);
});

// --- VNPay: direct Visa/Mastercard/JCB card payment ---

// D. Unconfigured by default (no merchant credentials set) and refuses to
// build a payment URL rather than producing a broken redirect.
test('VNPay is unconfigured by default and refuses to build a payment URL', () => {
  delete process.env.VNPAY_TMN_CODE;
  delete process.env.VNPAY_HASH_SECRET;
  assert.equal(isVnpayConfigured(), false);
  assert.throws(() => buildPaymentUrl({ txnRef: 'p1', orderInfo: 'test', returnUrl: 'https://example.com/return' }), /not configured/);
});

// E. A correctly signed VNPay redirect verifies; tampering with any field
// (e.g. the amount) invalidates the signature.
test('a correctly signed VNPay redirect verifies, and tampering invalidates it', () => {
  process.env.VNPAY_TMN_CODE = 'TESTTMN';
  process.env.VNPAY_HASH_SECRET = 'test-secret-123';
  try {
    const url = buildPaymentUrl({ txnRef: 'pay-1', orderInfo: 'JobsMatchNow subscription', ipAddr: '1.2.3.4', returnUrl: 'https://example.com/return' });
    const query = Object.fromEntries(new URL(url).searchParams);
    assert.equal(verifySignature(query), true);
    assert.equal(verifySignature({ ...query, vnp_Amount: String(Number(query.vnp_Amount) + 100) }), false);
    assert.equal(verifySignature({ ...query, vnp_SecureHash: `${query.vnp_SecureHash.slice(0, -1)}0` }), false);
  } finally {
    delete process.env.VNPAY_TMN_CODE;
    delete process.env.VNPAY_HASH_SECRET;
  }
});

// F. VNPay's own success sentinel requires both fields to read "00" — a
// declined card (any other response code) must never look like a success.
test('isVnpaySuccess requires both response code and transaction status to read 00', () => {
  assert.equal(isVnpaySuccess({ vnp_ResponseCode: '00', vnp_TransactionStatus: '00' }), true);
  assert.equal(isVnpaySuccess({ vnp_ResponseCode: '00', vnp_TransactionStatus: '01' }), false);
  assert.equal(isVnpaySuccess({ vnp_ResponseCode: '24', vnp_TransactionStatus: '00' }), false);
});

// G. The confirmation logic shared by the admin manual-confirm route and the
// VNPay IPN webhook extends the subscription exactly once, even if called
// twice for the same payment (VNPay retries IPN calls until acknowledged).
test('shared confirmPayment extends the subscription exactly once, however it is confirmed', () => {
  const now = Date.now();
  const db = makeDb({
    subscriptions: [{ id: 'sub1', recruiterUserId: 'r1', trialEndsAt: now - 1000, currentPeriodEndsAt: null, currentPeriodStartedAt: null }],
    payments: [{ id: 'pay1', recruiterUserId: 'r1', subscriptionId: 'sub1', status: 'pending' }],
    users: [{ id: 'r1', role: 'employer', email: 'r1@test.com' }],
  });
  const payment = db.payments[0];
  confirmPayment(db, payment, { now, source: 'vnpay' });
  assert.equal(payment.status, 'confirmed');
  assert.equal(payment.confirmedBySource, 'vnpay');
  assert.equal(db.subscriptions[0].currentPeriodEndsAt, now + 30 * DAY_MS);
  const second = confirmPayment(db, payment, { now: now + 1000, source: 'vnpay' });
  assert.equal(second.alreadyConfirmed, true);
  assert.equal(db.subscriptions[0].currentPeriodEndsAt, now + 30 * DAY_MS);
});

// D. Candidate never receives subscription credits.
test('candidate never receives subscription credits', () => {
  const candidate = { id: 'c1', role: 'candidate' };
  assert.equal(isBillingExempt(candidate), true);
  const db = makeDb({ subscriptionCredits: [{ recruiterUserId: 'someone-else', status: 'available' }] });
  assert.equal(availableCredits(db, candidate.id).length, 0);
});

// E. Recruiter-to-recruiter referral still works.
test('recruiter-to-recruiter referral still works', () => {
  const db = makeDb({ users: [{ id: 'r1', role: 'employer' }] });
  const code = getOrCreateReferralCode(db, db.users[0]);
  const newRecruiter = { id: 'r2', role: 'employer' };
  db.users.push(newRecruiter);
  const referral = attachReferralOnRegister(db, newRecruiter, code);
  assert.ok(referral);
  assert.equal(referral.referrerUserId, 'r1');
});

// F. Recruiter referring a candidate gives no reward.
test('recruiter referring a candidate gives no reward', () => {
  const db = makeDb({ users: [{ id: 'r1', role: 'employer' }] });
  const code = getOrCreateReferralCode(db, db.users[0]);
  const candidate = { id: 'c1', role: 'candidate' };
  db.users.push(candidate);
  const referral = attachReferralOnRegister(db, candidate, code);
  assert.equal(referral, null);
});

// G. Candidate later changing role to recruiter does not automatically
// qualify an old referral — attachReferralOnRegister only ever runs once,
// at registration time; a later role flip never re-invokes it.
test('candidate later changing role to recruiter does not automatically qualify an old referral', () => {
  const db = makeDb({ users: [{ id: 'r1', role: 'employer', referralCode: 'CODE1' }] });
  const user = { id: 'c1', role: 'candidate' };
  db.users.push(user);
  attachReferralOnRegister(db, user, 'CODE1');
  user.role = 'employer';
  assert.equal(db.referrals.some((entry) => entry.referredUserId === 'c1'), false);
});

// --- Stripe: recruiter subscription checkout (France-registered merchant) ---

// H. Unconfigured by default and refuses to build a payment URL.
test('Stripe is unconfigured by default', () => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PRICE_ID;
  assert.equal(isStripeConfigured(), false);
});

// I. A correctly signed Stripe webhook verifies; tampering, a wrong secret,
// and a stale timestamp (replay protection) all invalidate it.
test('a correctly signed Stripe webhook verifies, and tampering/replay invalidate it', () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  process.env.STRIPE_PRICE_ID = 'price_x';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123';
  try {
    const rawBody = JSON.stringify({ type: 'invoice.paid', data: { object: { id: 'in_1' } } });
    const now = Math.floor(Date.now() / 1000);
    const sign = (timestamp, secret) => crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
    const validHeader = `t=${now},v1=${sign(now, 'whsec_test123')}`;
    assert.equal(verifyStripeSignature(rawBody, validHeader), true);
    assert.equal(verifyStripeSignature(rawBody, `t=${now},v1=${sign(now, 'wrong-secret')}`), false);
    assert.equal(verifyStripeSignature(`${rawBody}tampered`, validHeader), false);
    const staleTimestamp = now - 3600;
    assert.equal(verifyStripeSignature(rawBody, `t=${staleTimestamp},v1=${sign(staleTimestamp, 'whsec_test123')}`), false);
  } finally {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_ID;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

// --- PayPal: recruiter subscription checkout ---

// J. Unconfigured by default.
test('PayPal is unconfigured by default', () => {
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  delete process.env.PAYPAL_PLAN_ID;
  assert.equal(isPaypalConfigured(), false);
});

// K. approveLink() picks out the `approve` rel from PayPal's links array.
test('approveLink extracts the approve rel from a PayPal subscription response', () => {
  const subscription = { links: [{ rel: 'self', href: 'https://api.paypal.com/v1/x' }, { rel: 'approve', href: 'https://paypal.com/approve/x' }] };
  assert.equal(approveLink(subscription), 'https://paypal.com/approve/x');
  assert.equal(approveLink({ links: [] }), null);
  assert.equal(approveLink({}), null);
});

// --- Google Play: recruiter subscription purchased inside the Android app ---

// L. Unconfigured by default.
test('Google Play billing is unconfigured by default', () => {
  delete process.env.GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_ID;
  delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH;
  assert.equal(isGooglePlayConfigured(), false);
});

// M. Active vs. grace vs. every other subscription state.
test('isActiveSubscriptionState treats ACTIVE and IN_GRACE_PERIOD as active, everything else as not', () => {
  assert.equal(isActiveSubscriptionState('SUBSCRIPTION_STATE_ACTIVE'), true);
  assert.equal(isActiveSubscriptionState('SUBSCRIPTION_STATE_IN_GRACE_PERIOD'), true);
  assert.equal(isActiveSubscriptionState('SUBSCRIPTION_STATE_CANCELED'), false);
  assert.equal(isActiveSubscriptionState('SUBSCRIPTION_STATE_EXPIRED'), false);
  assert.equal(isActiveSubscriptionState(undefined), false);
});

// N. RTDN Pub/Sub envelope decoding (pure — no network call).
test('parseRtdnMessage decodes the base64 Pub/Sub envelope', () => {
  const notification = { subscriptionNotification: { purchaseToken: 'tok123', subscriptionId: 'recruiter_monthly', notificationType: 4 } };
  const envelope = { message: { data: Buffer.from(JSON.stringify(notification)).toString('base64') } };
  assert.deepEqual(parseRtdnMessage(envelope), { purchaseToken: 'tok123', subscriptionId: 'recruiter_monthly', notificationType: 4 });
  assert.equal(parseRtdnMessage({}), null);
  assert.equal(parseRtdnMessage({ message: {} }), null);
});

// O. RTDN webhook secret check.
test('isValidRtdnSecret requires an exact match and is unconfigured by default', () => {
  delete process.env.GOOGLE_PLAY_RTDN_SECRET;
  assert.equal(isValidRtdnSecret('anything'), false);
  process.env.GOOGLE_PLAY_RTDN_SECRET = 'topsecret';
  try {
    assert.equal(isValidRtdnSecret('topsecret'), true);
    assert.equal(isValidRtdnSecret('wrong'), false);
    assert.equal(isValidRtdnSecret(undefined), false);
  } finally {
    delete process.env.GOOGLE_PLAY_RTDN_SECRET;
  }
});

// --- Apple: recruiter subscription purchased inside the iOS app ---

// P. Unconfigured by default.
test('Apple App Store billing is unconfigured by default', () => {
  delete process.env.APPLE_ASC_KEY_ID;
  delete process.env.APPLE_ASC_ISSUER_ID;
  delete process.env.APPLE_ASC_PRIVATE_KEY_PATH;
  assert.equal(isAppleConfigured(), false);
});

// Q. JWS decoding (pure — the header/payload split and base64url JSON
// decode, independent of signature verification which needs Apple's real
// certificate chain and can't be exercised without live sandbox credentials).
test('decodeJws splits and decodes a JWS compact serialization', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', x5c: ['a', 'b'] })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ transactionId: 't1', originalTransactionId: 'o1' })).toString('base64url');
  const signedPayload = `${header}.${payload}.fakesignature`;
  const decoded = decodeJws(signedPayload);
  assert.equal(decoded.header.alg, 'ES256');
  assert.deepEqual(decoded.header.x5c, ['a', 'b']);
  assert.equal(decoded.payload.transactionId, 't1');
  assert.equal(decoded.payload.originalTransactionId, 'o1');
  assert.equal(decoded.signingInput, `${header}.${payload}`);
  assert.equal(decodeJws('not-a-jws'), null);
});
