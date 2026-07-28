/* Recruiter verification.
 *
 * The old spam control was the word "legitimate" in the pricing copy. A word is
 * not enforcement. This is: to publish, a recruiter needs either a company email
 * on a real domain, or a LinkedIn company page.
 *
 * Deliberately weak checks. The goal is to make bulk fake-employer signups cost
 * something, not to verify corporate identity — that would need documents, a
 * review queue, and staff none of which exist. A determined bad actor gets past
 * this; a spam script mostly does not, and that is the whole intent. */

/* Free and disposable mail providers. A recruiter using one isn't refused, they
 * just have to supply a LinkedIn company page instead. */
const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.com.vn', 'hotmail.com', 'outlook.com',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
  'mail.com', 'gmx.com', 'yandex.com', 'zoho.com', 'fastmail.com',
  // Common disposable providers.
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'trashmail.com',
  'yopmail.com', 'sharklasers.com', 'throwawaymail.com',
]);

export function emailDomain(email) {
  const at = String(email || '').lastIndexOf('@');
  return at === -1 ? '' : String(email).slice(at + 1).trim().toLowerCase();
}

/** A company domain is simply one that isn't a consumer mailbox. */
export function isCompanyEmail(email) {
  const domain = emailDomain(email);
  if (!domain || !domain.includes('.')) return false;
  return !CONSUMER_EMAIL_DOMAINS.has(domain);
}

const LINKEDIN_COMPANY = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/(company|showcase)\/[A-Za-z0-9\-_%.]+\/?$/i;

export function isLinkedinCompanyPage(url) {
  return LINKEDIN_COMPANY.test(String(url || '').trim());
}

/**
 * Why this recruiter counts as verified, or what they still need.
 * `manual` is the admin override — support has to be able to unstick someone
 * whose perfectly real company fails a regex.
 */
export function recruiterVerification(user) {
  if (!user) return { verified: false, method: null, reason: 'no_account' };
  if (user.verifiedRecruiterAt) return { verified: true, method: user.verifiedRecruiterMethod || 'manual' };
  if (isCompanyEmail(user.email)) return { verified: true, method: 'company_email', domain: emailDomain(user.email) };
  if (isLinkedinCompanyPage(user.companyLinkedinUrl)) return { verified: true, method: 'linkedin_page' };
  return {
    verified: false,
    method: null,
    reason: 'needs_company_proof',
    message: 'To publish a job, add your company email address or your company LinkedIn page. It takes a minute and keeps fake listings off the platform.',
  };
}

export function markVerified(user, method, now = Date.now()) {
  user.verifiedRecruiterAt = now;
  user.verifiedRecruiterMethod = method;
  return user;
}
