import crypto from 'node:crypto';

/* VNPay hosted-checkout: direct Visa/Mastercard/JCB (and domestic ATM card)
 * payment for Vietnam-based merchants — Stripe does not support Vietnamese
 * merchant accounts or VND payouts, so this is the automated-card provider
 * for v1 rather than Stripe. The card number is entered on VNPay's own
 * secure page, never on ours, so we stay out of PCI-DSS scope.
 *
 * Sandbox by default (VNPAY_PAYMENT_URL) until real merchant credentials
 * (VNPAY_TMN_CODE/VNPAY_HASH_SECRET) are set. Unconfigured is a safe no-op:
 * isVnpayConfigured() is false, so the create-payment route returns 503
 * instead of building a broken redirect.
 *
 * VNPay's redirect back to VNPAY_RETURN_URL is for UX only and must never be
 * trusted to grant entitlements on its own (the user's browser could be
 * pointed at it directly) — only the server-to-server IPN call is
 * authoritative. Both routes share verifySignature() below and only the
 * shared confirmPayment() (server/billing/confirm.js) actually extends a
 * subscription. */

// Read live (not cached at import time) so isVnpayConfigured()/signing can
// actually be exercised in tests by setting process.env.VNPAY_* beforehand,
// and so a credentials update to the env file takes effect on next request
// without a process restart being the only way to pick it up.
function tmnCode() { return process.env.VNPAY_TMN_CODE || ''; }
function hashSecret() { return process.env.VNPAY_HASH_SECRET || ''; }
export function vnpayPaymentUrl() { return process.env.VNPAY_PAYMENT_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'; }
const VNPAY_API_VERSION = '2.1.0';

// VNPay settles in VND only. The recruiter price is quoted as USD 20/month
// elsewhere, but VNPay has no FX conversion, so the card-payment path bills
// this fixed VND amount instead — update it by hand as the exchange rate
// moves (no live-rate lookup is wired up).
export const VNPAY_AMOUNT_VND = Number(process.env.RECRUITER_MONTHLY_PRICE_VND || 500000);

export function isVnpayConfigured() {
  return Boolean(tmnCode() && hashSecret());
}

function pad2(n) { return String(n).padStart(2, '0'); }

function vnpTimestamp(date = new Date()) {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}`;
}

/** VNPay signs the RAW (unencoded) sorted key=value string — only the final
 * redirect URL gets URL-encoded. Signing an already-encoded string is the
 * single most common integration bug with this API, so the two are kept as
 * clearly separate functions rather than one "helper" that's used for both. */
function buildSignData(params) {
  return Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
}

function sign(params, secret) {
  return crypto.createHmac('sha512', secret).update(Buffer.from(buildSignData(params), 'utf-8')).digest('hex');
}

function buildQueryString(params) {
  return Object.keys(params).sort().map((key) => `${key}=${encodeURIComponent(params[key])}`).join('&');
}

/** Builds the URL to redirect the recruiter's browser to VNPay's hosted
 * payment page. `txnRef` must be unique per attempt — callers pass the new
 * Payment record's own id. */
export function buildPaymentUrl({ txnRef, orderInfo, ipAddr, returnUrl, amountVnd = VNPAY_AMOUNT_VND, locale = 'vn' }) {
  if (!isVnpayConfigured()) { const error = new Error('VNPay is not configured'); error.status = 503; throw error; }
  const params = {
    vnp_Version: VNPAY_API_VERSION,
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode(),
    vnp_Amount: String(Math.round(amountVnd) * 100), // VNPay amount is the VND value x100, no decimals
    vnp_CurrCode: 'VND',
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: locale,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr || '127.0.0.1',
    vnp_CreateDate: vnpTimestamp(),
  };
  const secureHash = sign(params, hashSecret());
  return `${vnpayPaymentUrl()}?${buildQueryString(params)}&vnp_SecureHash=${secureHash}`;
}

/** Verifies an inbound return/IPN query's signature. Never throws — returns
 * false on any mismatch so callers can respond with VNPay's own "invalid
 * checksum" code instead of a 500. */
export function verifySignature(query) {
  if (!isVnpayConfigured()) return false;
  const { vnp_SecureHash: receivedHash, vnp_SecureHashType, ...rest } = query;
  if (!receivedHash) return false;
  const computed = sign(rest, hashSecret());
  const a = Buffer.from(String(receivedHash).toLowerCase());
  const b = Buffer.from(computed.toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** VNPay's own success sentinel: both fields must read "00". */
export function isVnpaySuccess(query) {
  return query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00';
}
