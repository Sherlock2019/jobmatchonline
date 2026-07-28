import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOST_HOURS, boostedIds, expireBoosts, isBoosted, startBoost } from './billing/boosts.js';

const HOUR_MS = 60 * 60 * 1000;
const makeDb = () => ({ boosts: [], billingEvents: [] });

test('a boost makes exactly its own target promoted', () => {
  const db = makeDb();
  startBoost(db, { kind: 'job', targetId: 'job-1', purchasedByUserId: 'rec-1' });
  assert.equal(isBoosted(db, 'job', 'job-1'), true);
  assert.equal(isBoosted(db, 'job', 'job-2'), false);
  // Kinds are separate namespaces — a boosted job never promotes a candidate id.
  assert.equal(isBoosted(db, 'candidate', 'job-1'), false);
});

test('boostedIds returns only the requested kind', () => {
  const db = makeDb();
  startBoost(db, { kind: 'job', targetId: 'job-1', purchasedByUserId: 'rec-1' });
  startBoost(db, { kind: 'candidate', targetId: 'cand-1', purchasedByUserId: 'cand-1' });
  assert.deepEqual([...boostedIds(db, 'job')], ['job-1']);
  assert.deepEqual([...boostedIds(db, 'candidate')], ['cand-1']);
});

test('re-boosting extends from the existing expiry instead of resetting it', () => {
  const db = makeDb();
  const now = Date.now();
  startBoost(db, { kind: 'job', targetId: 'job-1', purchasedByUserId: 'rec-1' }, now);
  const firstExpiry = db.boosts[0].expiresAt;

  // Buy a second one an hour later — the buyer must get the full extra window.
  const result = startBoost(db, { kind: 'job', targetId: 'job-1', purchasedByUserId: 'rec-1' }, now + HOUR_MS);
  assert.equal(result.outcome, 'extended');
  assert.equal(db.boosts.length, 1);
  assert.equal(db.boosts[0].expiresAt, firstExpiry + BOOST_HOURS * HOUR_MS);
});

test('an expired boost stops promoting even before the sweep runs', () => {
  const db = makeDb();
  const now = Date.now();
  startBoost(db, { kind: 'job', targetId: 'job-1', purchasedByUserId: 'rec-1' }, now);
  const later = now + (BOOST_HOURS + 1) * HOUR_MS;
  assert.equal(isBoosted(db, 'job', 'job-1', later), false);
  assert.equal(boostedIds(db, 'job', later).size, 0);
});

test('the expiry sweep is idempotent', () => {
  const db = makeDb();
  const now = Date.now();
  startBoost(db, { kind: 'job', targetId: 'job-1', purchasedByUserId: 'rec-1' }, now);
  const later = now + (BOOST_HOURS + 1) * HOUR_MS;
  assert.equal(expireBoosts(db, later), 1);
  assert.equal(expireBoosts(db, later), 0);
  assert.equal(db.boosts[0].status, 'expired');
});

test('a revoked boost never promotes again', () => {
  const db = makeDb();
  startBoost(db, { kind: 'job', targetId: 'job-1', purchasedByUserId: 'rec-1' });
  db.boosts[0].status = 'revoked';
  assert.equal(isBoosted(db, 'job', 'job-1'), false);
});

test('every boost lands in the audit log', () => {
  const db = makeDb();
  startBoost(db, { kind: 'job', targetId: 'job-1', purchasedByUserId: 'rec-1' });
  startBoost(db, { kind: 'job', targetId: 'job-1', purchasedByUserId: 'rec-1' });
  assert.deepEqual(db.billingEvents.map((event) => event.eventType), ['boost_purchased', 'boost_extended']);
});

test('boosting reorders the deck without touching any match score', () => {
  const db = makeDb();
  startBoost(db, { kind: 'job', targetId: 'job-2', purchasedByUserId: 'rec-2' });
  const promotedIds = boostedIds(db, 'job');

  // Mirrors what /api/bootstrap does: flag, then a stable promoted-first sort.
  const deck = [
    { id: 'job-1', match: { score: 91 } },
    { id: 'job-2', match: { score: 55 } },
    { id: 'job-3', match: { score: 80 } },
  ].map((job) => ({ ...job, promoted: promotedIds.has(job.id) }));
  deck.sort((a, b) => Number(Boolean(b.promoted)) - Number(Boolean(a.promoted)));

  assert.deepEqual(deck.map((job) => job.id), ['job-2', 'job-1', 'job-3'], 'boosted card leads');
  assert.deepEqual(deck.map((job) => job.match.score), [55, 91, 80], 'scores are exactly what they were');
  assert.equal(deck[0].promoted, true, 'and the promoted card is labelled as such');
});
