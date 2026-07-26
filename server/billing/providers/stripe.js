import crypto from 'node:crypto';

/* Stripe: recruiter subscription checkout for a France-registered merchant
 * entity (Stripe does not support Vietnam-registered merchants, which is why
 * VNPay exists as the other card-payment path — see providers/vnpay.js).
 * Hand-rolled against Stripe's HTTP API with fetch + node:crypto rather than
 * the `stripe` SDK, matching this codebase's existing pattern (see VNPay).
 *
 * Checkout Sessions do the card collection on Stripe's own hosted page, so
 * card numbers never touch our server. The webhook is the only thing that
 * ever confirms a payment — see server/billing/confirm.js — the client
 * returning from Stripe's checkout page is UX only. */

function secretKey() { return process.env.STRIPE_SECRET_KEY || ''; }
function webhookSecret() { return process.env.STRIPE_WEBHOOK_SECRET || ''; }
function priceId() { return process.env.STRIPE_PRICE_ID || ''; }

export function isStripeConfigured() {
  return Boolean(secretKey() && priceId());
}

function formBody(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.append(key, String(value));
  }
  return search.toString();
}

/** Creates a Stripe-hosted Checkout Session for one recruiter-monthly
 * subscription. `clientReferenceId` should be the local Payment record's id
 * so the webhook can map the resulting Stripe objects back to it. */
export async function createCheckoutSession({ clientReferenceId, customerEmail, successUrl, cancelUrl }) {
  if (!isStripeConfigured()) { const error = new Error('Stripe is not configured'); error.status = 503; throw error; }
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody({
      mode: 'subscription',
      'line_items[0][price]': priceId(),
      'line_items[0][quantity]': 1,
      client_reference_id: clientReferenceId,
      customer_email: customerEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),
  });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body?.error?.message || 'Stripe checkout session creation failed'); error.status = 502; throw error; }
  return body; // { id, url, ... }
}

/** Verifies Stripe's webhook signature: header is `t=<timestamp>,v1=<hex hmac>`,
 * signed payload is `${timestamp}.${rawBody}` with HMAC-SHA256. Rejects
 * signatures older than 5 minutes to block replay of a captured payload. */
export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!isStripeConfigured() || !webhookSecret() || !signatureHeader) return false;
  const parts = Object.fromEntries(String(signatureHeader).split(',').map((part) => part.split('=')));
  const timestamp = parts.t;
  const providedSignature = parts.v1;
  if (!timestamp || !providedSignature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac('sha256', webhookSecret()).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  const a = Buffer.from(providedSignature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
