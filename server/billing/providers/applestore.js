import crypto from 'node:crypto';
import fs from 'node:fs';

/* Apple: recruiter subscription purchased inside the iOS app via the native
 * AppleIAPPlugin (ios/App/App/AppleIAPPlugin.swift, StoreKit 2). Verified
 * server-side against Apple's App Store Server API — hand-rolled JWT
 * signing (our outbound auth) and JWS decoding/verification (Apple's
 * inbound signed payloads) via node:crypto, matching this codebase's
 * existing pattern (see VNPay/Stripe/Google Play).
 *
 * KNOWN LIMITATION (read before relying on this in production): the
 * certificate-chain verification in verifyJws() below is the least-tested
 * piece of this entire billing system — it has never been exercised against
 * a real Apple-signed payload (no Apple sandbox credentials were available
 * while writing it). Test it against Apple's sandbox Server Notifications
 * (App Store Connect has a "send test notification" button) before treating
 * a production purchase as verified by this code alone.
 *
 * The client-side transaction finish() in the plugin is NOT the
 * confirmation authority — only a server-verified transaction (this file)
 * or a Server Notification V2 ever extends a subscription, via the shared
 * confirmPayment() in server/billing/confirm.js. */

const APPLE_ROOT_CA_URL = 'https://www.apple.com/certificateauthority/AppleRootCA-G3.cer';
let cachedAppleRootPublicKey = null;

function bundleId() { return process.env.APPLE_BUNDLE_ID || 'com.jobsmatchnow.app'; }
function keyId() { return process.env.APPLE_ASC_KEY_ID || ''; }
function issuerId() { return process.env.APPLE_ASC_ISSUER_ID || ''; }
function environment() { return process.env.APPLE_ENVIRONMENT === 'Production' ? 'Production' : 'Sandbox'; }
export function subscriptionProductId() { return process.env.APPLE_SUBSCRIPTION_PRODUCT_ID || ''; }

function loadPrivateKey() {
  const keyPath = process.env.APPLE_ASC_PRIVATE_KEY_PATH;
  if (!keyPath) return null;
  try { return fs.readFileSync(keyPath, 'utf8'); } catch { return null; }
}

export function isAppleConfigured() {
  return Boolean(keyId() && issuerId() && loadPrivateKey());
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Signs the ES256 JWT App Store Server API auth requires — 5 minute
 * expiry per Apple's own recommendation (they reject longer-lived ones). */
function signAppStoreJwt() {
  const privateKey = loadPrivateKey();
  if (!privateKey) { const error = new Error('Apple App Store Server API is not configured'); error.status = 503; throw error; }
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId(), typ: 'JWT' }));
  const claims = base64url(JSON.stringify({ iss: issuerId(), iat: now, exp: now + 300, aud: 'appstoreconnect-v1', bid: bundleId() }));
  const signingInput = `${header}.${claims}`;
  // ES256 signatures from node:crypto are DER-encoded by default; the JOSE
  // JWS format requires the raw fixed-length r||s concatenation instead.
  const derSignature = crypto.sign('sha256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  const signature = derSignature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${signingInput}.${signature}`;
}

/** Splits a JWS Compact Serialization into its three parts and decodes the
 * header/payload as JSON. Pure/testable — does not verify the signature. */
export function decodeJws(signedPayload) {
  const [headerB64, payloadB64, signatureB64] = String(signedPayload).split('.');
  if (!headerB64 || !payloadB64 || !signatureB64) return null;
  return {
    header: JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')),
    payload: JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')),
    signingInput: `${headerB64}.${payloadB64}`,
    signature: signatureB64,
  };
}

async function fetchAppleRootPublicKey() {
  if (cachedAppleRootPublicKey) return cachedAppleRootPublicKey;
  const response = await fetch(APPLE_ROOT_CA_URL);
  const der = Buffer.from(await response.arrayBuffer());
  cachedAppleRootPublicKey = new crypto.X509Certificate(der).publicKey;
  return cachedAppleRootPublicKey;
}

/** Verifies the x5c certificate chain in a JWS header (leaf -> intermediate
 * -> Apple's published root, fetched live rather than hardcoded — see the
 * module-level comment on why) and then the ES256 signature itself. */
export async function verifyJws(signedPayload) {
  const decoded = decodeJws(signedPayload);
  if (!decoded || decoded.header.alg !== 'ES256' || !Array.isArray(decoded.header.x5c) || decoded.header.x5c.length < 2) return false;
  try {
    const certs = decoded.header.x5c.map((entry) => new crypto.X509Certificate(Buffer.from(entry, 'base64')));
    for (let i = 0; i < certs.length - 1; i += 1) {
      if (!certs[i].verify(certs[i + 1].publicKey)) return false;
    }
    const rootPublicKey = await fetchAppleRootPublicKey();
    if (!certs[certs.length - 1].verify(rootPublicKey) && !certs[certs.length - 1].publicKey.equals(rootPublicKey)) return false;
    const sigBuffer = Buffer.from(decoded.signature, 'base64url');
    return crypto.verify('sha256', Buffer.from(decoded.signingInput), { key: certs[0].publicKey, dsaEncoding: 'ieee-p1363' }, sigBuffer);
  } catch {
    return false;
  }
}

/** Fetches a transaction's current, Apple-signed state directly from the
 * App Store Server API — the authoritative source, not the client's claim
 * about what it purchased. */
export async function getTransactionInfo(transactionId) {
  if (!isAppleConfigured()) { const error = new Error('Apple App Store billing is not configured yet'); error.status = 503; throw error; }
  const host = environment() === 'Production' ? 'https://api.storekit.itunes.apple.com' : 'https://api.storekit-sandbox.itunes.apple.com';
  const jwt = signAppStoreJwt();
  const response = await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body?.errorMessage || 'Transaction lookup failed'); error.status = 502; throw error; }
  const verified = await verifyJws(body.signedTransactionInfo);
  if (!verified) { const error = new Error('Apple transaction signature could not be verified'); error.status = 502; throw error; }
  const decoded = decodeJws(body.signedTransactionInfo);
  return {
    isActive: !decoded.payload.revocationDate && (!decoded.payload.expiresDate || decoded.payload.expiresDate > Date.now()),
    expiryTimeMillis: decoded.payload.expiresDate || null,
    originalTransactionId: decoded.payload.originalTransactionId,
    transactionId: decoded.payload.transactionId,
  };
}
