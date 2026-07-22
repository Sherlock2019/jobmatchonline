/**
 * Real authentication primitives: scrypt password hashing and a small
 * in-memory sliding-window rate limiter. No external dependencies.
 * Sessions are signed cookies (see signedValue in integrations/linkedin.js).
 */
import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || typeof password !== 'string') return false;
  const [scheme, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  try {
    const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch { return false; }
}

export const PASSWORD_MIN_LENGTH = 8;

export function validPassword(password) {
  return typeof password === 'string' && password.length >= PASSWORD_MIN_LENGTH && password.length <= 200;
}

/**
 * Sliding-window rate limiter middleware, keyed by client IP (+ optional
 * route bucket). In-memory: correct for a single-process deployment, which is
 * both the MVP tier and the current production tier.
 */
export function rateLimit({ windowMs, max, bucket = '' }) {
  const hits = new Map();
  // Drop stale windows occasionally so the map can't grow unbounded.
  let lastSweep = Date.now();
  return (req, res, next) => {
    const now = Date.now();
    if (now - lastSweep > windowMs) {
      lastSweep = now;
      for (const [key, timestamps] of hits) {
        const fresh = timestamps.filter((t) => now - t < windowMs);
        if (fresh.length) hits.set(key, fresh); else hits.delete(key);
      }
    }
    const key = `${bucket}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
    const timestamps = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: 'Too many requests — please slow down and try again shortly.' });
    }
    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}
