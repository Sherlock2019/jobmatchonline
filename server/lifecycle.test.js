import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLiveJobLimit, assertNeverZeroLiveJobs, downgradeToFree, liveJobsFor } from './billing/downgrade.js';
import {
  clearSlotLocks, confirmHire, hasVerifiedHire, HIRE_SLOT_LOCK_DAYS, lockedSlotCount,
  pauseElapsedPostings, POSTING_TERM_DAYS, recordHire, releaseElapsedSlotLocks, renewPosting, startPostingTerm,
} from './billing/postings.js';
import { isCompanyEmail, isLinkedinCompanyPage, recruiterVerification } from './billing/verification.js';
import { dueCheckpoints, extendForHireInFlight, markCheckpointSent, pausedMsBetween, trialEndsAt, TRIAL_DAYS, HIRE_IN_FLIGHT_EXTENSION_DAYS } from './billing/trial.js';
import { referralCreditsInLastYear, REFERRAL_CREDITS_PER_YEAR } from './billing/referrals.js';

const DAY = 24 * 60 * 60 * 1000;
const db = () => ({ users: [], jobs: [], subscriptions: [], subscriptionCredits: [], billingEvents: [] });
const job = (id, over = {}) => ({ id, employerId: 'r1', status: 'active', createdAt: 1, ...over });

/* ── The invariant that outranks everything else ─────────────────────────── */

test('a recruiter can never be left with zero live jobs by a downgrade', () => {
  const d = db();
  d.jobs = [job('a', { createdAt: 1 }), job('b', { createdAt: 2 }), job('c', { createdAt: 3 })];
  const sub = { id: 's1', recruiterUserId: 'r1' };
  downgradeToFree(d, sub, 1);
  assert.equal(liveJobsFor(d, 'r1').length, 1);
  assert.equal(d.jobs.filter((j) => j.status === 'paused').length, 2);
  assert.equal(d.jobs.length, 3, 'nothing is ever deleted');
});

test('a downgrade to a zero-slot plan still leaves one job visible', () => {
  const d = db();
  d.jobs = [job('a'), job('b')];
  applyLiveJobLimit(d, 'r1', 0);
  assert.equal(liveJobsFor(d, 'r1').length, 1, 'zero live jobs is impossible by design');
});

test('the invariant check finds and repairs an account with everything paused', () => {
  const d = db();
  d.jobs = [job('a', { status: 'paused', createdAt: 1 }), job('b', { status: 'paused', createdAt: 2 })];
  const offenders = assertNeverZeroLiveJobs(d);
  assert.deepEqual(offenders, ['r1']);
  assert.equal(liveJobsFor(d, 'r1').length, 1);
  assert.equal(d.jobs.find((j) => j.status === 'active').id, 'b', 'the newest posting comes back');
});

test('a recruiter with no postings at all is not an invariant violation', () => {
  const d = db();
  assert.deepEqual(assertNeverZeroLiveJobs(d), []);
});

test('raising the limit again restores the paused postings, in order', () => {
  const d = db();
  d.jobs = [job('a', { createdAt: 1 }), job('b', { createdAt: 2 }), job('c', { createdAt: 3 })];
  applyLiveJobLimit(d, 'r1', 1);
  assert.equal(liveJobsFor(d, 'r1').length, 1);
  applyLiveJobLimit(d, 'r1', 3);
  assert.equal(liveJobsFor(d, 'r1').length, 3, 'upgrading brings everything back');
});

/* ── Posting term and renewal ────────────────────────────────────────────── */

test('a posting term runs 60 days and pauses rather than expiring', () => {
  const d = db();
  const now = Date.now();
  const posting = job('a');
  startPostingTerm(posting, now);
  assert.equal(posting.expiresAt - posting.postedAt, POSTING_TERM_DAYS * DAY);
  d.jobs = [posting, job('b', { expiresAt: now + 1e9 })];
  pauseElapsedPostings(d, now + (POSTING_TERM_DAYS + 1) * DAY);
  assert.equal(posting.status, 'paused');
  assert.notEqual(posting.status, 'expired');
});

test('renewal is free, brings the posting back live, and can repeat forever', () => {
  const d = db();
  const posting = job('a', { status: 'paused', pausedReason: 'term_elapsed' });
  for (let i = 0; i < 5; i += 1) {
    const result = renewPosting(d, posting, 'r1');
    assert.equal(result.outcome, 'renewed');
  }
  assert.equal(posting.status, 'active');
  assert.equal(posting.pausedReason, null);
});

test('renewal does not un-pause a job the recruiter paused themselves', () => {
  const d = db();
  const posting = job('a', { status: 'paused', pausedReason: 'recruiter' });
  renewPosting(d, posting, 'r1');
  assert.equal(posting.status, 'paused', 'only a term-elapsed pause is lifted by renewing');
});

/* ── Hire slot locks ─────────────────────────────────────────────────────── */

test('a hire made through the platform locks the slot for 30 days', () => {
  const d = db();
  const posting = job('a');
  d.jobs = [posting];
  const now = Date.now();
  recordHire(d, posting, { outcome: 'platform', candidateId: 'c1' }, now);
  assert.equal(posting.slotLockedUntil, now + HIRE_SLOT_LOCK_DAYS * DAY);
  assert.equal(lockedSlotCount(d, 'r1', now), 1);
});

test('a role filled elsewhere or cancelled opens the slot immediately', () => {
  const d = db();
  for (const outcome of ['elsewhere', 'cancelled']) {
    const posting = job(outcome);
    d.jobs = [posting];
    recordHire(d, posting, { outcome });
    assert.equal(posting.slotLockedUntil, null, `${outcome} must never penalise the recruiter`);
  }
});

test('upgrading clears every slot lock instantly', () => {
  const d = db();
  d.jobs = [job('a'), job('b')];
  d.jobs.forEach((j) => recordHire(d, j, { outcome: 'platform' }));
  assert.equal(clearSlotLocks(d, 'r1', 'upgraded'), 2);
  assert.equal(lockedSlotCount(d, 'r1'), 0);
});

test('slot locks release themselves once the 30 days elapse', () => {
  const d = db();
  const posting = job('a');
  d.jobs = [posting];
  const now = Date.now();
  recordHire(d, posting, { outcome: 'platform' }, now);
  assert.equal(releaseElapsedSlotLocks(d, now + (HIRE_SLOT_LOCK_DAYS + 1) * DAY), 1);
  assert.equal(lockedSlotCount(d, 'r1'), 0);
});

test('only the candidate can verify a hire — the recruiter saying so is not enough', () => {
  const d = db();
  const posting = job('a');
  d.jobs = [posting];
  recordHire(d, posting, { outcome: 'platform', candidateId: 'c1' });
  assert.equal(hasVerifiedHire(d, 'r1'), false, 'recruiter-reported alone earns no badge');

  assert.equal(confirmHire(d, posting, 'someone-else').outcome, 'not_the_hired_candidate');
  assert.equal(confirmHire(d, posting, 'c1').outcome, 'confirmed');
  assert.equal(hasVerifiedHire(d, 'r1'), true);
  assert.equal(confirmHire(d, posting, 'c1').outcome, 'already_confirmed');
});

/* ── Recruiter verification ──────────────────────────────────────────────── */

test('consumer and disposable mailboxes are not company proof', () => {
  for (const email of ['a@gmail.com', 'b@yahoo.com.vn', 'c@mailinator.com', 'd@outlook.com']) {
    assert.equal(isCompanyEmail(email), false, email);
  }
});

test('a company domain counts as verification', () => {
  for (const email of ['hr@acme.com', 'tuyendung@fpt.com.vn']) {
    assert.equal(isCompanyEmail(email), true, email);
  }
});

test('a LinkedIn company page is accepted, a personal profile is not', () => {
  assert.equal(isLinkedinCompanyPage('https://www.linkedin.com/company/acme'), true);
  assert.equal(isLinkedinCompanyPage('https://linkedin.com/company/acme-vn/'), true);
  assert.equal(isLinkedinCompanyPage('https://www.linkedin.com/in/some-person'), false);
  assert.equal(isLinkedinCompanyPage('https://example.com/company/acme'), false);
});

test('a gmail recruiter can still verify with a company LinkedIn page', () => {
  const user = { email: 'me@gmail.com', companyLinkedinUrl: 'https://www.linkedin.com/company/acme' };
  assert.equal(recruiterVerification(user).verified, true);
  assert.equal(recruiterVerification(user).method, 'linkedin_page');
});

test('an unverifiable recruiter is told exactly what to do, not just refused', () => {
  const result = recruiterVerification({ email: 'me@gmail.com' });
  assert.equal(result.verified, false);
  assert.match(result.message, /company email|LinkedIn/i);
});

test('an admin override verifies an account a regex would refuse', () => {
  const user = { email: 'me@gmail.com', verifiedRecruiterAt: Date.now(), verifiedRecruiterMethod: 'manual' };
  assert.equal(recruiterVerification(user).verified, true);
});

/* ── Trial terms ─────────────────────────────────────────────────────────── */

test('there is one trial length, 90 days, for everybody', () => {
  assert.equal(TRIAL_DAYS, 90);
});

test('no holiday pause is configured by default — dates are never guessed', () => {
  const start = Date.UTC(2027, 0, 1);
  assert.equal(trialEndsAt(start, 90), start + 90 * DAY);
});

test('a configured pause window pushes the trial end out by its length', () => {
  const start = Date.UTC(2027, 0, 1);
  const windows = [{ label: 'holiday', startsAt: start + 10 * DAY, endsAt: start + 17 * DAY }];
  assert.equal(pausedMsBetween(start, start + 90 * DAY, windows), 7 * DAY);
  assert.equal(trialEndsAt(start, 90, windows), start + 97 * DAY);
});

test('a pause window outside the trial does not move anything', () => {
  const start = Date.UTC(2027, 0, 1);
  const windows = [{ label: 'later', startsAt: start + 200 * DAY, endsAt: start + 210 * DAY }];
  assert.equal(trialEndsAt(start, 90, windows), start + 90 * DAY);
});

/* ── Trial checkpoints ───────────────────────────────────────────────────── */

test('the day-2 nudge fires only for a recruiter who has posted nothing', () => {
  const sub = { trialStartedAt: Date.now() - 3 * DAY, trialEndsAt: Date.now() + 80 * DAY, sentCheckpoints: [] };
  assert.equal(dueCheckpoints(sub, { hasJobs: false }).some((c) => c.key === 'day_2'), true);
  assert.equal(dueCheckpoints(sub, { hasJobs: true }).some((c) => c.key === 'day_2'), false);
});

test('a checkpoint fires once, however many times the cron runs', () => {
  const sub = { trialStartedAt: Date.now() - 8 * DAY, trialEndsAt: Date.now() + 80 * DAY, sentCheckpoints: [] };
  const first = dueCheckpoints(sub, { hasJobs: true });
  assert.equal(first.length, 1);
  first.forEach((c) => markCheckpointSent(sub, c.key));
  assert.deepEqual(dueCheckpoints(sub, { hasJobs: true }), []);
});

test('checkpoints never fire after the trial has already ended', () => {
  const sub = { trialStartedAt: Date.now() - 100 * DAY, trialEndsAt: Date.now() - 5 * DAY, sentCheckpoints: [] };
  assert.deepEqual(dueCheckpoints(sub, { hasJobs: true }), []);
});

test('a hire in flight buys 30 more days, once', () => {
  const d = db();
  const endsAt = Date.now() + DAY;
  const sub = { id: 's1', recruiterUserId: 'r1', trialEndsAt: endsAt };
  assert.equal(extendForHireInFlight(d, sub).outcome, 'extended');
  assert.equal(sub.trialEndsAt, endsAt + HIRE_IN_FLIGHT_EXTENSION_DAYS * DAY);
  assert.equal(extendForHireInFlight(d, sub).outcome, 'already_granted');
});

/* ── Referral cap ────────────────────────────────────────────────────────── */

test('referral credits are capped at twelve a year', () => {
  const d = db();
  const now = Date.now();
  for (let i = 0; i < REFERRAL_CREDITS_PER_YEAR; i += 1) {
    d.subscriptionCredits.push({ recruiterUserId: 'r1', sourceType: 'referral', status: 'available', grantedAt: now - i * DAY });
  }
  assert.equal(referralCreditsInLastYear(d, 'r1', now), REFERRAL_CREDITS_PER_YEAR);
});

test('credits older than a year, and revoked ones, free up capacity again', () => {
  const d = db();
  const now = Date.now();
  d.subscriptionCredits = [
    { recruiterUserId: 'r1', sourceType: 'referral', status: 'available', grantedAt: now - 400 * DAY },
    { recruiterUserId: 'r1', sourceType: 'referral', status: 'revoked', grantedAt: now - DAY },
    { recruiterUserId: 'r1', sourceType: 'admin_grant', status: 'available', grantedAt: now - DAY },
  ];
  assert.equal(referralCreditsInLastYear(d, 'r1', now), 0);
});
