import crypto from 'node:crypto';
import fs from 'node:fs';

/* Google Play: recruiter subscription purchased inside the Android app via
 * the native PlayBilling Capacitor plugin (android/app/src/main/java/com/
 * jobsmatchnow/app/PlayBillingPlugin.java). Verified server-side against the
 * Android Publisher API — hand-rolled service-account JWT auth via
 * node:crypto rather than the `googleapis` SDK, matching this codebase's
 * existing pattern (see VNPay/Stripe). The client-side purchase
 * acknowledgement in the plugin is NOT the confirmation authority — only a
 * server-verified purchase token (this file) or a Real-time Developer
 * Notification (RTDN) ever extends a subscription, via the shared
 * confirmPayment() in server/billing/confirm.js. */

function packageName() { return process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.jobsmatchnow.app'; }
function subscriptionProductId() { return process.env.GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_ID || ''; }
export { subscriptionProductId as googlePlaySubscriptionProductId };
function rtdnSecret() { return process.env.GOOGLE_PLAY_RTDN_SECRET || ''; }

function loadServiceAccount() {
  const keyPath = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    return parsed.client_email && parsed.private_key ? parsed : null;
  } catch {
    return null;
  }
}

export function isGooglePlayConfigured() {
  return Boolean(subscriptionProductId() && loadServiceAccount());
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Signs a Google service-account JWT assertion (RS256) and exchanges it for
 * a short-lived OAuth2 access token — the standard server-to-server flow for
 * a Cloud service account, hand-rolled with node:crypto instead of
 * google-auth-library. */
async function getAccessToken() {
  const account = loadServiceAccount();
  if (!account) { const error = new Error('Google Play service account is not configured'); error.status = 503; throw error; }
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claims}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), account.private_key).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const assertion = `${signingInput}.${signature}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion}`,
  });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body.error_description || 'Google auth failed'); error.status = 502; throw error; }
  return body.access_token;
}

/** SUBSCRIPTION_STATE_ACTIVE and _IN_GRACE_PERIOD both mean the recruiter
 * still has paid access on Google's side (grace period is Google's own
 * billing-retry window, distinct from — and layered outside — our own
 * 7-day grace_period status). Every other state is treated as not-active. */
export function isActiveSubscriptionState(subscriptionState) {
  return subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' || subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
}

/** Verifies a purchase token against the Android Publisher API (subscriptionsv2).
 * Returns { isActive, expiryTimeMillis, latestOrderId } — never trusts the
 * client's own claim about what it purchased. */
export async function verifySubscriptionPurchase(purchaseToken) {
  if (!isGooglePlayConfigured()) { const error = new Error('Google Play is not configured'); error.status = 503; throw error; }
  const token = await getAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName()}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body?.error?.message || 'Purchase token verification failed'); error.status = 502; throw error; }
  const lineItem = (body.lineItems || [])[0];
  return {
    isActive: isActiveSubscriptionState(body.subscriptionState),
    expiryTimeMillis: lineItem?.expiryTime ? new Date(lineItem.expiryTime).getTime() : null,
    latestOrderId: body.latestOrderId || null,
  };
}

/** Decodes the base64-JSON Pub/Sub push envelope Google sends for Real-time
 * Developer Notifications. Pure/testable — no network call. */
export function parseRtdnMessage(pubSubBody) {
  const dataB64 = pubSubBody?.message?.data;
  if (!dataB64) return null;
  const decoded = JSON.parse(Buffer.from(dataB64, 'base64').toString('utf8'));
  const notification = decoded.subscriptionNotification;
  if (!notification) return null;
  return {
    purchaseToken: notification.purchaseToken,
    subscriptionId: notification.subscriptionId,
    notificationType: notification.notificationType,
  };
}

/** RTDN endpoints are protected by a shared secret in the webhook URL
 * (?token=...) rather than verifying Pub/Sub's own OIDC token — simpler,
 * and consistent with how the existing billing-cron endpoint is secured. */
export function isValidRtdnSecret(providedSecret) {
  const expected = rtdnSecret();
  if (!expected || !providedSecret) return false;
  const a = Buffer.from(String(providedSecret));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
