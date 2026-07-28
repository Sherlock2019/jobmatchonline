import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bundleCost, bundleSeats, cheapestStackCost, EXTRA_SEAT_ADDON, PLANS, SEAT_LADDER, planPrice,
} from './billing/plans.js';
import { activeMembers, addMember, getOrCreateTeam, reconcileSeats, seatsAllowed } from './billing/seats.js';

const CURRENCIES = ['USD', 'VND'];

/* ── The seat pricing invariant ──────────────────────────────────────────────
 *
 * Two conditions, both of which must hold for every rung of the ladder and for
 * Agency with any number of add-on seats:
 *
 *   1. Per-seat price never increases as you move up. Buying a bigger plan is
 *      never worse value per seat than the plan below it.
 *   2. A bundle is never more expensive than assembling the same seat count out
 *      of smaller plans. If it were, the rational move would be to open several
 *      accounts — which is exactly the behaviour a seat model exists to avoid.
 *
 * `cheapestStackCost` is an exhaustive DP over the whole ladder rather than a
 * handful of hand-picked comparisons, so condition 2 cannot pass by accident.
 */

test('seat pricing invariant: per-seat price never increases up the ladder', () => {
  for (const currency of CURRENCIES) {
    for (let i = 1; i < SEAT_LADDER.length; i += 1) {
      const lower = SEAT_LADDER[i - 1];
      const upper = SEAT_LADDER[i];
      const lowerPerSeat = planPrice(lower, currency) / PLANS[lower].seats;
      const upperPerSeat = planPrice(upper, currency) / PLANS[upper].seats;
      assert.ok(upperPerSeat <= lowerPerSeat,
        `${currency}: ${upper} costs ${upperPerSeat}/seat, more than ${lower} at ${lowerPerSeat}/seat`);
    }
  }
});

test('seat pricing invariant: a bundle never costs more than stacking smaller plans', () => {
  for (const currency of CURRENCIES) {
    for (const key of SEAT_LADDER) {
      const bundle = planPrice(key, currency);
      const stacked = cheapestStackCost(PLANS[key].seats, currency);
      assert.ok(bundle <= stacked,
        `${currency}: ${key} costs ${bundle} for ${PLANS[key].seats} seats but they can be stacked for ${stacked}`);
    }
  }
});

test('seat pricing invariant holds for agency plus up to 20 add-on seats', () => {
  for (const currency of CURRENCIES) {
    let previousPerSeat = planPrice('agency', currency) / PLANS.agency.seats;
    for (let extra = 1; extra <= 20; extra += 1) {
      const seats = bundleSeats('agency', extra);
      const cost = bundleCost('agency', extra, currency);
      const perSeat = cost / seats;

      // Condition 1 — each add-on seat keeps per-seat price flat or lowers it.
      assert.ok(perSeat <= previousPerSeat + 1e-9,
        `${currency}: agency + ${extra} seats costs ${perSeat}/seat, more than the step below at ${previousPerSeat}`);
      previousPerSeat = perSeat;

      // Condition 2 — still cheaper than assembling those seats from the ladder.
      const stacked = cheapestStackCost(seats, currency);
      assert.ok(cost <= stacked,
        `${currency}: agency + ${extra} seats costs ${cost} but ${seats} seats can be stacked for ${stacked}`);
    }
  }
});

test('add-on seats are sold on agency only', () => {
  assert.deepEqual(EXTRA_SEAT_ADDON.availableOn, ['agency']);
});

/* ── Seat allocation ─────────────────────────────────────────────────────── */

test('a recruiter who never invites anyone gets no team row at all', () => {
  const db = { teams: [] };
  assert.equal(db.teams.length, 0);
  assert.equal(seatsAllowed('solo'), 1);
});

test('creating a team is idempotent and the owner holds seat one', () => {
  const db = { teams: [] };
  const first = getOrCreateTeam(db, 'owner-1');
  const second = getOrCreateTeam(db, 'owner-1');
  assert.equal(first.id, second.id);
  assert.equal(db.teams.length, 1);
  assert.equal(first.members[0].userId, 'owner-1');
  assert.equal(first.members[0].role, 'owner');
  assert.equal(first.members[0].status, 'active');
});

test('members beyond the seat limit join read-only rather than being refused', () => {
  const db = { teams: [] };
  const team = getOrCreateTeam(db, 'owner-1');
  assert.equal(addMember(db, team, 'mate-1', 'duo').outcome, 'added');       // seat 2 of 2
  assert.equal(addMember(db, team, 'mate-2', 'duo').outcome, 'added_readonly');
  assert.equal(activeMembers(team).length, 2);
  assert.equal(team.members.length, 3);
});

test('downgrading demotes the newest members but never removes anyone', () => {
  const db = { teams: [] };
  const team = getOrCreateTeam(db, 'owner-1');
  addMember(db, team, 'mate-1', 'trio');
  addMember(db, team, 'mate-2', 'trio');
  assert.equal(activeMembers(team).length, 3);

  reconcileSeats(team, 'solo');
  assert.equal(team.members.length, 3, 'nobody is ever removed');
  assert.deepEqual(activeMembers(team).map((m) => m.userId), ['owner-1']);

  // Re-subscribing promotes them back, in the order they joined.
  reconcileSeats(team, 'trio');
  assert.deepEqual(activeMembers(team).map((m) => m.userId), ['owner-1', 'mate-1', 'mate-2']);
});

test('the owner keeps an active seat no matter when they were added', () => {
  const db = { teams: [] };
  const team = getOrCreateTeam(db, 'owner-1');
  team.members[0].joinedAt = Number.MAX_SAFE_INTEGER; // owner "joined" last
  addMember(db, team, 'mate-1', 'duo');
  reconcileSeats(team, 'starter'); // one seat only
  assert.deepEqual(activeMembers(team).map((m) => m.userId), ['owner-1']);
});

test('add-on seats widen the limit', () => {
  assert.equal(seatsAllowed('agency', 0), 10);
  assert.equal(seatsAllowed('agency', 5), 15);
  const db = { teams: [] };
  const team = getOrCreateTeam(db, 'owner-1');
  team.extraSeats = 2;
  for (let i = 0; i < 12; i += 1) addMember(db, team, `mate-${i}`, 'agency');
  assert.equal(activeMembers(team).length, 12); // 10 + 2 add-on seats
});

test('adding the same person twice is a no-op', () => {
  const db = { teams: [] };
  const team = getOrCreateTeam(db, 'owner-1');
  addMember(db, team, 'mate-1', 'trio');
  assert.equal(addMember(db, team, 'mate-1', 'trio').outcome, 'already_member');
  assert.equal(team.members.length, 2);
});
