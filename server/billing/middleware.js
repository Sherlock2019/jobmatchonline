import { canAddSeat, canContactCandidate, canPublishJob, findSubscription, isBillingExempt } from './subscriptions.js';

/* Backend enforcement only — the frontend hides buttons for a nicer UX, but
 * every state-changing route re-checks this itself, per the "never rely only
 * on frontend controls" requirement. */

const CHECKS = { publish_job: canPublishJob, contact_candidate: canContactCandidate, add_seat: canAddSeat };

/** Throws a 402-style error if `user` (an employer) can't currently perform
 * `action` ('publish_job' | 'contact_candidate' | 'add_seat'). No-op for
 * candidates and demo accounts (see isBillingExempt). Call this INSIDE the
 * same store.transaction() as the action it's guarding, using the freshly
 * read `db`, so the check and the write see the same state. */
export function assertRecruiterAccess(action, db, user) {
  if (isBillingExempt(user)) return;
  const subscription = findSubscription(db, user.id);
  const check = CHECKS[action];
  if (!check(user, subscription)) {
    const error = new Error('Your recruiter subscription is not active for this action. Visit Billing to renew.');
    error.status = 402;
    error.code = 'billing_required';
    throw error;
  }
}

/** Real per-user admin role, distinct from the pre-existing requireAdmin()
 * shared-token check used by the two unrelated feedback-moderation routes.
 * Callers resolve `session` via their own authSession(req) first (that
 * function is private to server/index.js) and pass it in here. */
export function requireAdminRole(session) {
  if (!session || session.role !== 'admin') {
    const error = new Error('Admin access required');
    error.status = 403;
    throw error;
  }
  return session;
}
