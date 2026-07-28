import crypto from 'node:crypto';
import { logBillingEvent } from './audit.js';

/* Boosts: pay once, get pinned to the top of the relevant deck for 72 hours.
 *
 * Two kinds, because both sides of the marketplace have something to promote:
 *   job       — a recruiter's role, pinned in candidates' job deck
 *   candidate — a candidate's profile, pinned in recruiters' candidate deck
 *
 * A boosted card is always LABELLED as promoted and its match score is left
 * untouched. Boosting changes running order only. The product's whole promise
 * is that the fit score explains itself, so a paid placement that silently
 * inflated that score would make the score a lie. */

export const BOOST_HOURS = Number(process.env.BOOST_DURATION_HOURS || 72);
export const BOOST_PRICE_USD = Number(process.env.BOOST_PRICE_USD || 12);
export const BOOST_PRICE_VND = Number(process.env.BOOST_PRICE_VND || 300000);
export const BOOST_KINDS = ['job', 'candidate'];

const HOUR_MS = 60 * 60 * 1000;

export function boostPrice(currency = 'USD') {
  return currency === 'VND' ? BOOST_PRICE_VND : BOOST_PRICE_USD;
}

/** Live right now: paid for, not expired, not refunded. */
export function isActiveBoost(boost, now = Date.now()) {
  return Boolean(boost) && boost.status === 'active' && boost.expiresAt > now;
}

export function activeBoosts(db, now = Date.now()) {
  return (db.boosts || []).filter((boost) => isActiveBoost(boost, now));
}

/** Boosted target ids of one kind, as a Set for O(1) lookup while ranking a deck. */
export function boostedIds(db, kind, now = Date.now()) {
  return new Set(activeBoosts(db, now).filter((b) => b.kind === kind).map((b) => b.targetId));
}

/** Is this specific job/profile currently boosted? */
export function isBoosted(db, kind, targetId, now = Date.now()) {
  return activeBoosts(db, now).some((b) => b.kind === kind && b.targetId === targetId);
}

/**
 * Start a boost. Re-boosting something already boosted extends from the
 * existing expiry rather than resetting it, so paying twice never buys less
 * time than paying twice should.
 */
export function startBoost(db, { kind, targetId, purchasedByUserId, currency = 'USD' }, now = Date.now()) {
  if (!BOOST_KINDS.includes(kind)) return { outcome: 'invalid_kind' };
  if (!Array.isArray(db.boosts)) db.boosts = [];

  const existing = (db.boosts || []).find((b) => b.kind === kind && b.targetId === targetId && isActiveBoost(b, now));
  if (existing) {
    existing.expiresAt += BOOST_HOURS * HOUR_MS;
    existing.updatedAt = now;
    logBillingEvent(db, purchasedByUserId, 'boost_extended', 'boost', existing.id, { kind, targetId, expiresAt: existing.expiresAt });
    return { outcome: 'extended', boost: existing };
  }

  const boost = {
    id: crypto.randomUUID(),
    kind,
    targetId,
    purchasedByUserId,
    amount: boostPrice(currency),
    currency,
    status: 'active',
    startedAt: now,
    expiresAt: now + BOOST_HOURS * HOUR_MS,
    createdAt: now,
    updatedAt: now,
  };
  db.boosts.push(boost);
  logBillingEvent(db, purchasedByUserId, 'boost_purchased', 'boost', boost.id, { kind, targetId, expiresAt: boost.expiresAt });
  return { outcome: 'started', boost };
}

/** Sweep expired boosts to a terminal status. Safe to run repeatedly. */
export function expireBoosts(db, now = Date.now()) {
  let expired = 0;
  for (const boost of db.boosts || []) {
    if (boost.status === 'active' && boost.expiresAt <= now) {
      boost.status = 'expired';
      boost.updatedAt = now;
      expired += 1;
    }
  }
  return expired;
}
