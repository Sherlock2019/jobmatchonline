/* PayPal: recruiter subscription checkout via PayPal's Subscriptions API.
 * Sandbox by default (PAYPAL_ENV=sandbox) until switched to live. The
 * approval redirect is UX only — the webhook (verified via PayPal's own
 * verify-webhook-signature API, not a hand-rolled signature check) is the
 * only thing that ever confirms a payment, same pattern as every other
 * provider here — see server/billing/confirm.js. */

function clientId() { return process.env.PAYPAL_CLIENT_ID || ''; }
function clientSecret() { return process.env.PAYPAL_CLIENT_SECRET || ''; }
function planId() { return process.env.PAYPAL_PLAN_ID || ''; }
function webhookId() { return process.env.PAYPAL_WEBHOOK_ID || ''; }
function apiBase() { return process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'; }

export function isPaypalConfigured() {
  return Boolean(clientId() && clientSecret() && planId());
}

async function getAccessToken() {
  const response = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body?.error_description || 'PayPal auth failed'); error.status = 502; throw error; }
  return body.access_token;
}

/** Creates a PayPal subscription against the pre-created PAYPAL_PLAN_ID.
 * `customId` should be the local Payment record's id so the webhook can map
 * the resulting PayPal subscription back to it. Returns the PayPal
 * subscription object; callers redirect the recruiter to the `approve`
 * link in its `links` array. */
export async function createSubscription({ customId, returnUrl, cancelUrl }) {
  if (!isPaypalConfigured()) { const error = new Error('PayPal is not configured'); error.status = 503; throw error; }
  const token = await getAccessToken();
  const response = await fetch(`${apiBase()}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan_id: planId(),
      custom_id: customId,
      application_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: 'SUBSCRIBE_NOW' },
    }),
  });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body?.message || 'PayPal subscription creation failed'); error.status = 502; throw error; }
  return body;
}

export function approveLink(subscription) {
  return subscription.links?.find((link) => link.rel === 'approve')?.href || null;
}

/** Delegates signature verification to PayPal's own API rather than
 * hand-rolling it — PayPal's webhook signing scheme (cert_url + auth_algo +
 * transmission_sig) is intentionally not meant to be re-implemented
 * client-side; this is their documented verification path. */
export async function verifyWebhookSignature(headers, rawEventBody) {
  if (!isPaypalConfigured() || !webhookId()) return false;
  try {
    const token = await getAccessToken();
    const response = await fetch(`${apiBase()}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transmission_id: headers['paypal-transmission-id'],
        transmission_time: headers['paypal-transmission-time'],
        cert_url: headers['paypal-cert-url'],
        auth_algo: headers['paypal-auth-algo'],
        transmission_sig: headers['paypal-transmission-sig'],
        webhook_id: webhookId(),
        webhook_event: rawEventBody,
      }),
    });
    const body = await response.json();
    return response.ok && body.verification_status === 'SUCCESS';
  } catch {
    return false;
  }
}
